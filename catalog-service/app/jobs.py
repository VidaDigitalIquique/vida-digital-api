import uuid
import threading
from typing import Optional
from app.gemini_service import generate_catalog_image
from app.compose import overlay_text
from app.cloudinary_service import upload_image


class Job:
    def __init__(self):
        self.status: str = "pending"
        self.step: Optional[str] = None
        self.result_url: Optional[str] = None
        self.error: Optional[str] = None
        self.generated_image: Optional[bytes] = None


_jobs: dict[str, Job] = {}


def create_job(images_data: list[tuple[bytes, str]], product_code: str, packing_text: str) -> str:
    job_id = str(uuid.uuid4())
    job = Job()
    _jobs[job_id] = job
    thread = threading.Thread(
        target=_execute,
        args=(job, images_data, product_code, packing_text),
        daemon=True,
    )
    thread.start()
    return job_id


def get_job(job_id: str) -> Optional[Job]:
    return _jobs.get(job_id)


def _execute(job: Job, images_data: list[tuple[bytes, str]], product_code: str, packing_text: str):
    try:
        job.status = "processing"

        job.step = "generating_image"
        job.generated_image = generate_catalog_image(images_data)

        job.step = "composing"
        composed = overlay_text(job.generated_image, product_code, packing_text)

        job.step = "uploading"
        job.result_url = upload_image(composed, product_code)

        job.status = "done"
        job.step = None
    except Exception as e:
        job.status = "error"
        job.error = str(e)
        job.step = None
