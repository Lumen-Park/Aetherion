"""Persistent, workspace-isolated conversations for the Chief of Staff UI."""

import asyncio
import json
import os
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from api.dependencies import get_current_user, require_role

router = APIRouter()


class ConversationCreate(BaseModel):
    title: str = Field(default="New conversation", max_length=160)


class ConversationUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=160)


class ConversationBranch(BaseModel):
    message_id: str = Field(min_length=1, max_length=80)


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=50_000)
    mode: str = Field(
        default="standard", pattern="^(quick|standard|research|council)$"
    )
    attachments: List[Dict[str, Any]] = Field(default_factory=list)


class MessageFeedback(BaseModel):
    value: Optional[str] = Field(default=None, pattern="^(up|down)$")


class DraftUpdate(BaseModel):
    content: str = Field(default="", max_length=16_000)


class ConversationStore:
    """Small SQLite event store; safe for multiple API threads and restarts."""

    def __init__(self, path: str):
        self.path = path
        self._lock = threading.RLock()
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        self._initialize()

    @contextmanager
    def connect(self):
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def _initialize(self):
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY, owner TEXT NOT NULL, title TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'ready', created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS conversations_owner_updated
                    ON conversations(owner, updated_at DESC);
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL,
                    content TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'text',
                    metadata TEXT NOT NULL DEFAULT '{}', created_at REAL NOT NULL,
                    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS conversation_events (
                    sequence INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT NOT NULL,
                    event TEXT NOT NULL, payload TEXT NOT NULL, created_at REAL NOT NULL,
                    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS conversation_drafts (
                    conversation_id TEXT PRIMARY KEY, owner TEXT NOT NULL,
                    content TEXT NOT NULL DEFAULT '', updated_at REAL NOT NULL,
                    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
                );
                """)

    @staticmethod
    def _conversation(row, messages=None):
        result = dict(row)
        if messages is not None:
            result["messages"] = messages
        return result

    def create(self, owner: str, title: str):
        now, conversation_id = time.time(), str(uuid.uuid4())
        with self._lock, self.connect() as db:
            db.execute(
                "INSERT INTO conversations VALUES (?, ?, ?, 'ready', ?, ?)",
                (
                    conversation_id,
                    owner,
                    title.strip() or "New conversation",
                    now,
                    now,
                ),
            )
            row = db.execute(
                "SELECT * FROM conversations WHERE id = ?", (conversation_id,)
            ).fetchone()
        return self._conversation(row, [])

    def list(self, owner: str):
        with self.connect() as db:
            rows = db.execute(
                "SELECT * FROM conversations WHERE owner = ? ORDER BY updated_at DESC",
                (owner,),
            ).fetchall()
        return [self._conversation(row) for row in rows]

    def get(self, owner: str, conversation_id: str):
        with self.connect() as db:
            db.execute("BEGIN")
            row = db.execute(
                "SELECT * FROM conversations WHERE id = ? AND owner = ?",
                (conversation_id, owner),
            ).fetchone()
            if not row:
                return None
            messages = [
                dict(item)
                for item in db.execute(
                    "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at",
                    (conversation_id,),
                ).fetchall()
            ]
            sequence = db.execute("SELECT COALESCE(MAX(sequence), 0) FROM conversation_events WHERE conversation_id=?", (conversation_id,)).fetchone()[0]
        for message in messages:
            message["metadata"] = json.loads(message["metadata"])
        result = self._conversation(row, messages)
        result["last_event_sequence"] = sequence
        return result

    def rename(self, owner: str, conversation_id: str, title: str):
        with self._lock, self.connect() as db:
            cursor = db.execute(
                "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND owner = ?",
                (title.strip(), time.time(), conversation_id, owner),
            )
        return cursor.rowcount > 0

    def delete(self, owner: str, conversation_id: str):
        with self._lock, self.connect() as db:
            cursor = db.execute(
                "DELETE FROM conversations WHERE id = ? AND owner = ?",
                (conversation_id, owner),
            )
        return cursor.rowcount > 0

    def branch(self, owner: str, conversation_id: str, message_id: str):
        with self._lock, self.connect() as db:
            source = db.execute(
                "SELECT id, title FROM conversations WHERE id = ? AND owner = ?",
                (conversation_id, owner),
            ).fetchone()
            if not source:
                return None
            target = db.execute(
                "SELECT id, role, metadata FROM messages WHERE id = ? AND conversation_id = ?",
                (message_id, conversation_id),
            ).fetchone()
            if not target:
                raise KeyError("Message not found")
            if target["role"] != "assistant":
                raise ValueError("Branches must start from an assistant response")
            try:
                target_metadata = json.loads(target["metadata"] or "{}")
            except (TypeError, json.JSONDecodeError):
                target_metadata = {}
            if target_metadata.get("status") == "running":
                raise RuntimeError("Wait for the response to finish before branching")
            source_messages = db.execute(
                "SELECT id, role, content, kind, metadata FROM messages WHERE conversation_id = ? ORDER BY created_at, rowid",
                (conversation_id,),
            ).fetchall()
            branch_messages = []
            for item in source_messages:
                branch_messages.append(item)
                if item["id"] == message_id:
                    break
            if not branch_messages or branch_messages[-1]["id"] != message_id:
                raise KeyError("Message not found")
            branch_id, now = str(uuid.uuid4()), time.time()
            title = f"Branch · {source['title']}"[:160]
            db.execute(
                "INSERT INTO conversations VALUES (?, ?, ?, 'ready', ?, ?)",
                (branch_id, owner, title, now, now),
            )
            for index, item in enumerate(branch_messages):
                db.execute(
                    "INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (
                        str(uuid.uuid4()),
                        branch_id,
                        item["role"],
                        item["content"],
                        item["kind"],
                        item["metadata"],
                        now + (index * 0.000001),
                    ),
                )
        self.emit(
            branch_id,
            "conversation.branched",
            {
                "source_conversation_id": conversation_id,
                "source_message_id": message_id,
            },
        )
        return self.get(owner, branch_id)

    def add_message(
        self,
        owner: str,
        conversation_id: str,
        role: str,
        content: str,
        kind="text",
        metadata=None,
    ):
        message_id, now = str(uuid.uuid4()), time.time()
        with self._lock, self.connect() as db:
            exists = db.execute(
                "SELECT 1 FROM conversations WHERE id = ? AND owner = ?",
                (conversation_id, owner),
            ).fetchone()
            if not exists:
                return None
            db.execute(
                "INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    message_id,
                    conversation_id,
                    role,
                    content,
                    kind,
                    json.dumps(metadata or {}),
                    now,
                ),
            )
            db.execute(
                "UPDATE conversations SET updated_at = ? WHERE id = ?",
                (now, conversation_id),
            )
        return {
            "id": message_id,
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "kind": kind,
            "metadata": metadata or {},
            "created_at": now,
        }

    def set_feedback(
        self, owner: str, conversation_id: str, message_id: str, value: Optional[str]
    ):
        with self._lock, self.connect() as db:
            row = db.execute(
                """
                SELECT m.role, m.metadata
                FROM messages AS m
                JOIN conversations AS c ON c.id = m.conversation_id
                WHERE m.id = ? AND m.conversation_id = ? AND c.owner = ?
                """,
                (message_id, conversation_id, owner),
            ).fetchone()
            if not row or row["role"] != "assistant":
                return False, None
            try:
                metadata = json.loads(row["metadata"] or "{}")
            except (TypeError, json.JSONDecodeError):
                metadata = {}
            if value is None:
                metadata.pop("feedback", None)
            else:
                metadata["feedback"] = value
            db.execute(
                "UPDATE messages SET metadata = ? WHERE id = ? AND conversation_id = ?",
                (json.dumps(metadata), message_id, conversation_id),
            )
        return True, value

    def get_draft(self, owner: str, conversation_id: str):
        with self.connect() as db:
            conversation = db.execute(
                "SELECT 1 FROM conversations WHERE id = ? AND owner = ?",
                (conversation_id, owner),
            ).fetchone()
            if not conversation:
                return None
            row = db.execute(
                "SELECT content, updated_at FROM conversation_drafts WHERE conversation_id = ? AND owner = ?",
                (conversation_id, owner),
            ).fetchone()
        return {
            "conversation_id": conversation_id,
            "content": row["content"] if row else "",
            "updated_at": row["updated_at"] if row else None,
        }

    def set_draft(self, owner: str, conversation_id: str, content: str):
        now = time.time()
        with self._lock, self.connect() as db:
            conversation = db.execute(
                "SELECT 1 FROM conversations WHERE id = ? AND owner = ?",
                (conversation_id, owner),
            ).fetchone()
            if not conversation:
                return None
            if content.strip():
                db.execute(
                    """
                    INSERT INTO conversation_drafts(conversation_id, owner, content, updated_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(conversation_id) DO UPDATE SET
                        owner=excluded.owner, content=excluded.content, updated_at=excluded.updated_at
                    """,
                    (conversation_id, owner, content, now),
                )
            else:
                db.execute(
                    "DELETE FROM conversation_drafts WHERE conversation_id = ? AND owner = ?",
                    (conversation_id, owner),
                )
        return {
            "conversation_id": conversation_id,
            "content": content if content.strip() else "",
            "updated_at": now,
        }

    def emit(self, conversation_id: str, event: str, payload: Dict[str, Any]):
        with self._lock, self.connect() as db:
            cursor = db.execute(
                "INSERT INTO conversation_events(conversation_id, event, payload, created_at) VALUES (?, ?, ?, ?)",
                (conversation_id, event, json.dumps(payload), time.time()),
            )
        return cursor.lastrowid

    def events(self, conversation_id: str, after: int):
        with self.connect() as db:
            return [
                dict(row)
                for row in db.execute(
                    "SELECT * FROM conversation_events WHERE conversation_id = ? AND sequence > ? ORDER BY sequence",
                    (conversation_id, after),
                ).fetchall()
            ]


_stores = {}


def get_store():
    path = os.getenv(
        "AETHERION_CONVERSATIONS_DB", "./data/conversations.sqlite3"
    )
    if path not in _stores:
        _stores[path] = ConversationStore(path)
    return _stores[path]


def owner_id(user: dict):
    if user.get("auth_disabled"):
        return "local-admin"
    identity = user.get("sub") or user.get("email")
    if not identity or identity == "api_key_user":
        raise HTTPException(status_code=401, detail="Identity is missing; sign in again")
    return str(identity)


def chief_response(request: MessageCreate):
    teams = {
        "quick": ["Chief of Staff"],
        "standard": ["Strategy Agent", "Delivery Agent", "Security Agent"],
        "research": [
            "Research Lead",
            "Evidence Analyst",
            "Contrarian Reviewer",
        ],
        "council": [
            "Chief of Staff",
            "Supreme Council",
            "Constitution Auditor",
        ],
    }
    return {
        "summary": "I have accepted the mission and assembled the smallest capable team.",
        "mode": request.mode,
        "delegates": teams[request.mode],
        "next_action": "The live execution stream will report each governed handoff.",
        "requires_approval": request.mode == "council",
    }


@router.get("/conversations")
def list_conversations(user=Depends(get_current_user)):
    return {"conversations": get_store().list(owner_id(user))}


@router.post("/conversations", status_code=201)
def create_conversation(
    request: ConversationCreate, user=Depends(require_role("operator"))
):
    return get_store().create(owner_id(user), request.title)


@router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str, user=Depends(get_current_user)):
    result = get_store().get(owner_id(user), conversation_id)
    if not result:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return result


@router.get("/conversations/{conversation_id}/draft")
def get_conversation_draft(conversation_id: str, user=Depends(get_current_user)):
    result = get_store().get_draft(owner_id(user), conversation_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return result


@router.put("/conversations/{conversation_id}/draft")
def update_conversation_draft(
    conversation_id: str,
    request: DraftUpdate,
    user=Depends(require_role("operator")),
):
    result = get_store().set_draft(
        owner_id(user), conversation_id, request.content
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return result


@router.patch("/conversations/{conversation_id}/messages/{message_id}/feedback")
def update_message_feedback(
    conversation_id: str,
    message_id: str,
    request: MessageFeedback,
    user=Depends(require_role("operator")),
):
    found, value = get_store().set_feedback(
        owner_id(user), conversation_id, message_id, request.value
    )
    if not found:
        raise HTTPException(status_code=404, detail="Assistant message not found")
    return {"message_id": message_id, "feedback": value}


@router.patch("/conversations/{conversation_id}")
def update_conversation(
    conversation_id: str,
    request: ConversationUpdate,
    user=Depends(require_role("operator")),
):
    if not get_store().rename(owner_id(user), conversation_id, request.title):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "updated"}


@router.post("/conversations/{conversation_id}/branch", status_code=201)
def branch_conversation(
    conversation_id: str,
    request: ConversationBranch,
    user=Depends(require_role("operator")),
):
    try:
        result = get_store().branch(
            owner_id(user), conversation_id, request.message_id
        )
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    if not result:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return result


@router.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation(
    conversation_id: str, user=Depends(require_role("operator"))
):
    if not get_store().delete(owner_id(user), conversation_id):
        raise HTTPException(status_code=404, detail="Conversation not found")


@router.post("/conversations/{conversation_id}/messages", status_code=201)
def create_message(
    conversation_id: str,
    request: MessageCreate,
    user=Depends(require_role("operator")),
):
    store, owner = get_store(), owner_id(user)
    message = store.add_message(
        owner,
        conversation_id,
        "user",
        request.content,
        metadata={"mode": request.mode, "attachments": request.attachments},
    )
    if not message:
        raise HTTPException(status_code=404, detail="Conversation not found")
    plan = chief_response(request)
    store.emit(
        conversation_id,
        "mission.accepted",
        {"message_id": message["id"], **plan},
    )
    assistant = store.add_message(
        owner,
        conversation_id,
        "assistant",
        json.dumps(plan),
        kind="mission_plan",
        metadata=plan,
    )
    store.emit(conversation_id, "message.completed", assistant)
    return {
        "user_message": message,
        "assistant_message": assistant,
        "plan": plan,
    }


@router.post("/conversations/{conversation_id}/cancel")
def cancel_conversation(
    conversation_id: str, user=Depends(require_role("operator"))
):
    store = get_store()
    if not store.get(owner_id(user), conversation_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    store.emit(
        conversation_id, "mission.cancelled", {"reason": "operator_request"}
    )
    return {"status": "cancelled"}


@router.get("/conversations/{conversation_id}/events")
async def stream_events(
    conversation_id: str,
    after: int = Query(default=0, ge=0),
    user=Depends(get_current_user),
):
    store = get_store()
    if not store.get(owner_id(user), conversation_id):
        raise HTTPException(status_code=404, detail="Conversation not found")

    async def event_source():
        cursor, idle = after, 0
        while idle < 30:
            events = store.events(conversation_id, cursor)
            if events:
                idle = 0
                for event in events:
                    cursor = event["sequence"]
                    yield f"id: {cursor}\nevent: {event['event']}\ndata: {event['payload']}\n\n"
            else:
                idle += 1
                yield ": heartbeat\n\n"
            await asyncio.sleep(1)

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
