from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from ..database import get_db
from ..models import Product
from ..schemas import ProductCreate, ProductResponse
from ..auth import get_current_user
from ..services.inventory import next_inventory_number
from ..services.print_client import send_to_printer

router = APIRouter(prefix="/products", tags=["products"])

ICONS_DIR = Path(__file__).parent.parent.parent / "assets" / "icons"


@router.post("/", response_model=ProductResponse)
async def create_product(
    body: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    async with db.begin():
        inv = await next_inventory_number(db)
        product = Product(name=body.name, icon_filename=body.icon_filename, inventory_number=inv)
        db.add(product)

    await db.refresh(product)

    icon_path = ICONS_DIR / product.icon_filename
    icon_bytes = icon_path.read_bytes() if icon_path.exists() else b""
    print_ok = await send_to_printer(
        inventory_number=product.inventory_number,
        name=product.name,
        created_at=product.created_at.strftime("%Y-%m-%d"),
        icon_filename=product.icon_filename,
        icon_bytes=icon_bytes,
    )

    resp = ProductResponse.model_validate(product)
    resp.print_warning = not print_ok
    return resp


@router.get("/", response_model=list[ProductResponse])
async def list_products(
    q: str | None = None,
    include_deleted: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    stmt = select(Product)
    if not include_deleted:
        stmt = stmt.where(Product.is_deleted == False)  # noqa: E712
    if q:
        stmt = stmt.where(Product.name.ilike(f"%{q}%"))
    stmt = stmt.order_by(Product.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/{product_id}/reprint", response_model=ProductResponse)
async def reprint_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    product = await db.get(Product, product_id)
    if not product or product.is_deleted:
        raise HTTPException(status_code=404, detail="Product not found")

    icon_path = ICONS_DIR / product.icon_filename
    icon_bytes = icon_path.read_bytes() if icon_path.exists() else b""
    print_ok = await send_to_printer(
        inventory_number=product.inventory_number,
        name=product.name,
        created_at=product.created_at.strftime("%Y-%m-%d"),
        icon_filename=product.icon_filename,
        icon_bytes=icon_bytes,
    )

    resp = ProductResponse.model_validate(product)
    resp.print_warning = not print_ok
    return resp


@router.post("/{product_id}/delete", response_model=ProductResponse)
async def delete_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    async with db.begin():
        product = await db.get(Product, product_id)
        if not product or product.is_deleted:
            raise HTTPException(status_code=404, detail="Product not found")
        product.is_deleted = True
        product.deleted_at = datetime.now(timezone.utc)
        product.deleted_by = current_user

    await db.refresh(product)
    return ProductResponse.model_validate(product)
