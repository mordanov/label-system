from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from passlib.context import CryptContext

# Import settings only on first load; reload retains module __dict__, so a
# test can patch app.auth.settings then call importlib.reload(app.auth) to
# rebuild _USERS with the mocked values without this clobbering the mock.
if "settings" not in globals():
    from .config import settings  # type: ignore[name-defined]

security = HTTPBasic()
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Hashed at startup; env vars are source of truth
_USERS: dict[str, str] = {
    settings.app_user_1: _pwd.hash(settings.app_pass_1),  # type: ignore[name-defined]
    settings.app_user_2: _pwd.hash(settings.app_pass_2),  # type: ignore[name-defined]
}


def verify_user(username: str, password: str) -> str | None:
    hashed = _USERS.get(username)
    if hashed and _pwd.verify(password, hashed):
        return username
    return None


def get_current_user(credentials: HTTPBasicCredentials = Depends(security)) -> str:
    user = verify_user(credentials.username, credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            headers={"WWW-Authenticate": "Basic"},
        )
    return user
