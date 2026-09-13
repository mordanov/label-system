import base64
import re
from io import BytesIO

from PIL import Image

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
    """Threshold to pure B&W and resize to 160×160 to match gallery format."""
    img = Image.open(BytesIO(png_bytes)).convert('L')
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
        f"Food/product icon for: {dish_name}. "
        "Style: black line-art on white background. "
        "Single centered illustration, black outlines only, no color fill, no gradients, no halftones. "
        "Consistent medium rounded stroke weight. Simple clean silhouette — recognizable but not photorealistic. "
        "One central object, optionally in a simple bowl or jar if appropriate. "
        "No text, no background patterns, no shadows."
    )
    response = client.images.generate(
        model=model,
        prompt=prompt,
        n=1,
        size="1024x1024",
        response_format="b64_json",
    )
    raw = base64.b64decode(response.data[0].b64_json)
    return _postprocess(raw)
