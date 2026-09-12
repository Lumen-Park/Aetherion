"""
Authentication & Authorization Manager
Supports API Key, JWT, and OAuth2/OIDC token validation.
"""

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

try:
    import jwt

    JWT_AVAILABLE = True
except ImportError:
    JWT_AVAILABLE = False


class AuthManager:
    """Handles authentication and authorization for Aetherion operations."""

    def __init__(self):
        self.auth_enabled = (
            os.getenv("AETHERION_REQUIRE_AUTH", "false").lower() == "true"
        )
        self.api_keys = self._load_api_keys()
        self.jwt_secret = os.getenv("AETHERION_JWT_SECRET", "")

    def _load_api_keys(self) -> Dict[str, Dict[str, Any]]:
        """Load API keys from environment or config file."""
        keys = {}
        # Format: AETHERION_API_KEYS="key1:admin,key2:operator"
        key_string = os.getenv("AETHERION_API_KEYS", "")
        if key_string:
            for item in key_string.split(","):
                if ":" in item:
                    key, role = item.split(":", 1)
                    keys[self._hash_key(key.strip())] = {
                        "role": role.strip(),
                        "created": datetime.now(timezone.utc).isoformat(),
                    }
        return keys

    @staticmethod
    def _hash_key(key: str) -> str:
        """Hash an API key for secure storage."""
        return hashlib.sha256(key.encode()).hexdigest()

    def verify_api_key(self, api_key: str) -> Optional[Dict[str, Any]]:
        """Verify an API key and return its associated metadata."""
        if not api_key:
            return None
        hashed = self._hash_key(api_key)
        info = self.api_keys.get(hashed)
        return {**info, "sub": "api-key:" + hashed} if info else None

    def verify_jwt(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify a JWT token and return its payload."""
        if not JWT_AVAILABLE or not self.jwt_secret:
            return None
        try:
            payload = jwt.decode(token, self.jwt_secret, algorithms=["HS256"])
            return payload
        except Exception:
            return None

    def authenticate_oauth(
        self, provider_name: str, access_token: str
    ) -> Optional[Dict[str, Any]]:
        """
        Authenticate using an OAuth2 access token.
        Returns user info with role mapping if successful.
        """
        if not self.auth_enabled:
            return {"role": "admin", "auth_disabled": True}

        try:
            from core.oauth import OAuthManager

            oauth = OAuthManager()
            user_info = oauth.get_user_info(provider_name, access_token)
            # Map OAuth user to a role (default to operator)
            return {
                "sub": user_info.get("sub") or user_info.get("id"),
                "email": user_info.get("email"),
                "name": user_info.get("name"),
                "role": "operator",
                "provider": provider_name,
            }
        except Exception:
            return None

    def authenticate(
        self, auth_token: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Main authentication entry point.
        Returns user/role info if authenticated, None otherwise.
        Supports: API keys, JWT, and OAuth2 tokens (format: oauth2:provider:token)
        """
        if not self.auth_enabled:
            return {"role": "admin", "auth_disabled": True}

        if not auth_token:
            return None

        # 1. Try API key
        api_key_info = self.verify_api_key(auth_token)
        if api_key_info:
            return api_key_info

        # 2. Try JWT
        jwt_payload = self.verify_jwt(auth_token)
        if jwt_payload:
            return jwt_payload

        # 3. Try OAuth2 Bearer token (format: "oauth2:provider:token")
        if auth_token.startswith("oauth2:"):
            parts = auth_token.split(":", 2)
            if len(parts) == 3:
                _, provider, token = parts
                return self.authenticate_oauth(provider, token)

        return None

    def authorize(
        self, auth_info: Dict[str, Any], required_role: str = "operator"
    ) -> bool:
        """
        Check if authenticated identity has the required role.
        Roles: admin > operator > viewer
        """
        if not self.auth_enabled:
            return True

        role = auth_info.get("role", "viewer")
        role_hierarchy = {"admin": 3, "operator": 2, "viewer": 1}
        required_level = role_hierarchy.get(required_role, 1)
        user_level = role_hierarchy.get(role, 0)
        return user_level >= required_level

    @classmethod
    def generate_api_key(cls) -> str:
        """Generate a new secure API key."""
        return secrets.token_urlsafe(32)

    @classmethod
    def generate_jwt(
        cls, user_id: str, role: str, secret: str, expires_in_hours: int = 24
    ) -> str:
        """Generate a JWT token for a user."""
        if not JWT_AVAILABLE:
            raise ImportError("PyJWT not installed. Run: pip install PyJWT")
        payload = {
            "sub": user_id,
            "role": role,
            "exp": datetime.now(timezone.utc)
            + timedelta(hours=expires_in_hours),
            "iat": datetime.now(timezone.utc),
        }
        return jwt.encode(payload, secret, algorithm="HS256")
