import json

from api.routers.conversations import (
    ConversationStore,
    MessageCreate,
    chief_response,
)


def test_conversation_lifecycle_is_persistent_and_owner_isolated(tmp_path):
    store = ConversationStore(str(tmp_path / "conversations.sqlite3"))
    conversation = store.create("operator-a", "Launch plan")

    assert store.list("operator-a")[0]["title"] == "Launch plan"
    assert store.list("operator-b") == []

    message = store.add_message(
        "operator-a",
        conversation["id"],
        "user",
        "Build the smallest safe release",
        metadata={"mode": "standard"},
    )
    assert message["role"] == "user"
    assert (
        store.add_message("operator-b", conversation["id"], "user", "no")
        is None
    )

    restored = store.get("operator-a", conversation["id"])
    assert restored["messages"][0]["metadata"] == {"mode": "standard"}
    assert (
        store.rename("operator-a", conversation["id"], "Pilot release") is True
    )
    assert store.delete("operator-b", conversation["id"]) is False
    assert store.delete("operator-a", conversation["id"]) is True


def test_events_are_ordered_and_resumable(tmp_path):
    store = ConversationStore(str(tmp_path / "events.sqlite3"))
    conversation = store.create("operator", "Council review")
    first = store.emit(
        conversation["id"], "agent.started", {"agent": "Security"}
    )
    second = store.emit(
        conversation["id"], "agent.completed", {"agent": "Security"}
    )

    assert second > first
    events = store.events(conversation["id"], first)
    assert [event["event"] for event in events] == ["agent.completed"]
    assert json.loads(events[0]["payload"])["agent"] == "Security"


def test_branch_clones_history_through_selected_assistant_response(tmp_path):
    store = ConversationStore(str(tmp_path / "branches.sqlite3"))
    conversation = store.create("operator", "Release mission")
    first_user = store.add_message(
        "operator", conversation["id"], "user", "Plan the release"
    )
    first_assistant = store.add_message(
        "operator",
        conversation["id"],
        "assistant",
        "Release plan",
        metadata={"status": "completed", "mode": "standard"},
    )
    store.add_message("operator", conversation["id"], "user", "Add rollback")

    branch = store.branch("operator", conversation["id"], first_assistant["id"])

    assert branch["id"] != conversation["id"]
    assert branch["title"] == "Branch · Release mission"
    assert [item["content"] for item in branch["messages"]] == [
        first_user["content"],
        first_assistant["content"],
    ]
    assert all(
        item["id"] not in {first_user["id"], first_assistant["id"]}
        for item in branch["messages"]
    )
    assert store.branch("other", conversation["id"], first_assistant["id"]) is None


def test_chief_of_staff_routes_each_mode():
    for mode in ("quick", "standard", "research", "council"):
        plan = chief_response(
            MessageCreate(content="Help me decide", mode=mode)
        )
        assert plan["mode"] == mode
        assert plan["delegates"]
    assert (
        chief_response(MessageCreate(content="Vote", mode="council"))[
            "requires_approval"
        ]
        is True
    )
