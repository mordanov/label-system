import httpx
from ..config import settings
from ..schemas import LabelLayout


async def send_to_printer(
    inventory_number: str,
    name: str,
    created_at: str,
    icon_filename: str | None,
    icon_bytes: bytes | None,
    layout: LabelLayout | None = None,
) -> bool:
    if layout is None:
        layout = LabelLayout()
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.print_service_url}/print",
                data={
                    "inventory_number": inventory_number,
                    "name": name,
                    "created_at": created_at,
                    "icon_filename": icon_filename,
                    **{k: str(v) for k, v in layout.model_dump().items()},
                },
                files={"icon_file": (icon_filename or "", icon_bytes or b"", "image/png")},
            )
            return resp.status_code == 200
    except (httpx.ConnectError, httpx.TimeoutException):
        return False
