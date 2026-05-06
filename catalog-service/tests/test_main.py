import io
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
