import asyncio
import json
import time
import uuid

import pytest
from fastapi.testclient import TestClient

from api.routers.conversations import get_store, owner_id
from api.workspace import runtime
from api.workspace_app import app
from core.auth import AuthManager


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("AETHERION_REQUIRE_AUTH", "true")
    monkeypatch.setenv(
        "AETHERION_API_KEYS", "alice:operator,bob:operator,reader:viewer"
    )
    monkeypatch.setenv("AETHERION_JWT_SECRET", "test-secret-" * 6)
    monkeypatch.setenv("AETHERION_CONVERSATIONS_DB", str(tmp_path / "chat.db"))
    with TestClient(app) as c:
        yield c


def headers(key="alice"):
    return {"Authorization": "Bearer " + key}


def create(client):
    response = client.post(
        "/api/conversations", headers=headers(), json={"title": "Test"}
    )
    assert response.status_code == 201
    return response.json()["id"]


def wait_finished(client, cid):
    for _ in range(100):
        messages = client.get(
            "/api/conversations/" + cid, headers=headers()
        ).json()["messages"]
        if messages and messages[-1]["metadata"].get("status") != "running":
            return messages
        time.sleep(0.01)
    pytest.fail("Run did not finish")


def test_login_identity_and_owner_isolation(client):
    tokens = [
        client.post("/api/auth/login", json={"api_key": key}).json()[
            "access_token"
        ]
        for key in ["alice", "bob"]
    ]
    assert (
        AuthManager().verify_jwt(tokens[0])["sub"]
        != AuthManager().verify_jwt(tokens[1])["sub"]
    )
    cid = create(client)
    assert (
        client.get(
            "/api/conversations/" + cid, headers=headers("bob")
        ).status_code
        == 404
    )
    assert (
        client.get(
            "/api/conversations/" + cid + "/events", headers=headers("bob")
        ).status_code
        == 404
    )
    assert client.get("/api/conversations").status_code == 401
    assert (
        client.post(
            "/api/conversations", headers=headers("reader"), json={}
        ).status_code
        == 403
    )
    with pytest.raises(Exception):
        owner_id({"role": "operator"})


def test_health_advertises_all_live_modes(client):
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json()["modes"] == [
        "quick",
        "standard",
        "research",
        "council",
    ]


def test_readiness_reports_configuration_and_storage(client, monkeypatch):
    response = client.get("/health/ready")
    assert response.status_code == 503
    assert response.json()["detail"] == {
        "status": "not_ready",
        "checks": {"auth": True, "model": False, "database": True},
        "model": None,
    }
    monkeypatch.setenv("AETHERION_CHAT_MODEL", "qwen3:8b")
    ready = client.get("/health/ready")
    assert ready.status_code == 200
    assert ready.json() == {
        "status": "ready",
        "checks": {"auth": True, "model": True, "database": True},
        "model": "qwen3:8b",
    }


def test_conversation_replays_bounded_activity_events(client):
    cid = create(client)
    store = get_store()
    store.emit(cid, "agent.started", {"name": "Planner", "run_id": "run-1"})
    store.emit(cid, "message.delta", {"delta": "x" * 100_000})
    store.emit(
        cid,
        "council.vote",
        {"judge": "Security", "verdict": "approve", "run_id": "run-1"},
    )
    store.emit(
        cid,
        "message.finished",
        {"id": "message-1", "status": "completed", "content": "x" * 100_000},
    )
    replay = client.get(f"/api/conversations/{cid}", headers=headers())
    assert replay.status_code == 200
    events = replay.json()["recent_events"]
    assert [event["event"] for event in events] == [
        "agent.started",
        "council.vote",
        "message.finished",
    ]
    assert "content" not in events[-1]["payload"]
    assert (
        client.get(
            f"/api/conversations/{cid}", headers=headers("bob")
        ).status_code
        == 404
    )


def test_profile_is_owner_scoped_and_persistent(client):
    default = client.get("/api/profile", headers=headers()).json()
    assert default["name"] == "Operator"
    assert len(default["council"]) == 7
    saved = client.put(
        "/api/profile",
        headers=headers(),
        json={
            "name": "Ada Operator",
            "nickname": "Ada",
            "council": [
                "North",
                "East",
                "South",
                "West",
                "Zenith",
                "Archive",
                "Prime",
            ],
        },
    )
    assert saved.status_code == 200
    assert (
        client.get("/api/profile", headers=headers()).json()["nickname"]
        == "Ada"
    )
    assert (
        client.get("/api/profile", headers=headers("bob")).json()["name"]
        == "Operator"
    )
    assert (
        client.put(
            "/api/profile",
            headers=headers("reader"),
            json={
                "name": "Reader",
                "nickname": "Reader",
                "council": ["a"] * 7,
            },
        ).status_code
        == 403
    )
    assert (
        client.put(
            "/api/profile",
            headers=headers(),
            json={
                "name": " ",
                "nickname": "Ada",
                "council": ["a"] * 7,
            },
        ).status_code
        == 422
    )


def test_research_answer_creates_owner_scoped_editable_artifact(
    client, monkeypatch
):
    async def provider(messages):
        yield "# Evidence brief\n\nA bounded finding."

    monkeypatch.setattr(runtime, "tokens", provider)
    cid = create(client)
    response = client.post(
        f"/api/conversations/{cid}/live",
        headers=headers(),
        json={
            "content": "Prepare a brief.",
            "mode": "research",
            "request_id": str(uuid.uuid4()),
        },
    )
    assert response.status_code == 202
    message = wait_finished(client, cid)[-1]
    artifact_meta = message["metadata"]["artifact"]
    assert artifact_meta["title"] == "Research brief"
    assert artifact_meta["revision"] == 1

    artifact_url = f"/api/conversations/{cid}/artifacts/{artifact_meta['id']}"
    artifact = client.get(artifact_url, headers=headers())
    assert artifact.status_code == 200
    assert (
        artifact.json()["content"] == "# Evidence brief\n\nA bounded finding."
    )
    versions_url = artifact_url + "/versions"
    versions = client.get(versions_url, headers=headers())
    assert versions.status_code == 200
    assert [item["revision"] for item in versions.json()["versions"]] == [1]
    assert (
        client.get(
            f"/api/conversations/{cid}/artifacts", headers=headers()
        ).json()["artifacts"][0]["id"]
        == artifact_meta["id"]
    )
    saved = client.put(
        artifact_url,
        headers=headers(),
        json={
            "title": "Reviewed brief",
            "content": "# Reviewed\n\nHuman edit.",
            "revision": 1,
        },
    )
    assert saved.status_code == 200
    assert saved.json()["revision"] == 2
    versions = client.get(versions_url, headers=headers()).json()["versions"]
    assert [item["revision"] for item in versions] == [2, 1]
    assert client.get(versions_url + "/1", headers=headers()).json()[
        "content"
    ] == ("# Evidence brief\n\nA bounded finding.")
    assert client.get(versions_url + "/2", headers=headers()).json()[
        "content"
    ] == ("# Reviewed\n\nHuman edit.")
    conflict = client.put(
        artifact_url,
        headers=headers(),
        json={"title": "Stale", "content": "Stale edit.", "revision": 1},
    )
    assert conflict.status_code == 409
    assert conflict.json()["detail"]["revision"] == 2
    assert client.get(artifact_url, headers=headers("bob")).status_code == 404
    assert (
        client.put(
            artifact_url,
            headers=headers("reader"),
            json={"title": "Reader", "content": "Nope", "revision": 2},
        ).status_code
        == 403
    )


def test_stream_persistence_idempotency_and_specialists(client, monkeypatch):
    async def provider(messages):
        yield "Real protocol "
        await asyncio.sleep(0.01)
        yield "test output."

    monkeypatch.setattr(runtime, "tokens", provider)
    cid = create(client)
    body = {
        "content": "Plan this",
        "mode": "standard",
        "attachments": [
            {"name": "brief.pdf", "type": "application/pdf", "size": 1234}
        ],
        "request_id": str(uuid.uuid4()),
    }
    response = client.post(
        f"/api/conversations/{cid}/live", headers=headers(), json=body
    )
    assert response.status_code == 202
    assert (
        client.post(
            f"/api/conversations/{cid}/live", headers=headers(), json=body
        ).json()["id"]
        == response.json()["id"]
    )
    messages = wait_finished(client, cid)
    assert len(messages) == 2
    assert messages[0]["metadata"]["attachments"][0]["name"] == "brief.pdf"
    assert messages[-1]["content"] == "Real protocol test output."
    assert messages[-1]["metadata"]["status"] == "completed"
    events = get_store().events(cid, 0)
    assert sum(e["event"] == "agent.started" for e in events) == 2
    assert any(e["event"] == "message.delta" for e in events)
    assert events[-1]["event"] == "message.finished"


def test_message_feedback_persists_and_is_isolated(client):
    cid = create(client)
    owner = owner_id(AuthManager().verify_api_key("alice"))
    assistant = get_store().add_message(
        owner,
        cid,
        "assistant",
        "A bounded answer.",
        metadata={"status": "completed"},
    )
    feedback_url = (
        f"/api/conversations/{cid}/messages/{assistant['id']}/feedback"
    )
    response = client.patch(
        feedback_url, headers=headers(), json={"value": "up"}
    )
    assert response.status_code == 200
    assert response.json()["feedback"] == "up"
    saved = client.get(f"/api/conversations/{cid}", headers=headers()).json()
    assert saved["messages"][-1]["metadata"]["feedback"] == "up"

    cleared = client.patch(
        feedback_url, headers=headers(), json={"value": None}
    )
    assert cleared.status_code == 200
    assert (
        "feedback"
        not in client.get(
            f"/api/conversations/{cid}", headers=headers()
        ).json()["messages"][-1]["metadata"]
    )
    assert (
        client.patch(
            feedback_url, headers=headers("bob"), json={"value": "down"}
        ).status_code
        == 404
    )
    assert (
        client.patch(
            feedback_url, headers=headers(), json={"value": "maybe"}
        ).status_code
        == 422
    )


def test_conversation_rename_and_delete_are_authenticated(client):
    cid = create(client)
    renamed = client.patch(
        f"/api/conversations/{cid}",
        headers=headers(),
        json={"title": "Renamed mission"},
    )
    assert renamed.status_code == 200
    assert (
        client.get(f"/api/conversations/{cid}", headers=headers()).json()[
            "title"
        ]
        == "Renamed mission"
    )
    assert (
        client.patch(
            f"/api/conversations/{cid}",
            headers=headers("reader"),
            json={"title": "Not allowed"},
        ).status_code
        == 403
    )
    assert (
        client.delete(
            f"/api/conversations/{cid}", headers=headers()
        ).status_code
        == 204
    )
    assert (
        client.get(f"/api/conversations/{cid}", headers=headers()).status_code
        == 404
    )


def test_branch_endpoint_preserves_context_and_enforces_roles(client):
    cid = create(client)
    owner = owner_id(AuthManager().verify_api_key("alice"))
    first_user = get_store().add_message(owner, cid, "user", "First request")
    assistant = get_store().add_message(
        owner,
        cid,
        "assistant",
        "First answer",
        metadata={"status": "completed", "mode": "quick"},
    )
    get_store().add_message(owner, cid, "user", "Later request")

    response = client.post(
        f"/api/conversations/{cid}/branch",
        headers=headers(),
        json={"message_id": assistant["id"]},
    )
    assert response.status_code == 201
    branch = response.json()
    assert branch["title"] == "Branch · Test"
    assert [item["content"] for item in branch["messages"]] == [
        "First request",
        "First answer",
    ]
    assert (
        client.post(
            f"/api/conversations/{cid}/branch",
            headers=headers("reader"),
            json={"message_id": assistant["id"]},
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/conversations/{cid}/branch",
            headers=headers(),
            json={"message_id": first_user["id"]},
        ).status_code
        == 422
    )
    running = get_store().add_message(
        owner,
        cid,
        "assistant",
        "Still writing",
        metadata={"status": "running"},
    )
    assert (
        client.post(
            f"/api/conversations/{cid}/branch",
            headers=headers(),
            json={"message_id": running["id"]},
        ).status_code
        == 409
    )


def test_draft_sync_persists_and_clears_per_conversation(client):
    cid = create(client)
    draft_url = f"/api/conversations/{cid}/draft"
    assert client.get(draft_url, headers=headers()).json() == {
        "conversation_id": cid,
        "content": "",
        "revision": 0,
        "updated_at": None,
    }
    saved = client.put(
        draft_url,
        headers=headers(),
        json={"content": "Continue this mission tomorrow.", "revision": 0},
    )
    assert saved.status_code == 200
    assert saved.json()["content"] == "Continue this mission tomorrow."
    assert saved.json()["revision"] == 1
    assert client.get(draft_url, headers=headers()).json()["content"] == (
        "Continue this mission tomorrow."
    )
    conflict = client.put(
        draft_url,
        headers=headers(),
        json={"content": "Stale edit", "revision": 0},
    )
    assert conflict.status_code == 409
    assert conflict.json()["detail"]["content"] == (
        "Continue this mission tomorrow."
    )
    assert conflict.json()["detail"]["revision"] == 1
    cleared = client.put(
        draft_url, headers=headers(), json={"content": "", "revision": 1}
    )
    assert cleared.status_code == 200
    assert cleared.json()["revision"] == 2
    assert client.get(draft_url, headers=headers()).json()["content"] == ""
    assert client.get(draft_url, headers=headers("bob")).status_code == 404
    assert (
        client.put(
            draft_url,
            headers=headers("reader"),
            json={"content": "Viewer draft"},
        ).status_code
        == 403
    )
    assert (
        client.put(
            draft_url,
            headers=headers(),
            json={"content": "x" * 16_001},
        ).status_code
        == 422
    )


def test_text_attachments_are_ingested_without_persisting_content(
    client, monkeypatch
):
    captured = {}

    async def provider(messages):
        captured["messages"] = messages
        yield "Attachment reviewed."

    monkeypatch.setattr(runtime, "tokens", provider)
    cid = create(client)
    response = client.post(
        f"/api/conversations/{cid}/live",
        headers=headers(),
        json={
            "content": "Summarize the notes.",
            "mode": "research",
            "attachments": [
                {
                    "name": "notes.txt",
                    "type": "text/plain",
                    "size": 24,
                    "content": "The launch is scheduled for Friday.",
                }
            ],
            "request_id": str(uuid.uuid4()),
        },
    )
    assert response.status_code == 202
    messages = wait_finished(client, cid)
    assert (
        "The launch is scheduled for Friday."
        in captured["messages"][-1]["content"]
    )
    attachment = messages[0]["metadata"]["attachments"][0]
    assert attachment["text_ingested"] is True
    assert "content" not in attachment
    assert messages[-1]["metadata"]["sources"] == [
        {
            "id": "source-1",
            "name": "notes.txt",
            "type": "text/plain",
            "size": 24,
            "text_ingested": True,
        }
    ]
    assert (
        client.post(
            f"/api/conversations/{cid}/live",
            headers=headers(),
            json={
                "content": "Too much text",
                "attachments": [
                    {
                        "name": "large.txt",
                        "type": "text/plain",
                        "content": "x" * 50_000,
                    },
                    {
                        "name": "more.txt",
                        "type": "text/plain",
                        "content": "y" * 50_000,
                    },
                    {"name": "last.txt", "type": "text/plain", "content": "z"},
                ],
                "request_id": str(uuid.uuid4()),
            },
        ).status_code
        == 422
    )


def test_allowlisted_research_sources_are_cited_and_persisted(
    client, monkeypatch
):
    captured = {}

    async def provider(messages):
        captured["messages"] = messages
        yield "The source supports this claim [Source: Aetherion guide]."

    async def fetch_sources(urls):
        assert urls == ["https://docs.example.test/guide"]
        return (
            [
                {
                    "title": "Aetherion guide",
                    "url": urls[0],
                    "content": "A bounded source excerpt.",
                }
            ],
            [
                {
                    "id": "web-1",
                    "url": urls[0],
                    "domain": "docs.example.test",
                    "title": "Aetherion guide",
                    "type": "text/html",
                    "chars": 25,
                    "status": "retrieved",
                }
            ],
        )

    monkeypatch.setattr(runtime, "tokens", provider)
    monkeypatch.setattr(runtime, "fetch_research_sources", fetch_sources)
    cid = create(client)
    response = client.post(
        f"/api/conversations/{cid}/live",
        headers=headers(),
        json={
            "content": "Research this claim.",
            "mode": "research",
            "sources": [{"url": "https://docs.example.test/guide"}],
            "request_id": str(uuid.uuid4()),
        },
    )
    assert response.status_code == 202
    messages = wait_finished(client, cid)
    assert messages[0]["metadata"]["research_urls"] == [
        "https://docs.example.test/guide"
    ]
    assert messages[-1]["metadata"]["sources"][-1]["status"] == "retrieved"
    assert "[Source: Aetherion guide]" in captured["messages"][-1]["content"]


def test_research_sources_fail_closed_without_allowlist(client, monkeypatch):
    monkeypatch.delenv("AETHERION_RESEARCH_ALLOWLIST", raising=False)
    cid = create(client)
    response = client.post(
        f"/api/conversations/{cid}/live",
        headers=headers(),
        json={
            "content": "Research this claim.",
            "mode": "research",
            "sources": [{"url": "https://docs.example.test/guide"}],
            "request_id": str(uuid.uuid4()),
        },
    )
    assert response.status_code == 202
    result = wait_finished(client, cid)[-1]
    assert result["metadata"]["status"] == "failed"
    assert "AETHERION_RESEARCH_ALLOWLIST" in result["content"]


def test_cancel_keeps_partial_and_blocks_overlap(client, monkeypatch):
    async def provider(messages):
        yield "Partial"
        await asyncio.sleep(30)

    monkeypatch.setattr(runtime, "tokens", provider)
    cid = create(client)
    body = {"content": "Hello", "request_id": str(uuid.uuid4())}
    client.post(f"/api/conversations/{cid}/live", headers=headers(), json=body)
    time.sleep(0.03)
    body["request_id"] = str(uuid.uuid4())
    assert (
        client.post(
            f"/api/conversations/{cid}/live", headers=headers(), json=body
        ).status_code
        == 409
    )
    assert (
        client.post(
            f"/api/conversations/{cid}/live/cancel", headers=headers("bob")
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/conversations/{cid}/live/cancel", headers=headers()
        ).status_code
        == 200
    )
    result = wait_finished(client, cid)[-1]
    assert result["metadata"]["status"] == "cancelled"
    assert result["content"] == "Partial"


def test_council_persists_seven_votes_and_security_veto(client, monkeypatch):
    async def provider(messages):
        system = messages[0]["content"]
        if "Council judge" in system:
            judge = system.split("Council judge ", 1)[1].split(".", 1)[0]
            verdict = "reject" if judge == "Security" else "approve"
            yield json.dumps(
                {
                    "verdict": verdict,
                    "confidence": 0.91,
                    "reason": "Security policy requires a human approval checkpoint.",
                }
            )
            return
        yield "The Council reviewed the request and recorded its advisory verdict."

    monkeypatch.setattr(runtime, "tokens", provider)
    cid = create(client)
    response = client.post(
        f"/api/conversations/{cid}/live",
        headers=headers(),
        json={
            "content": "Review this change",
            "mode": "council",
            "request_id": str(uuid.uuid4()),
        },
    )
    assert response.status_code == 202
    result = wait_finished(client, cid)[-1]
    council = result["metadata"]["council"]
    assert result["metadata"]["status"] == "completed"
    assert council["decision"] == "reject"
    assert council["security_veto"] is True
    assert len(council["votes"]) == 7
    events = get_store().events(cid, 0)
    assert sum(event["event"] == "council.vote" for event in events) == 7
    assert any(event["event"] == "council.verdict" for event in events)
    decision = client.patch(
        f"/api/conversations/{cid}/messages/{result['id']}/council-decision",
        headers=headers(),
        json={"value": "reject"},
    )
    assert decision.status_code == 200
    assert decision.json()["council"]["human_decision"] == "reject"
    saved = client.get(f"/api/conversations/{cid}", headers=headers()).json()
    assert (
        saved["messages"][-1]["metadata"]["council"]["approval_required"]
        is False
    )
    assert (
        client.patch(
            f"/api/conversations/{cid}/messages/{result['id']}/council-decision",
            headers=headers(),
            json={"value": "approve"},
        ).status_code
        == 422
    )
    assert any(
        event["event"] == "council.human_decision"
        for event in get_store().events(cid, 0)
    )


def test_council_human_approval_can_be_recorded(client):
    cid = create(client)
    owner = owner_id(AuthManager().verify_api_key("alice"))
    assistant = get_store().add_message(
        owner,
        cid,
        "assistant",
        "Council answer",
        metadata={
            "status": "completed",
            "council": {
                "decision": "approve",
                "security_veto": False,
                "approval_required": True,
            },
        },
    )
    response = client.patch(
        f"/api/conversations/{cid}/messages/{assistant['id']}/council-decision",
        headers=headers(),
        json={"value": "approve"},
    )
    assert response.status_code == 200
    assert response.json()["council"]["human_decision"] == "approve"


def test_provider_failure_is_never_demo(client, monkeypatch):
    monkeypatch.delenv("AETHERION_CHAT_MODEL", raising=False)
    cid = create(client)
    client.post(
        f"/api/conversations/{cid}/live",
        headers=headers(),
        json={"content": "Hello", "request_id": str(uuid.uuid4())},
    )
    result = wait_finished(client, cid)[-1]
    assert result["metadata"]["status"] == "failed"
    assert "Configure AETHERION_CHAT_MODEL" in result["content"]
    assert (
        client.post(
            f"/api/conversations/{cid}/live",
            headers=headers(),
            json={
                "content": "Hello",
                "mode": "invalid",
                "request_id": str(uuid.uuid4()),
            },
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"/api/conversations/{cid}/live",
            headers=headers(),
            json={
                "content": "Hello",
                "attachments": [{"name": "too-large.bin", "size": 20_000_001}],
                "request_id": str(uuid.uuid4()),
            },
        ).status_code
        == 422
    )


def test_restart_marks_unfinished_answer(client):
    cid = create(client)
    store = get_store()
    message = store.add_message(
        AuthManager().verify_api_key("alice")["sub"],
        cid,
        "assistant",
        "Saved partial",
        metadata={"status": "running"},
    )
    with store.connect() as db:
        db.execute(
            "INSERT INTO live_runs VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), cid, message["id"], "running"),
        )
    runtime.initialize()
    restored = client.get(
        "/api/conversations/" + cid, headers=headers()
    ).json()["messages"][-1]
    assert restored["content"] == "Saved partial"
    assert restored["metadata"]["status"] == "interrupted"
