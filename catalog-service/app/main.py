import io
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse, Response
from PIL import Image
import pillow_heif

pillow_heif.register_heif_opener()

MIME_VALIDOS = {
    "image/jpeg", "image/png", "image/webp",
    "image/heic", "image/heif", "image/tiff", "image/bmp",
}

app = FastAPI()


def remove_background(image_bytes: bytes) -> bytes:
    from rembg import remove
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    result = remove(img)
    buf = io.BytesIO()
    result.save(buf, format="PNG")
    return buf.getvalue()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/remove-bg")
async def remove_bg(file: UploadFile = File(...)):
    if file.content_type not in MIME_VALIDOS:
        return JSONResponse(status_code=422, content={"error": "invalid file type"})
    data = await file.read()
    png_bytes = remove_background(data)
    return Response(content=png_bytes, media_type="image/png")
