from pathlib import Path
from PIL import Image
from io import BytesIO
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from label import render_label

PLACEHOLDER_ICON = Path(__file__).parent.parent.parent / "assets" / "icons" / "placeholder.png"


def test_label_is_384px_wide():
    icon_bytes = PLACEHOLDER_ICON.read_bytes()
    result = render_label("0001", "Test Item", "2026-09-13", icon_bytes)
    img = Image.open(BytesIO(result))
    assert img.width == 384


def test_label_is_1bit():
    icon_bytes = PLACEHOLDER_ICON.read_bytes()
    result = render_label("0001", "Test Item", "2026-09-13", icon_bytes)
    img = Image.open(BytesIO(result))
    assert img.mode == "1"


def test_label_has_content():
    icon_bytes = PLACEHOLDER_ICON.read_bytes()
    result = render_label("0001", "Test Item", "2026-09-13", icon_bytes)
    img = Image.open(BytesIO(result)).convert("L")
    pixels = list(img.getdata())
    # Should have both black and white pixels (not blank)
    assert min(pixels) < 128
    assert max(pixels) > 128
