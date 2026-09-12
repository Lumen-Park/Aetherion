"""Lazy core exports keep optional integrations optional."""

import importlib

_EXPORTS = {
    "AuthManager": "core.auth",
    "AgentReputation": "core.memory",
    "Archivist": "core.memory",
    "KnowledgeGraph": "core.memory",
    "MemoryEntry": "core.memory",
    "OAuthManager": "core.oauth",
    "OIDCProvider": "core.oauth",
    "AgentMessage": "core.protocol",
    "LLMWrapper": "core.protocol",
    "Priority": "core.protocol",
    "StrictLLMWrapper": "core.protocol",
    "ToolEnabledLLMWrapper": "core.protocol",
    "Verdict": "core.protocol",
    "VALID_TRANSITIONS": "core.task_state",
    "TaskContext": "core.task_state",
    "TaskState": "core.task_state",
    "TaskStateManager": "core.task_state",
    "WorkspaceManager": "core.workspace",
}
__all__ = list(_EXPORTS)


def __getattr__(name):
    if name not in _EXPORTS:
        raise AttributeError(name)
    value = getattr(importlib.import_module(_EXPORTS[name]), name)
    globals()[name] = value
    return value
