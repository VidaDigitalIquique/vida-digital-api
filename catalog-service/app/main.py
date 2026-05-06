from typing import List
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from app import jobs as job_manager

MIME_VALIDOS = {
    "image/jpeg", "image/png", "image/webp", "image/tiff", "image/bmp",
}

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://vidadigital-inventario-v2.vercel.app",
        "https://vida-digital-api.onrender.com",
        "http://localhost:3000",
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)


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


@app.post("/jobs")
async def create_job(
    images: List[UploadFile] = File(...),
    product_code: str = Form(...),
    packing_text: str = Form(...),
):
    images_data = [(await img.read(), img.content_type or "image/jpeg") for img in images]
    job_id = job_manager.create_job(images_data, product_code, packing_text)
    return {"job_id": job_id}


@app.get("/jobs/{job_id}")
def get_job(job_id: str):
    job = job_manager.get_job(job_id)
    if job is None:
        return JSONResponse(status_code=404, content={"error": "job not found"})
    return {
        "status": job.status,
        "step": job.step,
        "result_url": job.result_url,
        "error": job.error,
    }
