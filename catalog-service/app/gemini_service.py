import os
from google import genai
from google.genai import types


DEFAULT_PROMPT = (
    "Professional product catalog photo for e-commerce. "
    "White studio background with soft shadows. "
    "Use the input photos as reference for the product shape, color and details only — ignore their backgrounds. "
    "Arrange all color variants side by side if multiple images are provided. "
    "Clean, high-quality style. No text, no watermarks, no props."
)

MODEL = "gemini-2.5-flash-image"


def _api_keys() -> list[str]:
    keys = [k for name in ("GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3") if (k := os.getenv(name))]
    if not keys:
        k = os.getenv("GEMINI_API_KEY")
        if k:
            keys.append(k)
    return keys


def generate_catalog_image(images: list[tuple[bytes, str]], prompt: str = "") -> bytes:
    keys = _api_keys()
    if not keys:
        raise Exception("No hay API keys de Gemini configuradas (GEMINI_API_KEY_1/2/3)")

    effective_prompt = prompt or os.getenv("GEMINI_PROMPT", DEFAULT_PROMPT)
    parts = [types.Part.from_text(text=effective_prompt)]
    for img_bytes, mime_type in images:
        parts.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))
    contents = types.Content(role="user", parts=parts)
    config = types.GenerateContentConfig(response_modalities=["IMAGE", "TEXT"])

    last_error: Exception = Exception("No keys disponibles")
    for key in keys:
        try:
            client = genai.Client(api_key=key)
            response = client.models.generate_content(model=MODEL, contents=contents, config=config)
            for part in response.candidates[0].content.parts:
                if part.inline_data is not None:
                    return part.inline_data.data
            raise Exception("Gemini no devolvió imagen en la respuesta")
        except Exception as e:
            last_error = e
            err_str = str(e)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower():
                continue
            raise

    raise last_error
