import base64
import re
from io import BytesIO

from PIL import Image, ImageOps, ImageStat

CYRILLIC = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh',
    'з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o',
    'п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts',
    'ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
}


def slug(name: str) -> str:
    s = name.lower()
    s = ''.join(CYRILLIC.get(c, c) for c in s)
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s[:40] or 'icon'


def _postprocess(png_bytes: bytes) -> bytes:
    """Convert to B&W icon, resize to 160×160."""
    img = Image.open(BytesIO(png_bytes)).convert('L')
    # Stretch histogram so subject/background span the full range
    img = ImageOps.autocontrast(img, cutoff=2)
    # If mean brightness < 110 the background is dark — invert so subject is dark on white
    if ImageStat.Stat(img).mean[0] < 110:
        img = ImageOps.invert(img)
    img = img.point(lambda x: 255 if x > 128 else 0)
    img = img.convert('RGB')
    img = img.resize((160, 160), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


def generate(dish_name: str, api_key: str, model: str) -> bytes:
    from openai import OpenAI  # lazy: keeps import fast without network/key in tests

    client = OpenAI(api_key=api_key)
    prompt = (
        f"Simple food product sticker icon: {dish_name}. "
        "White background. Single centered food item. "
        "Bold thick outlines, high contrast, flat clipart style. "
        "No text, no shadows, no gradients, no background patterns."
    )
    response = client.images.generate(
        model=model,
        prompt=prompt,
        n=1,
        size="1024x1024",
    )
    item = response.data[0]
    if item.b64_json:
        raw = base64.b64decode(item.b64_json)
    else:
        import httpx
        raw = httpx.get(item.url).content
    return _postprocess(raw)
