import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.inventory import next_inventory_number


# Python 3.13: AsyncMock child mocks are also AsyncMock, so we must pin
# execute.return_value to MagicMock explicitly; otherwise scalar_one() is async.


@pytest.mark.asyncio
async def test_increments_from_zero():
    counter = MagicMock(last_number=0)
    db = AsyncMock()
    db.execute.return_value = MagicMock()
    db.execute.return_value.scalar_one.return_value = counter
    result = await next_inventory_number(db)
    assert result == "0001"
    assert counter.last_number == 1


@pytest.mark.asyncio
async def test_increments_from_middle():
    counter = MagicMock(last_number=42)
    db = AsyncMock()
    db.execute.return_value = MagicMock()
    db.execute.return_value.scalar_one.return_value = counter
    result = await next_inventory_number(db)
    assert result == "0043"


@pytest.mark.asyncio
async def test_wraps_at_9999():
    counter = MagicMock(last_number=9999)
    db = AsyncMock()
    db.execute.return_value = MagicMock()
    db.execute.return_value.scalar_one.return_value = counter
    result = await next_inventory_number(db)
    assert result == "0001"
    assert counter.last_number == 1


@pytest.mark.asyncio
async def test_zero_pads_to_four_digits():
    counter = MagicMock(last_number=8)
    db = AsyncMock()
    db.execute.return_value = MagicMock()
    db.execute.return_value.scalar_one.return_value = counter
    result = await next_inventory_number(db)
    assert result == "0009"
