"""Unit tests for non-BLE printer helpers."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from printer import _crc8, _pkt, _parse_notification, _png_to_printer_rows
from label import render_label

PLACEHOLDER_ICON = Path(__file__).parent.parent.parent / "assets" / "icons" / "placeholder.png"


def test_crc8_known_value():
    # CRC-8 Dallas/Maxim of empty = 0
    assert _crc8(b"") == 0
    # Known: crc8 of [0x5D] should be deterministic
    result = _crc8(bytes([0x5D]))
    assert isinstance(result, int) and 0 <= result <= 255


def test_pkt_with_crc():
    pkt = _pkt(0xA2, bytes([0x5D]), use_crc=True)
    assert pkt[0] == 0x22
    assert pkt[1] == 0x21
    assert pkt[2] == 0xA2
    assert pkt[-1] == 0xFF  # CRC tail marker
    assert len(pkt) == 4 + 2 + 1 + 2  # header(4) + len(2) + data(1) + tail(2)


def test_pkt_without_crc():
    pkt = _pkt(0xAD, bytes([0x00]), use_crc=False)
    assert pkt[-2] == 0x00
    assert pkt[-1] == 0x00


def test_parse_notification_roundtrip():
    # Build a synthetic notification packet and parse it back
    data = bytes([0x01, 0x02, 0x03])
    pkt = _pkt(0xA1, data, use_crc=True)
    cmd_id, payload = _parse_notification(bytearray(pkt))
    assert cmd_id == 0xA1
    assert payload == data


def test_parse_notification_invalid():
    cmd_id, payload = _parse_notification(bytearray(b"\x00\x00\x00"))
    assert cmd_id is None
    assert payload == b""


def test_png_to_printer_rows_dimensions():
    icon_bytes = PLACEHOLDER_ICON.read_bytes()
    label_png = render_label("0001", "Test Item", "2026-09-13", icon_bytes)
    rows, height = _png_to_printer_rows(label_png)
    assert len(rows) == height
    assert all(len(r) == 48 for r in rows)


def test_png_to_printer_rows_has_black_pixels():
    icon_bytes = PLACEHOLDER_ICON.read_bytes()
    label_png = render_label("0001", "Test Item", "2026-09-13", icon_bytes)
    rows, _ = _png_to_printer_rows(label_png)
    # At least one row should have a non-zero byte (black pixels present)
    assert any(any(b != 0 for b in row) for row in rows)
