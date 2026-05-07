function getApiKeys(): string[] {
  return [
    process.env.GEMINI_API_KEY_1!,
    process.env.GEMINI_API_KEY_2!,
    process.env.GEMINI_API_KEY_3!,
  ];
}

const TEXT_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'];
const IMAGE_MODELS = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview'];
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

async function callGemini<T>(
  models: string[],
  payload: object,
  extract: (data: any) => T | null,
  label?: string,
): Promise<T | null> {
  const tag = label || 'gemini';
  const keys = getApiKeys();
  console.log(`[${tag}] keys loaded:`, keys.map((k, i) => `KEY_${i + 1}: ${k ? k.substring(0, 8) + '...' : 'UNDEFINED'}`));
  for (const model of models) {
    for (let apiIdx = 0; apiIdx < keys.length; apiIdx++) {
      const apiKey = keys[apiIdx];
      if (!apiKey) continue;
      const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.status === 429 || res.status === 403) {
          const errBody = await res.text();
          console.error(`[${tag}] ${model} KEY_${apiIdx + 1} → ${res.status}: ${errBody.substring(0, 200)}`);
          continue;
        }
        if (!res.ok) {
          const errBody = await res.text();
          console.error(`[${tag}] ${model} KEY_${apiIdx + 1} → ${res.status}: ${errBody.substring(0, 200)}`);
          continue;
        }
        const data = await res.json();
        const result = extract(data);
        if (result !== null) return result;
      } catch (e: any) {
        console.error(`[${tag}] ${model} KEY_${apiIdx + 1} → EXCEPTION: ${e?.message}`);
        continue;
      }
    }
  }
  return null;
}

export async function callGeminiText(
  prompt: string,
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
    systemInstruction?: string;
    images?: { base64: string; mimeType: string }[];
  },
): Promise<string | null> {
  const parts: any[] = [{ text: prompt }];
  if (options?.images) {
    for (const img of options.images) {
      parts.push({ inline_data: { mime_type: img.mimeType, data: img.base64 } });
    }
  }

  const payload: any = {
    contents: [{ parts }],
    generationConfig: {
      temperature: options?.temperature ?? 0,
      maxOutputTokens: options?.maxOutputTokens ?? 2000,
    },
  };
  if (options?.systemInstruction) {
    payload.systemInstruction = { parts: [{ text: options.systemInstruction }] };
  }

  return callGemini(TEXT_MODELS, payload, (data) =>
    data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null,
  );
}

export async function callGeminiImage(
  imagesBase64: string[],
  mimeTypes: string[],
  prompt: string,
): Promise<Buffer | null> {
  const parts: any[] = [{ text: prompt }];
  for (let i = 0; i < imagesBase64.length; i++) {
    parts.push({
      inline_data: {
        mime_type: mimeTypes[i] || 'image/jpeg',
        data: imagesBase64[i],
      },
    });
  }

  return callGemini(
    IMAGE_MODELS,
    {
      contents: [{ parts }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    },
    (data) => {
      for (const part of data?.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          return Buffer.from(part.inlineData.data, 'base64');
        }
      }
      return null;
    },
    'callGeminiImage',
  );
}
