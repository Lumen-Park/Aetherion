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
    assert messages[-1]["content"] == "Real protocol test output."
    assert messages[-1]["metadata"]["status"] == "completed"
    events = get_store().events(cid, 0)
    assert sum(e["event"] == "agent.started" for e in events) == 2
    assert any(e["event"] == "message.delta" for e in events)
    assert events[-1]["event"] == "message.finished"


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
