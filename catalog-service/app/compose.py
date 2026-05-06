import io
from PIL import Image, ImageDraw, ImageFont

PADDING = 20
FONT_SIZE = 36


def overlay_text(image_bytes: bytes, product_code: str, packing_text: str) -> bytes:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default(size=FONT_SIZE)
    w, h = img.size

    bbox_pack = draw.textbbox((0, 0), packing_text, font=font)
    text_w = bbox_pack[2] - bbox_pack[0]
    y = h - PADDING - FONT_SIZE

    _draw_shadowed(draw, (PADDING, y), product_code, font)
    _draw_shadowed(draw, (w - PADDING - text_w, y), packing_text, font)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def _draw_shadowed(draw: ImageDraw.ImageDraw, pos: tuple, text: str, font):
    x, y = pos
    draw.text((x + 2, y + 2), text, font=font, fill=(0, 0, 0))
    draw.text((x, y), text, font=font, fill=(255, 255, 255))
