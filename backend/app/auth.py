import base64, hashlib, hmac, json, time
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from passlib.context import CryptContext

if "settings" not in globals():
    from .config import settings  # type: ignore[name-defined]

security = HTTPBasic(auto_error=False)
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

_USERS: dict[str, str] = {
    settings.app_user_1: _pwd.hash(settings.app_pass_1),  # type: ignore[name-defined]
    settings.app_user_2: _pwd.hash(settings.app_pass_2),  # type: ignore[name-defined]
}


def verify_user(username: str, password: str) -> str | None:
    hashed = _USERS.get(username)
    if hashed and _pwd.verify(password, hashed):
        return username
    return None


# ── token helpers (stdlib only, no new deps) ──────────────────────────────────

def _secret() -> bytes:
    # Stable secret derived from existing app passwords; rotates if passwords change
    return hmac.new(
        b"label-system-token-v1",
        (settings.app_pass_1 + settings.app_pass_2).encode(),  # type: ignore[name-defined]
        hashlib.sha256,
    ).digest()


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "==")


def create_token(username: str, days: int = 90) -> tuple[str, str]:
    exp = int(time.time()) + days * 86400
    payload = json.dumps({"u": username, "exp": exp}).encode()
    sig = hmac.new(_secret(), payload, hashlib.sha256).digest()
    token = f"{_b64(payload)}.{_b64(sig)}"
    expires_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(exp))
    return token, expires_at


def verify_token(token: str) -> str | None:
    try:
        head, raw_sig = token.split(".", 1)
        payload_bytes = _unb64(head)
        expected = hmac.new(_secret(), payload_bytes, hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _unb64(raw_sig)):
            return None
        data = json.loads(payload_bytes)
        if data["exp"] < time.time():
            return None
        if data["u"] not in _USERS:
            return None
        return data["u"]
    except Exception:
        return None


# ── FastAPI dependency ─────────────────────────────────────────────────────────

def get_current_user(
    request: Request,
    credentials: Optional[HTTPBasicCredentials] = Depends(security),
) -> str:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        user = verify_token(auth_header[7:])
        if user:
            return user
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            headers={"WWW-Authenticate": "Bearer"})
    if credentials:
        user = verify_user(credentials.username, credentials.password)
        if user:
            return user
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                        headers={"WWW-Authenticate": "Basic"})
