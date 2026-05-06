import io
from PIL import Image


def remove_background(image_bytes: bytes) -> bytes:
    from rembg import remove
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    result = remove(img)
    buf = io.BytesIO()
    result.save(buf, format="PNG")
    return buf.getvalue()
