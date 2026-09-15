import base64
import logging
import re
import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.security import HTTPBasicCredentials
from pydantic import BaseModel

from ..schemas import IconInfo
from ..auth import get_current_user, security
from ..config import settings

logger = logging.getLogger(__name__)

_SAFE_FILENAME = re.compile(r"^[\w.-]+\.png$")

router = APIRouter(prefix="/icons", tags=["icons"])

ICONS_DIR = Path(__file__).parent.parent.parent / "assets" / "icons"
GENERATED_DIR = ICONS_DIR / "generated"


@router.get("", response_model=list[IconInfo])
async def list_icons(current_user: str = Depends(get_current_user)):
    entries = [
        IconInfo(filename=f.name)
        for f in sorted(ICONS_DIR.iterdir())
        if f.suffix.lower() == ".png" and f.name != "reference-sheet.png"
    ]
    if GENERATED_DIR.exists():
        entries += [
            IconInfo(filename=f"generated/{f.name}")
            for f in sorted(GENERATED_DIR.iterdir())
            if f.suffix.lower() == ".png"
        ]
    return entries


class GenerateRequest(BaseModel):
    dish_name: str
    force: bool = False


class GenerateResponse(BaseModel):
    filename: str
    exists: bool
    image_b64: str


async def _push_to_remote(filename: str, png_bytes: bytes, credentials: HTTPBasicCredentials) -> None:
    """Upload generated icon to remote backend so VPS can serve it."""
    token = base64.b64encode(f"{credentials.username}:{credentials.password}".encode()).decode()
    url = settings.remote_backend_url.rstrip("/") + f"/api/icons/generated/{filename}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.put(url, content=png_bytes,
                                headers={"Authorization": f"Basic {token}",
                                         "Content-Type": "image/png"})
    if resp.status_code >= 400:
        raise RuntimeError(f"HTTP {resp.status_code}")


@router.put("/generated/{filename}", status_code=204)
async def upload_generated_icon(
    filename: str,
    request: Request,
    _: str = Depends(get_current_user),
):
    """Receive a generated icon uploaded from a local machine."""
    if not _SAFE_FILENAME.match(filename):
        raise HTTPException(status_code=400, detail="Invalid filename")
    GENERATED_DIR.mkdir(exist_ok=True)
    (GENERATED_DIR / filename).write_bytes(await request.body())


@router.post("/generate", response_model=GenerateResponse)
async def generate_icon(
    body: GenerateRequest,
    credentials: HTTPBasicCredentials = Depends(security),
    _: str = Depends(get_current_user),
):
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY not configured")

    from ..services.icon_generator import slug, generate

    GENERATED_DIR.mkdir(exist_ok=True)
    name_slug = slug(body.dish_name)

    if not body.force:
        for existing in sorted(GENERATED_DIR.glob(f"{name_slug}-*.png")):
            png_cached = existing.read_bytes()
            if settings.remote_backend_url:
                try:
                    await _push_to_remote(existing.name, png_cached, credentials)
                except Exception as exc:
                    logger.warning("Failed to sync cached icon to remote backend: %s", exc)
            return GenerateResponse(
                filename=f"generated/{existing.name}",
                exists=True,
                image_b64=base64.b64encode(png_cached).decode(),
            )

    try:
        png_bytes = generate(
            dish_name=body.dish_name,
            api_key=settings.openai_api_key,
            model=settings.openai_image_model,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Image generation failed: {exc}")

    filename = f"{name_slug}-{uuid.uuid4().hex[:6]}.png"
    (GENERATED_DIR / filename).write_bytes(png_bytes)

    if settings.remote_backend_url:
        try:
            await _push_to_remote(filename, png_bytes, credentials)
        except Exception as exc:
            logger.warning("Failed to sync icon to remote backend: %s", exc)

    return GenerateResponse(
        filename=f"generated/{filename}",
        exists=False,
        image_b64=base64.b64encode(png_bytes).decode(),
    )


@router.get("/{filename:path}")
async def get_icon(filename: str):
    path = (ICONS_DIR / filename).resolve()
    if not path.is_relative_to(ICONS_DIR.resolve()):
        raise HTTPException(status_code=404, detail="Not found")
    if not path.exists() or path.suffix.lower() != ".png":
        raise HTTPException(status_code=404)
    return FileResponse(path, media_type="image/png")
