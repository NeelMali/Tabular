/**
 * Local AI integration using Ollama.
 * Connects to a locally running Ollama instance for totally private extractions.
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are a strict data extraction expert. Extract structured data from the provided document into rows matching the given column names.

Rules:
- You must output ONLY valid JSON.
- The root must be a JSON object containing a "data" array: {"data": [...]}.
- Each object in the array represents one row of data.
- Keys must exactly match the column names provided.
- Use null for any value that is not found.
- Extract ALL records found in the document.
- Do not hallucinate or guess data. Only extract what is clearly present.
- If no relevant data is found, return {"data": []}.`;

/**
 * Extract structured data from document content using Local Ollama API.
 *
 * @param {string} content - Document text or base64 image data URI
 * @param {string[]} columns - Column names to extract
 * @param {boolean} isImage - Whether the content is an image
 * @returns {Object[]} Array of extracted row objects
 */
export async function extractWithGemini(content, columns, isImage = false) {
  const userText = `Extract the following columns: ${columns.join(', ')}\n\nDocument text:\n"""\n${content.slice(0, 30000)}\n"""`;

  let model = 'llama-3.3-70b-versatile';
  let messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userText }
  ];

  if (isImage) {
    model = 'llama-3.2-90b-vision-preview';
    const b64Data = content.includes(',') ? content : `data:image/jpeg;base64,${content}`;
    messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: `Extract the following columns: ${columns.join(', ')}` },
          { type: 'image_url', image_url: { url: b64Data } }
        ]
      }
    ];
  }

  const payload = {
    model: model,
    messages: messages,
    response_format: { type: 'json_object' },
    temperature: 0.0,
    top_p: 0.9
  };

  // Retry logic
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error?.message || `Groq API error (${res.status})`);
      }

      const data = await res.json();
      const text = data.choices[0].message.content;

      // Parse the JSON object
      const parsed = JSON.parse(text);
      if (!parsed.data || !Array.isArray(parsed.data)) {
        throw new Error('AI returned non-array response in "data" field');
      }

      if (data.usage) {
        console.log(`  📊 Groq Tokens — total: ${data.usage.total_tokens}`);
      }

      return parsed.data;
    } catch (err) {
      lastError = err;
      const cause = err.cause ? ` (Cause: ${err.cause.code || err.cause.message})` : '';
      console.error(`  ⚠️ Attempt ${attempt + 1}/3 failed:`, err.message + cause);

      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  throw Object.assign(
    new Error(`Groq AI extraction failed: ${lastError?.message}`),
    { statusCode: 502, code: 'AI_SERVICE_ERROR' }
  );
}
