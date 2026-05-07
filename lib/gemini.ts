function getApiKeys(): string[] {
  return [
    process.env.GEMINI_API_KEY_1!,
    process.env.GEMINI_API_KEY_2!,
    process.env.GEMINI_API_KEY_3!,
  ];
}

const TEXT_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'];
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions';
const IMAGE_MODELS_OR = ['google/gemini-2.5-flash-image', 'bytedance-seed/seedream-4.5'];

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
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('[callGeminiImage] OPENROUTER_API_KEY no está configurada');
    return null;
  }

  const content: any[] = [{ type: 'text', text: prompt }];
  for (let i = 0; i < imagesBase64.length; i++) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${mimeTypes[i] || 'image/jpeg'};base64,${imagesBase64[i]}`,
      },
    });
  }

  for (const model of IMAGE_MODELS_OR) {
    try {
      const res = await fetch(OPENROUTER_BASE, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://vidadigital-inventario-v2.vercel.app',
          'X-Title': 'VidaDigital',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content }],
          modalities: ['image', 'text'],
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`[callGeminiImage] ${model} → ${res.status}: ${errBody.substring(0, 300)}`);
        continue;
      }

      const data = await res.json();
      console.log('[callGeminiImage] OpenRouter response:', JSON.stringify(data).substring(0, 1000));
      const parts = data?.choices?.[0]?.message?.content;
      if (!parts || !Array.isArray(parts)) continue;

      for (const part of parts) {
        if (part.type === 'image_url' && part.image_url?.url) {
          const base64 = part.image_url.url.replace(/^data:image\/\w+;base64,/, '');
          return Buffer.from(base64, 'base64');
        }
      }
    } catch (e: any) {
      console.error(`[callGeminiImage] ${model} → EXCEPTION: ${e?.message}`);
      continue;
    }
  }

  return null;
}
