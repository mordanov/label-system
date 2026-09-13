from __future__ import annotations

from io import BytesIO

from PIL import Image, ImageDraw, ImageFont

LABEL_WIDTH = 384
LABEL_HEIGHT = 200
ICON_SIZE = 80
PAD = 8


def render_label(
    inventory_number: str,
    name: str,
    created_at: str,
    icon_bytes: bytes | None,
) -> bytes:
    img = Image.new("RGB", (LABEL_WIDTH, LABEL_HEIGHT), "white")
    draw = ImageDraw.Draw(img)

    # Icon — top-left
    if icon_bytes:
        icon = Image.open(BytesIO(icon_bytes)).convert("RGBA")
        icon.thumbnail((ICON_SIZE, ICON_SIZE))
        bg = Image.new("RGB", icon.size, "white")
        bg.paste(icon, mask=icon.split()[3])
        img.paste(bg, (PAD, PAD))

    text_x = (ICON_SIZE + PAD * 2) if icon_bytes else PAD

    # Product name — top-right of icon
    draw.text((text_x, PAD), name[:30], fill="black", font=ImageFont.load_default(size=24))

    # Inventory number — large, horizontally centred
    font_inv = ImageFont.load_default(size=48)
    inv_text = f"#{inventory_number}"
    bbox = draw.textbbox((0, 0), inv_text, font=font_inv)
    x = (LABEL_WIDTH - (bbox[2] - bbox[0])) // 2
    draw.text((x, 90), inv_text, fill="black", font=font_inv)

    # Date — bottom-left
    draw.text((PAD, 170), str(created_at), fill="black", font=ImageFont.load_default(size=18))

    out = BytesIO()
    img.convert("1", dither=Image.Dither.FLOYDSTEINBERG).save(out, format="PNG")
    return out.getvalue()
