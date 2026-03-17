/**
 * Extracts a folio number from a document image URL using OpenRouter vision models.
 * Includes fallback logic to attempt multiple models if one fails.
 */
export async function extractFolioFromImage(imageUrl: string, preferredModel?: string): Promise<number | null> {
  const models = [
    'meta-llama/llama-3.2-11b-vision-instruct:free',
    'google/gemma-3-12b-it:free',
    'mistralai/mistral-small-3.1-24b-instruct:free',
    'openai/gpt-4o',
  ];

  // Put preferred model at the front if provided
  let queue = [...models];
  if (preferredModel && preferredModel !== 'auto' && !queue.includes(preferredModel)) {
    queue = [preferredModel, ...queue];
  } else if (preferredModel && preferredModel !== 'auto' && queue.includes(preferredModel)) {
    queue = [preferredModel, ...queue.filter(m => m !== preferredModel)];
  }

  const systemPrompt = "Eres un asistente especializado en leer documentos comerciales chilenos. Tu unica tarea es encontrar el numero de folio, nota de venta o guia de despacho. Responde SOLO con los digitos. Si no puedes identificarlo con certeza, responde exactamente: NULL";
  const userPrompt = "Cual es el numero de folio/nota/guia de este documento? Responde SOLO con digitos o NULL.";

  for (const model of queue) {
    try {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.OPENROUTER_API_KEY,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://vidadigital-inventario-v2.vercel.app',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: systemPrompt + '\n\n' + userPrompt },
                {
                  type: 'image_url',
                  image_url: { url: imageUrl }
                }
              ]
            }
          ],
          max_tokens: 50,
          temperature: 0
        })
      });

      if (resp.status === 429) {
        console.warn('Rate limit 429 on ' + model + ', retrying next...');
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      
      if (!resp.ok) {
        console.warn('HTTP ' + resp.status + ' on ' + model + ', skipping...');
        continue;
      }

      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      
      if (content && content !== 'NULL') {
        const digits = content.replace(/\D/g, '');
        if (digits.length > 0) return parseInt(digits, 10);
      }
      
      return null;
    } catch (error) {
       console.error('Network error targeting ' + model + ':', error);
       continue;
    }
  }

  return null;
}
