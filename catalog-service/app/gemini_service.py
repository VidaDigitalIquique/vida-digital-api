import os
import io
import base64
from google import genai
from google.genai import types


DEFAULT_PROMPT = (
    "Professional product catalog photo. White studio background with soft shadows. "
    "Arrange all color variants side by side. Clean, high-quality e-commerce style. "
    "No text, no watermarks, no props."
)


def generate_catalog_image(pngs: list[bytes], prompt: str = "") -> bytes:
    api_key = os.environ["GEMINI_API_KEY"]
    effective_prompt = prompt or os.getenv("GEMINI_PROMPT", DEFAULT_PROMPT)

    client = genai.Client(api_key=api_key)

    parts = [types.Part.from_text(text=effective_prompt)]
    for png in pngs:
        parts.append(types.Part.from_bytes(data=png, mime_type="image/png"))

    response = client.models.generate_content(
        model="gemini-2.0-flash-preview-image-generation",
        contents=types.Content(role="user", parts=parts),
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
        ),
    )

    for part in response.candidates[0].content.parts:
        if part.inline_data is not None:
            return part.inline_data.data

    raise Exception("Gemini no devolvió imagen en la respuesta")
