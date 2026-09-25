from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from ..auth import get_current_user

router = APIRouter(tags=["apk"])

_APK = Path("/app/apk/label-app.apk")


@router.get("/download/apk")
async def download_apk(_: str = Depends(get_current_user)):
    if not _APK.exists():
        raise HTTPException(status_code=404, detail="APK not built yet")
    return FileResponse(
        _APK,
        media_type="application/vnd.android.package-archive",
        filename="label-app.apk",
    )


@router.get("/download/apk/info")
async def apk_info(_: str = Depends(get_current_user)):
    if not _APK.exists():
        return {"available": False}
    stat = _APK.stat()
    import datetime
    return {
        "available": True,
        "updated_at": datetime.datetime.fromtimestamp(stat.st_mtime, tz=datetime.timezone.utc).isoformat(),
    }
