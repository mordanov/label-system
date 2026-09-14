import logging
import os

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from label import LabelLayout, render_label
from printer import print_label

logger = logging.getLogger("print_service")

app = FastAPI(title="Print Service")

if not os.environ.get("PRINTER_BLE_ADDRESS"):
    raise RuntimeError("PRINTER_BLE_ADDRESS env var is not set")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/print")
async def print_endpoint(
    inventory_number: str = Form(...),
    name: str = Form(...),
    created_at: str = Form(...),
    icon_filename: str = Form(...),
    icon_file: UploadFile = File(...),
    icon_x: int = Form(8),
    icon_y: int = Form(8),
    icon_size: int = Form(80),
    name_x: int = Form(96),
    name_y: int = Form(8),
    name_font_size: int = Form(24),
    number_x: int = Form(192),
    number_y: int = Form(90),
    number_font_size: int = Form(48),
    date_x: int = Form(8),
    date_y: int = Form(170),
    date_font_size: int = Form(18),
):
    import time
    icon_bytes = await icon_file.read()
    layout = LabelLayout(
        icon_x=icon_x, icon_y=icon_y, icon_size=icon_size,
        name_x=name_x, name_y=name_y, name_font_size=name_font_size,
        number_x=number_x, number_y=number_y, number_font_size=number_font_size,
        date_x=date_x, date_y=date_y, date_font_size=date_font_size,
    )
    label_png = render_label(inventory_number, name, created_at, icon_bytes, layout)
    ble_address = os.environ["PRINTER_BLE_ADDRESS"]
    logger.info("Print request: #%s '%s' date=%s -> %s (%d bytes)",
                inventory_number, name, created_at, ble_address, len(label_png))
    t0 = time.monotonic()
    try:
        await print_label(ble_address, label_png)
    except Exception as exc:
        elapsed = time.monotonic() - t0
        logger.error("Print FAILED after %.1fs (%s): %s", elapsed, type(exc).__name__, exc, exc_info=True)
        raise HTTPException(status_code=503, detail=f"Printer error: {exc}")
    logger.info("Print OK: #%s in %.1fs", inventory_number, time.monotonic() - t0)
    return {"status": "printed"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=9100, reload=False)
