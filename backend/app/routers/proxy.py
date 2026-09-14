"""
Proxy router: forwards all product API calls to REMOTE_BACKEND_URL.

Used when running locally with PRINT_ENABLED=true but no direct DB access.
After a successful create or reprint, triggers the local print service.
"""
import base64
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from ..auth import get_current_user
from ..config import settings
from ..schemas import LabelLayout, ProductResponse
from ..services.print_client import send_to_printer

router = APIRouter(tags=["proxy"])
security = HTTPBasic()

ICONS_DIR = Path(__file__).parent.parent.parent / "assets" / "icons"


def _auth_header(credentials: HTTPBasicCredentials) -> dict[str, str]:
    token = base64.b64encode(
        f"{credentials.username}:{credentials.password}".encode()
    ).decode()
    return {"Authorization": f"Basic {token}"}


async def _forward(
    method: str,
    path: str,
    credentials: HTTPBasicCredentials,
    json_body=None,
) -> dict:
    url = settings.remote_backend_url.rstrip("/") + "/api" + path
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.request(
            method, url, json=json_body, headers=_auth_header(credentials)
        )
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()


async def _get_layout(credentials: HTTPBasicCredentials) -> LabelLayout:
    try:
        data = await _forward("GET", "/label-settings", credentials)
        return LabelLayout(**data)
    except Exception:
        return LabelLayout()


async def _print_product(product: dict, layout: LabelLayout | None = None) -> bool:
    icon_filename = product.get("icon_filename") or ""
    icon_bytes = None
    if icon_filename:
        icon_path = (ICONS_DIR / icon_filename).resolve()
        if icon_path.is_relative_to(ICONS_DIR.resolve()) and icon_path.exists():
            icon_bytes = icon_path.read_bytes()

    return await send_to_printer(
        inventory_number=product["inventory_number"],
        name=product["name"],
        created_at=product["created_at"][:10],
        icon_filename=icon_filename,
        icon_bytes=icon_bytes,
        layout=layout,
    )


@router.post("/products", response_model=ProductResponse)
async def create_product(
    body: dict,
    credentials: HTTPBasicCredentials = Depends(security),
    _: str = Depends(get_current_user),
):
    product = await _forward("POST", "/products", credentials, json_body=body)
    if settings.print_enabled:
        layout = await _get_layout(credentials)
        print_ok = await _print_product(product, layout)
        product["print_warning"] = not print_ok
    return product


@router.get("/products/names")
async def proxy_product_names(
    credentials: HTTPBasicCredentials = Depends(security),
    _: str = Depends(get_current_user),
):
    return await _forward("GET", "/products/names", credentials)


@router.post("/products/bulk")
async def create_products_bulk(
    body: dict,
    credentials: HTTPBasicCredentials = Depends(security),
    _: str = Depends(get_current_user),
):
    products = await _forward("POST", "/products/bulk", credentials, json_body=body)
    if settings.print_enabled:
        layout = await _get_layout(credentials)
        for product in products:
            print_ok = await _print_product(product, layout)
            product["print_warning"] = not print_ok
    return products


@router.post("/products/{product_id}/reprint", response_model=ProductResponse)
async def reprint_product(
    product_id: str,
    credentials: HTTPBasicCredentials = Depends(security),
    _: str = Depends(get_current_user),
):
    product = await _forward("POST", f"/products/{product_id}/reprint", credentials)
    if settings.print_enabled:
        layout = await _get_layout(credentials)
        print_ok = await _print_product(product, layout)
        product["print_warning"] = not print_ok
    return product


@router.post("/products/{product_id}/delete")
async def delete_product(
    product_id: str,
    credentials: HTTPBasicCredentials = Depends(security),
    _: str = Depends(get_current_user),
):
    return await _forward("POST", f"/products/{product_id}/delete", credentials)


# ── label-settings proxy ──────────────────────────────────────────────────────

@router.get("/label-settings")
async def proxy_get_label_settings(
    credentials: HTTPBasicCredentials = Depends(security),
    _: str = Depends(get_current_user),
):
    return await _forward("GET", "/label-settings", credentials)


@router.put("/label-settings")
async def proxy_put_label_settings(
    body: dict,
    credentials: HTTPBasicCredentials = Depends(security),
    _: str = Depends(get_current_user),
):
    return await _forward("PUT", "/label-settings", credentials, json_body=body)


# ── products list ─────────────────────────────────────────────────────────────

@router.get("/products")
async def list_products(
    request: Request,
    credentials: HTTPBasicCredentials = Depends(security),
    _: str = Depends(get_current_user),
):
    qs = request.url.query
    path = "/products" + (f"?{qs}" if qs else "")
    return await _forward("GET", path, credentials)
