import httpx
from ..config import settings


async def send_to_printer(
    inventory_number: str,
    name: str,
    created_at: str,
    icon_filename: str,
    icon_bytes: bytes,
) -> bool:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.print_service_url}/print",
                data={
                    "inventory_number": inventory_number,
                    "name": name,
                    "created_at": created_at,
                    "icon_filename": icon_filename,
                },
                files={"icon_file": (icon_filename, icon_bytes, "image/png")},
            )
            return resp.status_code == 200
    except (httpx.ConnectError, httpx.TimeoutException):
        return False
