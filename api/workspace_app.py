"""Dedicated single-worker workspace service; no simulated model fallback."""
import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends
from api.dependencies import get_current_user
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from core.auth import AuthManager
from api.routers.conversations import get_store, router as conversations
from api.workspace import runtime


@asynccontextmanager
async def lifespan(app):
    auth = AuthManager()
    if not auth.auth_enabled or not auth.api_keys or len(auth.jwt_secret) < 32:
        raise RuntimeError("Workspace service requires authentication, API keys, and a JWT secret of at least 32 characters.")
    runtime.initialize()
    yield
    pending = list(runtime.tasks.values())
    for task in pending:
        task.cancel()
    await asyncio.gather(*pending, return_exceptions=True)


app = FastAPI(title="Aetherion Live Workspace", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[x.strip() for x in os.getenv("AETHERION_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if x.strip()], allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allow_headers=["Authorization", "Content-Type"])
# Mount persistent CRUD and authenticated event routes from the legacy router.
from fastapi import APIRouter
persistent = APIRouter()
persistent.routes = [route for route in conversations.routes if not route.path.endswith(("/messages", "/cancel"))]
app.include_router(persistent, prefix="/api")
app.include_router(runtime.router, prefix="/api")


class Login(BaseModel):
    api_key: str


@app.post("/api/auth/login")
def login(body: Login):
    auth = AuthManager()
    info = auth.verify_api_key(body.api_key)
    if not info:
        raise HTTPException(401, "Invalid API key")
    return {"access_token": auth.generate_jwt(info["sub"], info["role"], auth.jwt_secret), "role": info["role"], "user": {"role": info["role"]}}


@app.get("/health/live")
def health():
    return {
        "status": "alive",
        "demo": False,
        "model_configured": bool(os.getenv("AETHERION_CHAT_MODEL")),
        "modes": ["quick", "standard", "research", "council"],
    }


@app.get("/health/ready")
def readiness():
    auth = AuthManager()
    checks = {
        "auth": bool(
            auth.auth_enabled
            and auth.api_keys
            and len(auth.jwt_secret) >= 32
        ),
        "model": bool(os.getenv("AETHERION_CHAT_MODEL", "").strip()),
        "database": False,
    }
    try:
        with get_store().connect() as db:
            db.execute("SELECT 1").fetchone()
        checks["database"] = True
    except Exception:
        checks["database"] = False
    ready = all(checks.values())
    payload = {
        "status": "ready" if ready else "not_ready",
        "checks": checks,
        "model": os.getenv("AETHERION_CHAT_MODEL", "").strip() or None,
    }
    if not ready:
        raise HTTPException(status_code=503, detail=payload)
    return payload


@app.get("/api/auth/providers")
def providers():
    return {"providers": []}


class IdentityExchange(BaseModel):
    access_token: str = Field(min_length=10, max_length=16000)

@app.post("/api/auth/identity/exchange")
async def exchange(body: IdentityExchange):
    import httpx
    url = os.getenv("AETHERION_SUPABASE_URL", "").rstrip("/")
    key = os.getenv("AETHERION_SUPABASE_PUBLISHABLE_KEY", "")
    if not url.startswith("https://") or not key:
        raise HTTPException(503, "Account sign-in is not configured on this server.")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(url + "/auth/v1/user", headers={"apikey": key, "Authorization": "Bearer " + body.access_token})
        if response.status_code != 200: raise HTTPException(401, "Account verification failed.")
        user = response.json()
    except httpx.HTTPError:
        raise HTTPException(503, "Identity provider is unavailable. Please retry.")
    if not user.get("id") or not (user.get("email_confirmed_at") or user.get("phone_confirmed_at")):
        raise HTTPException(401, "A verified email or phone number is required.")
    # Only administrator-controlled app metadata grants mission permissions.
    role = user.get("app_metadata", {}).get(
        "aetherion_role", os.getenv("AETHERION_IDENTITY_DEFAULT_ROLE", "operator")
    )
    if role not in ("admin", "operator", "viewer"): role = "viewer"
    auth = AuthManager()
    token = auth.generate_jwt("identity:" + user["id"], role, auth.jwt_secret, expires_in_hours=1)
    return {"access_token": token, "role": role}

@app.get("/api/institution/catalog")
def catalog(user=Depends(get_current_user)):
    from institution.registry import CATALOG
    return {"colleges": sorted({a.college for a in CATALOG.values()}), "agents": [{"id": a.id, "college": a.college, "expertise": a.expertise, "version": a.version} for a in CATALOG.values()]}
