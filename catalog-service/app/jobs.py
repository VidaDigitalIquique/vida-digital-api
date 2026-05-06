import uuid
import threading
from typing import Optional
from app.rembg_service import remove_background


class Job:
    def __init__(self):
        self.status: str = "pending"
        self.step: Optional[str] = None
        self.result_url: Optional[str] = None
        self.error: Optional[str] = None


_jobs: dict[str, Job] = {}


def create_job(images_bytes: list[bytes], product_code: str, packing_text: str) -> str:
    job_id = str(uuid.uuid4())
    job = Job()
    _jobs[job_id] = job
    thread = threading.Thread(
        target=_execute,
        args=(job, images_bytes, product_code, packing_text),
        daemon=True,
    )
    thread.start()
    return job_id


def get_job(job_id: str) -> Optional[Job]:
    return _jobs.get(job_id)


def _execute(job: Job, images_bytes: list[bytes], product_code: str, packing_text: str):
    try:
        job.status = "processing"
        for img_bytes in images_bytes:
            job.step = "removing_bg"
            remove_background(img_bytes)
        job.status = "done"
        job.step = None
    except Exception as e:
        job.status = "error"
        job.error = str(e)
        job.step = None
