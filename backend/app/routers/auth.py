from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..auth import verify_user, create_token

router = APIRouter(prefix="/auth", tags=["auth"])


class TokenRequest(BaseModel):
    username: str
    password: str


@router.post("/token")
def login(body: TokenRequest):
    if not verify_user(body.username, body.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token, expires_at = create_token(body.username)
    return {"token": token, "expires_at": expires_at}
