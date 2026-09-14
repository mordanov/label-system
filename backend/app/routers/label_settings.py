from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..auth import get_current_user
from ..database import get_db
from ..models import UserLabelSettings
from ..schemas import LabelLayout

router = APIRouter(prefix="/label-settings", tags=["label-settings"])


@router.get("", response_model=LabelLayout)
async def get_settings(
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(UserLabelSettings, current_user)
    if row is None:
        return LabelLayout()
    return LabelLayout(**(row.settings or {}))


@router.put("", response_model=LabelLayout)
async def save_settings(
    layout: LabelLayout,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    async with db.begin():
        row = await db.get(UserLabelSettings, current_user)
        if row is None:
            db.add(UserLabelSettings(username=current_user, settings=layout.model_dump()))
        else:
            row.settings = layout.model_dump()
    return layout
