"""API exports loaded only when requested."""
import importlib
__all__ = ["app", "auth", "tasks", "agents", "council", "websocket", "oauth_routes"]
def __getattr__(name):
    if name == "app":
        return importlib.import_module("api.main").app
    if name in __all__:
        return importlib.import_module("api.routers." + name)
    raise AttributeError(name)
