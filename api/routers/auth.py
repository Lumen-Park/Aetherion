import os

import httpx
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from core.auth import AuthManager
from core.oauth import OAuthManager

router = APIRouter()

class LoginRequest(BaseModel):
    provider: Optional[str] = None
    code: Optional[str] = None
    api_key: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user: dict


class IdentityExchange(BaseModel):
    access_token: str = Field(min_length=10, max_length=16000)

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    auth = AuthManager()
    
    # OAuth2 callback
    if request.provider and request.code:
        oauth = OAuthManager()
        token = oauth.exchange_code_for_token(request.provider, request.code)
        access_token = token.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="No access token received")
        user_info = oauth.get_user_info(request.provider, access_token)
        # Issue a JWT for subsequent requests
        jwt_token = AuthManager.generate_jwt(
            user_info.get("email", "unknown"), "operator", auth.jwt_secret
        )
        return TokenResponse(
            access_token=jwt_token,
            role="operator",
            user=user_info
        )
    
    # API Key login
    if request.api_key:
        auth_info = auth.verify_api_key(request.api_key)
        if not auth_info:
            raise HTTPException(status_code=401, detail="Invalid API key")
        jwt_token = AuthManager.generate_jwt(
            auth_info["sub"], auth_info["role"], auth.jwt_secret
        )
        return TokenResponse(
            access_token=jwt_token,
            role=auth_info["role"],
            user={"role": auth_info["role"]}
        )
    
    raise HTTPException(status_code=400, detail="Missing provider/code or api_key")

@router.get("/providers")
async def list_providers():
    oauth = OAuthManager()
    return {"providers": list(oauth.providers.keys())}


@router.post("/identity/exchange", response_model=TokenResponse)
async def exchange_identity(body: IdentityExchange):
    """Exchange a verified managed-provider session for an Aetherion token."""
    url = os.getenv("AETHERION_SUPABASE_URL", "").rstrip("/")
    publishable_key = os.getenv("AETHERION_SUPABASE_PUBLISHABLE_KEY", "")
    if not url.startswith("https://") or not publishable_key:
        raise HTTPException(503, "Account sign-in is not configured on this server.")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                url + "/auth/v1/user",
                headers={
                    "apikey": publishable_key,
                    "Authorization": "Bearer " + body.access_token,
                },
            )
    except httpx.HTTPError:
        raise HTTPException(503, "Identity provider is unavailable. Please retry.")
    if response.status_code != 200:
        raise HTTPException(401, "Account verification failed.")
    user = response.json()
    if not user.get("id") or not (
        user.get("email_confirmed_at") or user.get("phone_confirmed_at")
    ):
        raise HTTPException(401, "A verified email or phone number is required.")
    role = user.get("app_metadata", {}).get(
        "aetherion_role", os.getenv("AETHERION_IDENTITY_DEFAULT_ROLE", "operator")
    )
    if role not in ("admin", "operator", "viewer"):
        role = "viewer"
    auth = AuthManager()
    token = auth.generate_jwt(
        "identity:" + user["id"], role, auth.jwt_secret, expires_in_hours=1
    )
    return TokenResponse(
        access_token=token,
        role=role,
        user={"id": user["id"], "email": user.get("email")},
    )

@router.get("/login/{provider}")
async def login_redirect(provider: str):
    oauth = OAuthManager()
    url = oauth.get_authorization_url(provider)
    return {"url": url}
