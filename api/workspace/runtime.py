"""Bounded live conversation runtime. One process per persistent SQLite volume."""
import asyncio
import html
import ipaddress
import json
import math
import os
import re
import time
import uuid
from urllib.parse import urlsplit

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.dependencies import require_role
from api.routers.conversations import get_store, owner_id

router = APIRouter()
tasks = {}


class LiveAttachment(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    type: str = Field(default="application/octet-stream", max_length=120)
    size: int = Field(default=0, ge=0, le=20_000_000)
    content: str | None = Field(default=None, max_length=50_000)


class LiveSource(BaseModel):
    url: str = Field(min_length=12, max_length=2048, pattern=r"^https://")


class LiveRequest(BaseModel):
    content: str = Field(min_length=1, max_length=16000)
    mode: str = Field(
        default="quick", pattern="^(quick|standard|research|council)$"
    )
    attachments: list[LiveAttachment] = Field(default_factory=list, max_length=8)
    sources: list[LiveSource] = Field(default_factory=list, max_length=4)
    request_id: uuid.UUID


COUNCIL_JUDGES = (
    "Critic",
    "Security",
    "Alignment",
    "Constraint",
    "Evaluator",
    "Documentation",
    "Aetherion Prime",
)

MAX_RESEARCH_SOURCE_BYTES = 500_000
MAX_RESEARCH_SOURCE_CHARS = 30_000


def research_allowlist():
    return tuple(
        item.strip().lower().lstrip("*.")
        for item in os.getenv("AETHERION_RESEARCH_ALLOWLIST", "").split(",")
        if item.strip()
    )


def validate_research_url(url):
    parsed = urlsplit(url)
    host = (parsed.hostname or "").lower().rstrip(".")
    if parsed.scheme != "https" or not host:
        raise RuntimeError("Research sources must use HTTPS URLs.")
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        raise RuntimeError("Research sources must use an allowlisted domain, not an IP address.")
    domains = research_allowlist()
    if not domains:
        raise RuntimeError(
            "Live web research is not configured. Set AETHERION_RESEARCH_ALLOWLIST."
        )
    if not any(host == domain or host.endswith("." + domain) for domain in domains):
        raise RuntimeError(f"Research domain is not allowlisted: {host}")
    return parsed, host


def extract_source_text(raw, content_type):
    text = raw.decode("utf-8", errors="replace")
    title = "Untitled source"
    if "html" in content_type:
        title_match = re.search(r"<title[^>]*>(.*?)</title>", text, re.I | re.S)
        if title_match:
            title = re.sub(r"\s+", " ", html.unescape(title_match.group(1))).strip()[:180]
        text = re.sub(r"<script[^>]*>.*?</script>|<style[^>]*>.*?</style>", " ", text, flags=re.I | re.S)
        text = re.sub(r"<[^>]+>", " ", text)
        text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return title or "Untitled source", text[:MAX_RESEARCH_SOURCE_CHARS]


async def fetch_research_sources(urls):
    if len(urls) > 4:
        raise RuntimeError("Deep research supports at most four web sources per request.")
    if not urls:
        return [], []
    contexts, metadata = [], []
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(12, connect=4),
        follow_redirects=False,
        headers={"User-Agent": "AetherionResearch/1.0"},
    ) as client:
        for index, url in enumerate(urls):
            source = {
                "id": f"web-{index + 1}",
                "url": url,
                "status": "blocked",
            }
            try:
                _, host = validate_research_url(url)
                response = await client.get(url)
                if response.status_code < 200 or response.status_code >= 300:
                    raise RuntimeError(f"Source returned HTTP {response.status_code}.")
                if len(response.content) > MAX_RESEARCH_SOURCE_BYTES:
                    raise RuntimeError("Source exceeds the 500 KB retrieval limit.")
                content_type = response.headers.get("content-type", "text/plain").lower()
                if not any(kind in content_type for kind in ("text/", "html", "json", "xml")):
                    raise RuntimeError("Source content type is not readable text.")
                title, text = extract_source_text(response.content, content_type)
                if not text:
                    raise RuntimeError("Source did not contain readable text.")
                source.update(
                    {
                        "domain": host,
                        "title": title,
                        "type": content_type.split(";", 1)[0],
                        "chars": len(text),
                        "status": "retrieved",
                    }
                )
                contexts.append({"title": title, "url": url, "content": text})
            except RuntimeError as error:
                source["error"] = str(error)
            except httpx.HTTPError:
                source["error"] = "Source could not be reached."
            metadata.append(source)
    return contexts, metadata


def initialize():
    store = get_store()
    with store.connect() as db:
        db.executescript('''
            CREATE TABLE IF NOT EXISTS live_runs (
                id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL,
                message_id TEXT NOT NULL, status TEXT NOT NULL,
                FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS one_live_run ON live_runs(conversation_id)
                WHERE status = 'running';
        ''')
        db.execute("UPDATE live_runs SET status='interrupted' WHERE status='running'")
        db.execute("UPDATE messages SET metadata=json_set(metadata, '$.status', 'interrupted') WHERE id IN (SELECT message_id FROM live_runs WHERE status='interrupted')")


async def tokens(messages):
    model = os.getenv("AETHERION_CHAT_MODEL", "")
    if not model:
        raise RuntimeError("Configure AETHERION_CHAT_MODEL and start Ollama to use live answers.")
    url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    complete = False
    async with httpx.AsyncClient(timeout=httpx.Timeout(60, connect=5)) as client:
        async with client.stream("POST", url + "/api/chat", json={
            "model": model, "messages": messages, "stream": True,
            "options": {"num_predict": 4096},
        }) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line:
                    continue
                event = json.loads(line)
                if event.get("error"):
                    raise RuntimeError("The model provider reported an error.")
                content = event.get("message", {}).get("content", "")
                if content:
                    yield content
                if event.get("done"):
                    complete = True
    if not complete:
        raise RuntimeError("The model connection ended before completing the answer.")


def persist(store, conversation_id, message_id, content, status, metadata=None):
    with store.connect() as db:
        row = db.execute(
            "SELECT metadata FROM messages WHERE id=?", (message_id,)
        ).fetchone()
        current = {}
        if row:
            try:
                current = json.loads(row["metadata"] or "{}")
            except (TypeError, json.JSONDecodeError):
                current = {}
        current["status"] = status
        current.update(metadata or {})
        db.execute(
            "UPDATE messages SET content=?, metadata=? WHERE id=?",
            (content, json.dumps(current), message_id),
        )
        db.execute("UPDATE conversations SET updated_at=? WHERE id=?", (time.time(), conversation_id))


def parse_council_vote(raw, judge):
    text = raw.strip().strip("`").strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        text = match.group(0)
    try:
        value = json.loads(text)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"{judge} returned an invalid Council vote.") from error
    verdict = str(value.get("verdict", "")).lower().strip()
    if verdict not in {"approve", "revise", "reject"}:
        raise RuntimeError(f"{judge} returned an invalid Council verdict.")
    try:
        confidence = float(value.get("confidence"))
    except (TypeError, ValueError) as error:
        raise RuntimeError(f"{judge} returned an invalid Council confidence.") from error
    if not math.isfinite(confidence) or not 0 <= confidence <= 1:
        raise RuntimeError(f"{judge} returned an invalid Council confidence.")
    reason = str(value.get("reason", "")).strip()
    if not reason or len(reason) > 360:
        raise RuntimeError(f"{judge} returned an invalid Council reason.")
    return {
        "judge": judge,
        "verdict": verdict,
        "confidence": round(confidence, 3),
        "reason": reason,
    }


async def run_council(store, conversation_id, run_id, messages):
    votes = []
    for judge in COUNCIL_JUDGES:
        store.emit(
            conversation_id,
            "agent.started",
            {"name": judge, "role": "council_judge", "run_id": run_id},
        )
        raw = ""
        prompt = (
            f"You are Council judge {judge}. Review the user's request and the available advisory context. "
            "You have no tools and must not claim execution, live research, or certainty. "
            "Return exactly one JSON object with verdict (approve, revise, or reject), confidence (0 to 1), "
            "and a short reason under 280 characters. Do not include private chain-of-thought."
        )
        async for delta in tokens([{"role": "system", "content": prompt}, *messages]):
            raw += delta
            if len(raw) > 4000:
                raise RuntimeError(f"{judge} exceeded the Council vote limit.")
        vote = parse_council_vote(raw, judge)
        votes.append(vote)
        store.emit(conversation_id, "council.vote", {**vote, "run_id": run_id})
        store.emit(
            conversation_id,
            "agent.completed",
            {"name": judge, "role": "council_judge", "run_id": run_id},
        )
    security = next(v for v in votes if v["judge"] == "Security")
    approvals = sum(v["verdict"] == "approve" for v in votes)
    rejections = sum(v["verdict"] == "reject" for v in votes)
    if security["verdict"] == "reject":
        decision, security_veto = "reject", True
    elif rejections >= 4:
        decision, security_veto = "reject", False
    elif approvals >= 4:
        decision, security_veto = "approve", False
    else:
        decision, security_veto = "revise", False
    verdict = {
        "decision": decision,
        "security_veto": security_veto,
        "approvals": approvals,
        "rejections": rejections,
        "revisions": len(votes) - approvals - rejections,
        "confidence": round(sum(v["confidence"] for v in votes) / len(votes), 3),
        "votes": votes,
        "approval_required": True,
    }
    store.emit(conversation_id, "council.verdict", {**verdict, "run_id": run_id})
    return verdict


async def execute(
    store,
    owner,
    conversation_id,
    run_id,
    message_id,
    mode,
    attachment_context=None,
    source_metadata=None,
    source_urls=None,
):
    content, status, council, artifact = "", "completed", None, None
    sources = list(source_metadata or []) if mode == "research" else []
    source_urls = source_urls or []
    try:
        async with asyncio.timeout(420):
            history = store.get(owner, conversation_id)["messages"]
            messages = []
            for item in history[-12:]:
                if item["id"] == message_id or not item["content"]:
                    continue
                message = item["content"][-8000:]
                attachments = item.get("metadata", {}).get("attachments", [])
                if attachments:
                    names = ", ".join(str(file.get("name", "unnamed")) for file in attachments)
                    attachment_note = (
                        ". Bounded text was ingested for this request."
                        if any(file.get("text_ingested") for file in attachments)
                        else ". File contents are not ingested by this advisory runtime."
                    )
                    message += (
                        f"\n\n[Attached file metadata: {names}{attachment_note}]"
                    )
                messages.append({"role": item["role"], "content": message})
            if attachment_context and messages:
                blocks = [
                    f"[Attached text: {item['name']}]\n{item['content']}"
                    for item in attachment_context
                ]
                messages[-1]["content"] += "\n\n" + "\n\n".join(blocks)
            web_contexts = []
            if mode == "research" and source_urls:
                store.emit(
                    conversation_id,
                    "agent.started",
                    {"name": "Research retrieval", "run_id": run_id},
                )
                web_contexts, web_sources = await fetch_research_sources(source_urls)
                sources.extend(web_sources)
                for source in web_sources:
                    store.emit(
                        conversation_id,
                        "research.source",
                        {
                            key: source[key]
                            for key in (
                                "id",
                                "url",
                                "domain",
                                "title",
                                "status",
                                "chars",
                                "error",
                            )
                            if key in source
                        }
                        | {"run_id": run_id},
                    )
                store.emit(
                    conversation_id,
                    "agent.completed",
                    {
                        "name": "Research retrieval",
                        "run_id": run_id,
                        "sources": len(web_contexts),
                    },
                )
                if not web_contexts:
                    detail = next(
                        (
                            item.get("error")
                            for item in sources[-len(source_urls) :]
                            if item.get("error")
                        ),
                        "No research sources could be retrieved.",
                    )
                    raise RuntimeError(detail)
                if messages:
                    blocks = [
                        f"[Source: {item['title']}]\nURL: {item['url']}\n{item['content']}"
                        for item in web_contexts
                    ]
                    messages[-1]["content"] += "\n\n" + "\n\n".join(blocks)
            system = "You are Aetherion's Chief of Staff. Give a useful, honest answer. You have no tools, web access, or file execution. Never claim to have executed, researched live sources, or received Council approval. Provide concise conclusions and uncertainty, not private deliberation."
            if mode == "research":
                if source_urls:
                    system = (
                        "You are Aetherion's evidence analyst. Produce a bounded research brief "
                        "using only the explicitly attached text and retrieved allowlisted sources "
                        "in this request. Cite supported claims with [Source: title], distinguish "
                        "evidence from inference, identify disagreement, and say when the sources "
                        "are insufficient. Do not claim access to any source that is not provided."
                    )
                else:
                    system = (
                        "You are Aetherion's evidence analyst. Produce a bounded research brief "
                        "using only the explicitly attached text in this request. You have no web "
                        "access, browsing, or external sources. Cite claims with [Source: filename] "
                        "when supported, distinguish evidence from inference, and say when the "
                        "attached material is insufficient. Never imply that live research occurred."
                    )
            if mode == "standard":
                from institution.registry import select, run_specialist
                for specialist in select(messages[-1]["content"]):
                    name = specialist.id
                    store.emit(conversation_id, "agent.started", {"name": name, "college": specialist.college, "run_id": run_id})
                    summary = await run_specialist(name, messages, tokens)
                    messages.append({"role": "assistant", "content": name + " advisory summary: " + summary})
                    store.emit(conversation_id, "agent.completed", {"name": name, "run_id": run_id, "summary": summary})
            if mode == "council":
                council = await run_council(store, conversation_id, run_id, messages)
                messages.append({
                    "role": "assistant",
                    "content": "Council review summary: " + json.dumps({
                        "decision": council["decision"],
                        "approvals": council["approvals"],
                        "rejections": council["rejections"],
                        "security_veto": council["security_veto"],
                    }),
                })
            store.emit(conversation_id, "agent.started", {"name": "Chief of Staff", "run_id": run_id})
            async for delta in tokens([{"role": "system", "content": system}, *messages]):
                content += delta
                if len(content) > 50000:
                    raise RuntimeError("Answer exceeded the allowed size.")
                persist(store, conversation_id, message_id, content, "running")
                store.emit(conversation_id, "message.delta", {"id": message_id, "delta": delta, "run_id": run_id})
            if not content.strip():
                raise RuntimeError("The provider returned no answer.")
    except asyncio.CancelledError:
        status = "cancelled"
    except Exception as error:
        status = "failed"
        explanation = str(error) if isinstance(error, RuntimeError) else "Model service unavailable or timed out. Check the server configuration and retry."
        store.emit(conversation_id, "mission.error", {"detail": explanation, "run_id": run_id})
        if not content:
            content = explanation
    finally:
        if status == "completed" and content.strip() and mode in {"standard", "research"}:
            artifact = store.create_artifact(
                owner,
                conversation_id,
                message_id,
                "Research brief" if mode == "research" else "Mission brief",
                content,
            )
        final_metadata = {"council": council} if council else {}
        if sources:
            final_metadata["sources"] = sources
        if artifact:
            final_metadata["artifact"] = {
                key: artifact[key]
                for key in ("id", "title", "mime_type", "revision", "updated_at")
            }
        persist(
            store,
            conversation_id,
            message_id,
            content,
            status,
            final_metadata or None,
        )
        with store.connect() as db:
            db.execute("UPDATE live_runs SET status=? WHERE id=?", (status, run_id))
        store.emit(conversation_id, "message.finished", {"id": message_id, "content": content, "status": status, "run_id": run_id, "council": council, "artifact": final_metadata.get("artifact")})
        tasks.pop(run_id, None)


@router.post("/conversations/{conversation_id}/live", status_code=202)
async def submit(conversation_id: str, request: LiveRequest, user=Depends(require_role("operator"))):
    store, owner = get_store(), owner_id(user)
    if not request.content.strip():
        raise HTTPException(422, "Enter a message")
    if request.sources and request.mode != "research":
        raise HTTPException(422, "Web sources are available only in Deep research mode.")
    if not store.get(owner, conversation_id):
        raise HTTPException(404, "Conversation not found")
    run_id, message_id = str(request.request_id), str(uuid.uuid4())
    with store.connect() as db:
        db.execute("BEGIN IMMEDIATE")
        existing = db.execute("SELECT * FROM live_runs WHERE id=?", (run_id,)).fetchone()
        if existing:
            if existing["conversation_id"] != conversation_id:
                raise HTTPException(409, "Request identifier already used")
            return dict(existing)
        if db.execute("SELECT 1 FROM live_runs WHERE conversation_id=? AND status='running'", (conversation_id,)).fetchone():
            raise HTTPException(409, "A response is already running")
        if db.execute("SELECT COUNT(*) FROM live_runs WHERE status='running'").fetchone()[0] >= 8:
            raise HTTPException(429, "The model service is busy. Please retry shortly.")
        now = time.time()
        text_attachments = [
            {"name": item.name, "content": item.content}
            for item in request.attachments
            if item.content
        ]
        if sum(len(item["content"]) for item in text_attachments) > 100_000:
            raise HTTPException(422, "Combined text attachment content is limited to 100 KB.")
        attachment_metadata = [
            {
                "id": f"source-{index + 1}",
                "name": item.name,
                "type": item.type,
                "size": item.size,
                "text_ingested": bool(item.content),
            }
            for index, item in enumerate(request.attachments)
        ]
        user_metadata = {"mode": request.mode, "attachments": attachment_metadata}
        if request.sources:
            user_metadata["research_urls"] = [item.url for item in request.sources]
        db.execute(
            "INSERT INTO messages VALUES (?, ?, 'user', ?, 'text', ?, ?)",
            (
                str(uuid.uuid4()),
                conversation_id,
                request.content,
                json.dumps(user_metadata),
                now,
            ),
        )
        db.execute("INSERT INTO messages VALUES (?, ?, 'assistant', '', 'text', ?, ?)", (message_id, conversation_id, json.dumps({"mode": request.mode, "status": "running", "live": True}), now + .001))
        db.execute("INSERT INTO live_runs VALUES (?, ?, ?, 'running')", (run_id, conversation_id, message_id))
        db.execute("UPDATE conversations SET updated_at=? WHERE id=?", (now, conversation_id))
    tasks[run_id] = asyncio.create_task(
        execute(
            store,
            owner,
            conversation_id,
            run_id,
            message_id,
            request.mode,
            text_attachments,
            attachment_metadata,
            [item.url for item in request.sources],
        )
    )
    return {"id": run_id, "message_id": message_id, "status": "running"}


@router.post("/conversations/{conversation_id}/live/cancel")
async def cancel(conversation_id: str, user=Depends(require_role("operator"))):
    store = get_store()
    if not store.get(owner_id(user), conversation_id):
        raise HTTPException(404, "Conversation not found")
    with store.connect() as db:
        runs = db.execute("SELECT id FROM live_runs WHERE conversation_id=? AND status='running'", (conversation_id,)).fetchall()
    for run in runs:
        task = tasks.get(run["id"])
        if task:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        # A task cancelled before its first instruction never executes its finally block.
        with store.connect() as db:
            row = db.execute("SELECT message_id, status FROM live_runs WHERE id=?", (run["id"],)).fetchone()
            if row and row["status"] == "running":
                db.execute("UPDATE live_runs SET status='cancelled' WHERE id=?", (run["id"],))
                db.execute("UPDATE messages SET metadata=json_set(metadata, '$.status', 'cancelled') WHERE id=?", (row["message_id"],))
        if row and row["status"] == "running":
            store.emit(conversation_id, "message.finished", {"id": row["message_id"], "status": "cancelled", "run_id": run["id"]})
        tasks.pop(run["id"], None)
    return {"status": "cancelled"}
