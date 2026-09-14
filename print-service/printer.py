"""
MXW01 BLE thermal printer driver.
Protocol adapted from: https://github.com/mordanov/MXW01_Thermal-Printer-Tool
"""
import asyncio
from io import BytesIO

from PIL import Image

# bleak imported lazily inside print_label so protocol helpers are importable
# without the BLE stack installed (useful in CI / unit-test environments).
# bleak backend is platform-abstracted (CoreBluetooth on macOS, WinRT on Windows) —
# no platform-specific code needed here.

CONTROL_WRITE_UUID = "0000ae01-0000-1000-8000-00805f9b34fb"
NOTIFY_UUID        = "0000ae02-0000-1000-8000-00805f9b34fb"
DATA_WRITE_UUID    = "0000ae03-0000-1000-8000-00805f9b34fb"


def _crc8(data: bytes) -> int:
    crc = 0
    for byte in data:
        crc ^= byte
        for _ in range(8):
            crc = ((crc << 1) ^ 0x07) & 0xFF if crc & 0x80 else (crc << 1) & 0xFF
    return crc


def _pkt(cmd_id: int, data: bytes, *, use_crc: bool) -> bytes:
    header = bytes([0x22, 0x21, cmd_id, 0x00]) + len(data).to_bytes(2, "little")
    tail = bytes([_crc8(data), 0xFF]) if use_crc else bytes([0x00, 0x00])
    return header + data + tail


def _parse_notification(data: bytearray) -> tuple[int | None, bytes]:
    if len(data) < 8 or data[0] != 0x22 or data[1] != 0x21:
        return None, b""
    cmd_id = data[2]
    payload_len = int.from_bytes(data[4:6], "little")
    return cmd_id, bytes(data[6 : 6 + payload_len])


def _png_to_printer_rows(png_bytes: bytes) -> tuple[list[bytes], int]:
    """Return (rows, height). Each row is 48 bytes, LSB-first (bit 0 = leftmost pixel, black=1)."""
    img = Image.open(BytesIO(png_bytes)).convert("1")
    width, height = img.size
    if width != 384:
        raise ValueError(f"Expected 384px wide, got {width}")
    rows = []
    for y in range(height):
        row = bytearray(48)
        for x in range(384):
            if img.getpixel((x, y)) == 0:  # black pixel → bit = 1
                row[x // 8] |= 1 << (x % 8)  # LSB-first
        rows.append(bytes(row))
    return rows, height


async def print_label(ble_address: str, label_png: bytes) -> None:
    """Connect to MXW01, send label image, disconnect. Raises on failure."""
    import bleak  # noqa: PLC0415 — lazy so unit tests run without BLE stack

    rows, height = _png_to_printer_rows(label_png)
    image_data = b"".join(rows)

    # ponytail: dict+polling instead of asyncio.Future; bleak callback threading
    # varies by platform — polling at 50ms is safe and obvious.
    received: dict[int, bytes] = {}

    def _on_notify(_char: object, data: bytearray) -> None:
        cmd_id, payload = _parse_notification(data)
        if cmd_id is not None:
            received[cmd_id] = payload

    async def _wait(cmd_id: int, timeout: float) -> bytes:
        deadline = asyncio.get_running_loop().time() + timeout
        while True:
            if cmd_id in received:
                return received.pop(cmd_id)
            if asyncio.get_running_loop().time() >= deadline:
                raise TimeoutError(f"Timeout waiting for notification 0x{cmd_id:02X}")
            await asyncio.sleep(0.05)

    device = await bleak.BleakScanner.find_device_by_address(ble_address, timeout=10.0)
    if device is None:
        raise RuntimeError(f"Device {ble_address} not found during BLE scan (is it on and in range?)")

    async with bleak.BleakClient(device) as client:
        await client.start_notify(NOTIFY_UUID, _on_notify)

        # Step 1: B1 → A2 → A1, then wait for A1 ready notification
        for cmd_id, data in [(0xB1, b""), (0xA2, bytes([0x5D])), (0xA1, bytes([0x00]))]:
            await client.write_gatt_char(CONTROL_WRITE_UUID, _pkt(cmd_id, data, use_crc=True), response=False)
            await asyncio.sleep(0.01)

        payload = await _wait(0xA1, 7.0)
        if len(payload) <= 6 or payload[6] != 0:
            raise RuntimeError(f"Printer not ready (A1 payload={payload.hex()})")

        # Step 2: A2 → A9 (A9 without CRC), wait for A9 OK
        a9_data = height.to_bytes(2, "little") + (48).to_bytes(2, "little")
        await client.write_gatt_char(CONTROL_WRITE_UUID, _pkt(0xA2, bytes([0x5D]), use_crc=True), response=False)
        await asyncio.sleep(0.01)
        await client.write_gatt_char(CONTROL_WRITE_UUID, _pkt(0xA9, a9_data, use_crc=False), response=False)

        payload = await _wait(0xA9, 7.0)
        if not payload or payload[0] != 0:
            raise RuntimeError(f"Print start rejected (A9 payload={payload.hex()})")

        # Step 3: image data to DATA characteristic in 20-byte chunks
        for i in range(0, len(image_data), 20):
            await client.write_gatt_char(DATA_WRITE_UUID, image_data[i : i + 20], response=False)

        # Step 4: AD finalize, wait AA print-done notification
        await client.write_gatt_char(CONTROL_WRITE_UUID, _pkt(0xAD, bytes([0x00]), use_crc=False), response=False)
        await _wait(0xAA, max(15.0, height / 20.0))
