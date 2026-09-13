from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..models import InventoryCounter


async def next_inventory_number(db: AsyncSession) -> str:
    result = await db.execute(
        select(InventoryCounter).where(InventoryCounter.id == 1).with_for_update()
    )
    counter = result.scalar_one()
    next_num = (counter.last_number % 9999) + 1
    counter.last_number = next_num
    await db.flush()
    return f"{next_num:04d}"
