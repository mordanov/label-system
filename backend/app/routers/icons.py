import base64
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ..schemas import IconInfo
from ..auth import get_current_user
from ..config import settings

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


class GenerateResponse(BaseModel):
    filename: str
    exists: bool
    image_b64: str


@router.post("/generate", response_model=GenerateResponse)
async def generate_icon(
    body: GenerateRequest,
    current_user: str = Depends(get_current_user),
):
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY not configured")

    from ..services.icon_generator import slug, generate

    GENERATED_DIR.mkdir(exist_ok=True)
    name_slug = slug(body.dish_name)

    for existing in sorted(GENERATED_DIR.glob(f"{name_slug}-*.png")):
        img_b64 = base64.b64encode(existing.read_bytes()).decode()
        return GenerateResponse(
            filename=f"generated/{existing.name}",
            exists=True,
            image_b64=img_b64,
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
