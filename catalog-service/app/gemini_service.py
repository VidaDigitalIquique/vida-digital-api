import os
import io
import base64
from google import genai
from google.genai import types


DEFAULT_PROMPT = (
    "Professional product catalog photo for e-commerce. "
    "White studio background with soft shadows. "
    "Use the input photos as reference for the product shape, color and details only — ignore their backgrounds. "
    "Arrange all color variants side by side if multiple images are provided. "
    "Clean, high-quality style. No text, no watermarks, no props."
)


def generate_catalog_image(images: list[tuple[bytes, str]], prompt: str = "") -> bytes:
    api_key = os.environ["GEMINI_API_KEY"]
    effective_prompt = prompt or os.getenv("GEMINI_PROMPT", DEFAULT_PROMPT)

    client = genai.Client(api_key=api_key)

    parts = [types.Part.from_text(text=effective_prompt)]
    for img_bytes, mime_type in images:
        parts.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))

    response = client.models.generate_content(
        model="gemini-2.5-flash-image",
        contents=types.Content(role="user", parts=parts),
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
        ),
    )

    for part in response.candidates[0].content.parts:
        if part.inline_data is not None:
            return part.inline_data.data

    raise Exception("Gemini no devolvió imagen en la respuesta")
