import logging
import os

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from label import render_label
from printer import print_label

logger = logging.getLogger("print_service")

app = FastAPI(title="Print Service")


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
):
    icon_bytes = await icon_file.read()
    label_png = render_label(inventory_number, name, created_at, icon_bytes)
    # Read address at request time so the env var can be set after import
    ble_address = os.environ["PRINTER_BLE_ADDRESS"]
    logger.info("Printing to %s", ble_address)
    try:
        await print_label(ble_address, label_png)
    except Exception as exc:
        logger.error("Print failed (%s): %s", type(exc).__name__, exc, exc_info=True)
        raise HTTPException(status_code=503, detail=f"Printer error: {exc}")
    return {"status": "printed"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=9100, reload=False)
