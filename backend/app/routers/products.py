from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
import uuid

from ..database import get_db
from ..models import Product
from ..schemas import ProductCreate, ProductBulkCreate, ProductResponse
from ..auth import get_current_user
from ..services.inventory import next_inventory_number
from ..services.print_client import send_to_printer
from ..config import settings

router = APIRouter(prefix="/products", tags=["products"])

ICONS_DIR = Path(__file__).parent.parent.parent / "assets" / "icons"


@router.post("/", response_model=ProductResponse)
async def create_product(
    body: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    for attempt in range(2):
        try:
            async with db.begin():
                inv = await next_inventory_number(db)
                product = Product(name=body.name, icon_filename=body.icon_filename, inventory_number=inv)
                db.add(product)
            await db.refresh(product)
            break
        except IntegrityError:
            if attempt == 1:
                raise
            await db.rollback()

    if settings.print_enabled:
        icon_bytes = None
        if product.icon_filename:
            icon_path = (ICONS_DIR / product.icon_filename).resolve()
            if icon_path.is_relative_to(ICONS_DIR.resolve()):
                icon_bytes = icon_path.read_bytes() if icon_path.exists() else None
        print_ok = await send_to_printer(
            inventory_number=product.inventory_number,
            name=product.name,
            created_at=product.created_at.strftime("%Y-%m-%d"),
            icon_filename=product.icon_filename,
            icon_bytes=icon_bytes,
        )
    else:
        print_ok = True

    resp = ProductResponse.model_validate(product)
    resp.print_warning = not print_ok
    return resp


@router.post("/bulk", response_model=list[ProductResponse])
async def create_products_bulk(
    body: ProductBulkCreate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    created = []
    for item in body.items:
        for attempt in range(2):
            try:
                async with db.begin():
                    inv = await next_inventory_number(db)
                    product = Product(name=item.name, icon_filename=item.icon_filename, inventory_number=inv)
                    db.add(product)
                await db.refresh(product)
                created.append(product)
                break
            except IntegrityError:
                if attempt == 1:
                    raise
                await db.rollback()
    return [ProductResponse.model_validate(p) for p in created]


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

    if settings.print_enabled:
        icon_bytes = None
        if product.icon_filename:
            icon_path = (ICONS_DIR / product.icon_filename).resolve()
            if icon_path.is_relative_to(ICONS_DIR.resolve()):
                icon_bytes = icon_path.read_bytes() if icon_path.exists() else None
        print_ok = await send_to_printer(
            inventory_number=product.inventory_number,
            name=product.name,
            created_at=product.created_at.strftime("%Y-%m-%d"),
            icon_filename=product.icon_filename,
            icon_bytes=icon_bytes,
        )
    else:
        print_ok = True

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
