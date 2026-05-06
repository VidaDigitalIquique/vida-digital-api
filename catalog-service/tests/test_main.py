import io
import time
import uuid
from unittest.mock import patch
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _jpeg() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color=(255, 0, 0)).save(buf, format="JPEG")
    return buf.getvalue()


def _png_rgba() -> bytes:
    buf = io.BytesIO()
    Image.new("RGBA", (10, 10), color=(0, 255, 0, 128)).save(buf, format="PNG")
    return buf.getvalue()


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_remove_bg_returns_png():
    with patch("app.main.remove_background", return_value=_png_rgba()):
        res = client.post(
            "/remove-bg",
            files={"file": ("product.jpg", _jpeg(), "image/jpeg")},
        )
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"


def test_remove_bg_invalid_type():
    res = client.post(
        "/remove-bg",
        files={"file": ("doc.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert res.status_code == 422
    assert res.json() == {"error": "invalid file type"}


def test_post_jobs_returns_job_id():
    with patch("app.jobs.remove_background", return_value=_png_rgba()):
        res = client.post(
            "/jobs",
            files=[("images", ("p.jpg", _jpeg(), "image/jpeg"))],
            data={"product_code": "TEST-01", "packing_text": "4 Sets / Caja"},
        )
    assert res.status_code == 200
    body = res.json()
    assert "job_id" in body
    assert uuid.UUID(body["job_id"])


def _mock_all_services(**overrides):
    defaults = {
        "app.jobs.remove_background": _png_rgba(),
        "app.jobs.generate_catalog_image": b"fake-jpeg",
        "app.jobs.overlay_text": b"fake-composed",
        "app.jobs.upload_image": "https://res.cloudinary.com/test/productos/TEST-01.jpg",
    }
    defaults.update(overrides)
    return defaults


def _post_job(mocks: dict):
    patches = [patch(k, return_value=v) for k, v in mocks.items()]
    ctx = __import__("contextlib").ExitStack()
    for p in patches:
        ctx.enter_context(p)
    with ctx:
        return client.post(
            "/jobs",
            files=[("images", ("p.jpg", _jpeg(), "image/jpeg"))],
            data={"product_code": "TEST-01", "packing_text": "4 Sets / Caja"},
        )


def _wait_done(job_id: str):
    for _ in range(20):
        time.sleep(0.1)
        res = client.get(f"/jobs/{job_id}")
        if res.json().get("status") in ("done", "error"):
            return res
    return res


def test_get_job_done():
    post_res = _post_job(_mock_all_services())
    job_id = post_res.json()["job_id"]
    res = _wait_done(job_id)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "done"
    assert data["step"] is None
    assert data["error"] is None


def test_job_stores_generated_image():
    fake_jpeg = b"fake-jpeg-bytes"
    post_res = _post_job(_mock_all_services(**{"app.jobs.generate_catalog_image": fake_jpeg}))
    job_id = post_res.json()["job_id"]
    _wait_done(job_id)
    from app import jobs as job_manager
    job = job_manager.get_job(job_id)
    assert job.generated_image == fake_jpeg


def test_job_result_url():
    fake_url = "https://res.cloudinary.com/test/productos/TEST-01.jpg"
    post_res = _post_job(_mock_all_services(**{"app.jobs.upload_image": fake_url}))
    job_id = post_res.json()["job_id"]
    res = _wait_done(job_id)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "done"
    assert data["result_url"] == fake_url


def test_get_job_not_found():
    res = client.get("/jobs/id-inexistente")
    assert res.status_code == 404
    assert res.json() == {"error": "job not found"}
