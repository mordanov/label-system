"""
MXW01 BLE thermal printer driver.
Protocol adapted from: https://github.com/mordanov/MXW01_Thermal-Printer-Tool
"""
import asyncio
import logging
import re
import time
from io import BytesIO

logger = logging.getLogger("print_service.ble")

from PIL import Image

# bleak imported lazily inside print_label so protocol helpers are importable
# without the BLE stack installed (useful in CI / unit-test environments).
# bleak backend is platform-abstracted (CoreBluetooth on macOS, WinRT on Windows) —
# no platform-specific code needed here.

_MAC_RE = re.compile(r'^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$')

# Cache the resolved CoreBluetooth UUID/address so subsequent prints skip the
# 8-10 s BLE discovery scan (connect directly by cached identifier).
_cached_ble_address: str | None = None

CONTROL_WRITE_UUID = "0000ae01-0000-1000-8000-00805f9b34fb"
NOTIFY_UUID        = "0000ae02-0000-1000-8000-00805f9b34fb"
DATA_WRITE_UUID    = "0000ae03-0000-1000-8000-00805f9b34fb"
BATTERY_UUID       = "00002a19-0000-1000-8000-00805f9b34fb"  # standard BLE Battery Service


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


async def _resolve_device(ble_address: str, bleak_mod: object) -> object:
    """Return a connectable address/device, using a cached UUID when available."""
    global _cached_ble_address
    bleak = bleak_mod

    if _MAC_RE.match(ble_address):
        # MAC address — Linux/Windows; find_device_by_address is reliable there
        device = await bleak.BleakScanner.find_device_by_address(ble_address, timeout=10.0)
        if device is None:
            raise RuntimeError(f"Device '{ble_address}' not found (is it on and in range?)")
        return device

    # Name or CoreBluetooth UUID: try cached address first (no scan needed)
    if _cached_ble_address:
        t = time.monotonic()
        device = await bleak.BleakScanner.find_device_by_address(_cached_ble_address, timeout=5.0)
        if device is not None:
            logger.info("BLE device found via cache in %.1fs (addr=%s)", time.monotonic() - t, device.address)
            return device
        logger.info("BLE cache miss (%.1fs) — falling back to full scan", time.monotonic() - t)
        _cached_ble_address = None

    # Full discovery scan (only on first use or after cache miss)
    t = time.monotonic()
    found = await bleak.BleakScanner.discover(timeout=10.0)
    device = next((d for d in found if d.address == ble_address or d.name == ble_address), None)
    if device is None:
        raise RuntimeError(f"Device '{ble_address}' not found during BLE scan (is it on and in range?)")
    _cached_ble_address = device.address
    logger.info("BLE device found via scan in %.1fs: %s (addr=%s cached)",
                time.monotonic() - t, device.name, device.address)
    return device


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

    device = await _resolve_device(ble_address, bleak)

    t_connect = time.monotonic()
    async with bleak.BleakClient(device) as client:
        logger.info("BLE connected in %.1fs", time.monotonic() - t_connect)
        await client.start_notify(NOTIFY_UUID, _on_notify)

        # Step 1: B1 → A2 → A1, wait for printer-ready notification
        t = time.monotonic()
        for cmd_id, data in [(0xB1, b""), (0xA2, bytes([0x5D])), (0xA1, bytes([0x00]))]:
            await client.write_gatt_char(CONTROL_WRITE_UUID, _pkt(cmd_id, data, use_crc=True), response=False)
            await asyncio.sleep(0.01)
        payload = await _wait(0xA1, 7.0)
        if len(payload) <= 6 or payload[6] != 0:
            raise RuntimeError(f"Printer not ready (A1 payload={payload.hex()})")
        logger.info("Handshake ready in %.1fs", time.monotonic() - t)

        # Step 2: A2 → A9, wait for print-start OK
        a9_data = height.to_bytes(2, "little") + (48).to_bytes(2, "little")
        await client.write_gatt_char(CONTROL_WRITE_UUID, _pkt(0xA2, bytes([0x5D]), use_crc=True), response=False)
        await asyncio.sleep(0.01)
        await client.write_gatt_char(CONTROL_WRITE_UUID, _pkt(0xA9, a9_data, use_crc=False), response=False)
        payload = await _wait(0xA9, 7.0)
        if not payload or payload[0] != 0:
            raise RuntimeError(f"Print start rejected (A9 payload={payload.hex()})")

        # Step 3: image data — write-without-response, paced to avoid buffer overflow
        t = time.monotonic()
        chunks = range(0, len(image_data), 20)
        logger.info("Sending %d rows (%d bytes, %d chunks)…", height, len(image_data), len(chunks))
        for i in chunks:
            await client.write_gatt_char(DATA_WRITE_UUID, image_data[i : i + 20], response=False)
            await asyncio.sleep(0.003)
        logger.info("Data sent in %.1fs", time.monotonic() - t)

        # Step 4: AD finalize, wait for print-done notification
        t = time.monotonic()
        await client.write_gatt_char(CONTROL_WRITE_UUID, _pkt(0xAD, bytes([0x00]), use_crc=False), response=False)
        await _wait(0xAA, max(30.0, height / 10.0))
        logger.info("Printed in %.1fs", time.monotonic() - t)


async def printer_status(ble_address: str) -> dict:
    """Connect to printer, read battery level and A1 status payload. Does not print."""
    import bleak

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
                raise TimeoutError(f"Timeout waiting for 0x{cmd_id:02X}")
            await asyncio.sleep(0.05)

    result: dict = {"connected": False}
    device = await _resolve_device(ble_address, bleak)

    async with bleak.BleakClient(device) as client:
        result["connected"] = True

        # Standard BLE Battery Service — 0x2A19, returns single byte 0-100
        try:
            bat = await client.read_gatt_char(BATTERY_UUID)
            result["battery_pct"] = bat[0]
        except Exception:
            result["battery_pct"] = None

        # A1 handshake → full status payload (all bytes, not just readiness flag)
        await client.start_notify(NOTIFY_UUID, _on_notify)
        for cmd_id, data in [(0xB1, b""), (0xA2, bytes([0x5D])), (0xA1, bytes([0x00]))]:
            await client.write_gatt_char(CONTROL_WRITE_UUID, _pkt(cmd_id, data, use_crc=True), response=False)
            await asyncio.sleep(0.01)
        payload = await _wait(0xA1, 7.0)
        result["a1_payload_hex"] = payload.hex()
        result["a1_bytes"] = list(payload)
        result["ready"] = len(payload) > 6 and payload[6] == 0
        # ponytail: byte positions inferred from one sample — verify by draining battery / printing repeatedly
        if len(payload) >= 5:
            result["battery_pct"] = payload[3]
            result["head_temp_c"] = payload[4]
        # bytes[8-9] vary between sessions — meaning unknown, exposed raw for analysis
        if len(payload) >= 10:
            result["unknown_8_9"] = [payload[8], payload[9]]

    logger.info("Printer status: battery=%s%% temp=%s°C ready=%s",
                result.get("battery_pct"), result.get("head_temp_c"), result.get("ready"))
    return result
