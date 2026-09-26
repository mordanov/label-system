import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import uuid
from datetime import datetime, timezone


@pytest.mark.asyncio
async def test_restore_clears_deleted_fields():
    from app.routers.products import restore_product
    product = MagicMock()
    product.id = uuid.uuid4()
    product.is_deleted = True
    product.deleted_at = datetime.now(timezone.utc)
    product.deleted_by = "alice"
    product.inventory_number = "0001"
    product.name = "Test"
    product.icon_filename = "apple.png"
    product.units = None
    product.created_at = datetime.now(timezone.utc)

    db = AsyncMock()
    db.get = AsyncMock(return_value=product)
    db.begin = MagicMock(return_value=AsyncMock(__aenter__=AsyncMock(return_value=None), __aexit__=AsyncMock(return_value=None)))

    with patch("app.routers.products.ProductResponse") as mock_schema:
        mock_schema.model_validate.return_value = MagicMock()
        await restore_product(product.id, db, "alice")

    assert product.is_deleted is False
    assert product.deleted_at is None
    assert product.deleted_by is None


@pytest.mark.asyncio
async def test_restore_not_deleted_raises_404():
    from app.routers.products import restore_product
    from fastapi import HTTPException
    product = MagicMock()
    product.is_deleted = False

    db = AsyncMock()
    db.get = AsyncMock(return_value=product)
    db.begin = MagicMock(return_value=AsyncMock(__aenter__=AsyncMock(return_value=None), __aexit__=AsyncMock(return_value=None)))

    with pytest.raises(HTTPException) as exc:
        await restore_product(product.id, db, "alice")
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_restore_missing_product_raises_404():
    from app.routers.products import restore_product
    from fastapi import HTTPException

    db = AsyncMock()
    db.get = AsyncMock(return_value=None)
    db.begin = MagicMock(return_value=AsyncMock(__aenter__=AsyncMock(return_value=None), __aexit__=AsyncMock(return_value=None)))

    with pytest.raises(HTTPException) as exc:
        await restore_product(uuid.uuid4(), db, "alice")
    assert exc.value.status_code == 404
