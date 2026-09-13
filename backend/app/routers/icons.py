from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from ..schemas import IconInfo
from ..auth import get_current_user

router = APIRouter(prefix="/icons", tags=["icons"])

ICONS_DIR = Path(__file__).parent.parent.parent / "assets" / "icons"


@router.get("/", response_model=list[IconInfo])
async def list_icons(current_user: str = Depends(get_current_user)):
    return [
        IconInfo(filename=f.name)
        for f in sorted(ICONS_DIR.iterdir())
        if f.suffix.lower() == ".png"
    ]


@router.get("/{filename}")
async def get_icon(filename: str):
    # Prevent path traversal
    path = (ICONS_DIR / filename).resolve()
    if not path.is_relative_to(ICONS_DIR.resolve()):
        raise HTTPException(status_code=404, detail="Not found")
    if not path.exists() or path.suffix.lower() != ".png":
        raise HTTPException(status_code=404)
    return FileResponse(path, media_type="image/png")
