from __future__ import annotations

import os
from dataclasses import dataclass, field
from io import BytesIO

from PIL import Image, ImageDraw, ImageFont

LABEL_WIDTH = 384
LABEL_HEIGHT = 200

_FONT_CANDIDATES = [
    os.environ.get("LABEL_FONT_PATH", ""),
    "/System/Library/Fonts/Supplemental/Arial.ttf",          # macOS
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",       # Debian/Ubuntu
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",                # Fedora/RHEL
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
]


def _font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in _FONT_CANDIDATES:
        if path and os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size=size)  # ASCII fallback


@dataclass
class LabelLayout:
    icon_x: int = 8
    icon_y: int = 8
    icon_size: int = 80
    name_x: int = 96
    name_y: int = 8
    name_font_size: int = 24
    number_x: int = 192
    number_y: int = 90
    number_font_size: int = 48
    date_x: int = 8
    date_y: int = 170
    date_font_size: int = 18


def render_label(
    inventory_number: str,
    name: str,
    created_at: str,
    icon_bytes: bytes | None,
    layout: LabelLayout | None = None,
) -> bytes:
    if layout is None:
        layout = LabelLayout()

    img = Image.new("RGB", (LABEL_WIDTH, LABEL_HEIGHT), "white")
    draw = ImageDraw.Draw(img)

    if icon_bytes:
        icon = Image.open(BytesIO(icon_bytes)).convert("RGBA")
        icon.thumbnail((layout.icon_size, layout.icon_size))
        bg = Image.new("RGB", icon.size, "white")
        bg.paste(icon, mask=icon.split()[3])
        img.paste(bg, (layout.icon_x, layout.icon_y))

    draw.text((layout.name_x, layout.name_y), name[:30], fill="black", font=_font(layout.name_font_size))

    draw.text((layout.number_x, layout.number_y), f"#{inventory_number}", fill="black", font=_font(layout.number_font_size))

    draw.text((layout.date_x, layout.date_y), str(created_at), fill="black", font=_font(layout.date_font_size))

    out = BytesIO()
    img.convert("1", dither=Image.Dither.FLOYDSTEINBERG).save(out, format="PNG")
    return out.getvalue()
