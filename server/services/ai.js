/**
 * AI service — calls Groq API (OpenAI-compatible format).
 * Only used for unstructured documents (PDF, Word, Image).
 * Excel/CSV are parsed directly by parser.js — no AI needed.
 */

const DEFAULT_MODEL  = 'meta-llama/llama-4-scout-17b-16e-instruct';
const API_URL        = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_TEXT_CHARS  = 100_000;

// ── Prompts ─────────────────────────────────────────────────────────────────

const EXTRACT_SYSTEM = `You are a strict data extraction expert. Your job is to pull structured data from the provided document.

Rules:
- Output ONLY valid JSON — no markdown fences, no commentary.
- Root key must be "data": {"data": [...]}.
- Every object in the array represents one record/row.
- Keys must EXACTLY match the column names provided.
- Extract EVERY record present. Do not truncate or summarise.
- Use null for missing values. Never invent data.`;

const DETECT_SYSTEM = `You are a data analysis expert. Identify the column names / fields present in this document.

Rules:
- Output ONLY valid JSON: {"columns": ["col1", "col2", ...]}.
- Return exact header names as they appear.
- Return at most 30 columns.
- If no columns found, return {"columns": []}.`;

// ── Helpers ─────────────────────────────────────────────────────────────────

function getApiKey() {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw Object.assign(
      new Error('GROQ_API_KEY is not set in .env'),
      { statusCode: 503 }
    );
  }
  return key;
}

async function callGroq(systemPrompt, userContent, maxTokens = 8192) {
  const apiKey = getApiKey();

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`  ❌ Groq API error (${res.status}): ${body}`);
    throw Object.assign(
      new Error(`Groq API error: ${res.status} — ${body.slice(0, 200)}`),
      { statusCode: 502 }
    );
  }

  const data = await res.json();

  if (data.usage) {
    console.log(`  📊 Groq (${DEFAULT_MODEL}) — input: ${data.usage.prompt_tokens}, output: ${data.usage.completion_tokens} tokens`);
  }

  const text = data.choices?.[0]?.message?.content || '';
  return text;
}

function parseJSON(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(cleaned);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract structured data from a document using Groq.
 * Only called for PDF / Word / Image — Excel & CSV are parsed directly.
 */
export async function extractWithAI(content, columns, isImage) {
  let userContent;

  if (isImage) {
    // Groq vision: send image as base64 URL in content array
    userContent = [
      {
        type: 'image_url',
        image_url: { url: content },
      },
      {
        type: 'text',
        text: `Extract these columns from the image: ${columns.join(', ')}\n\nReturn ALL rows found. Output JSON only.`,
      },
    ];
  } else {
    const truncated = content.slice(0, MAX_TEXT_CHARS);
    userContent = `Extract these columns: ${columns.join(', ')}\n\nDocument:\n"""\n${truncated}\n"""\n\nReturn ALL rows. Output JSON only.`;
  }

  const raw = await callGroq(EXTRACT_SYSTEM, userContent);

  let parsed;
  try {
    parsed = parseJSON(raw);
  } catch {
    throw Object.assign(
      new Error('AI returned invalid JSON. Try again or check your columns.'),
      { statusCode: 502 }
    );
  }

  if (!Array.isArray(parsed.data)) {
    throw Object.assign(
      new Error('AI response missing "data" array.'),
      { statusCode: 502 }
    );
  }

  console.log(`  ✅ Extracted ${parsed.data.length} rows`);
  return parsed.data;
}

/**
 * Detect column headers from an unstructured document using Groq.
 */
export async function detectColumnsWithAI(preview, isImage) {
  let userContent;

  if (isImage) {
    userContent = [
      {
        type: 'image_url',
        image_url: { url: preview },
      },
      { type: 'text', text: 'Detect the column names/fields in this image. Output JSON only.' },
    ];
  } else {
    userContent = `Detect the column names from this document excerpt:\n\n"""\n${preview}\n"""\n\nOutput JSON only.`;
  }

  const raw = await callGroq(DETECT_SYSTEM, userContent, 1024);

  try {
    const parsed = parseJSON(raw);
    return Array.isArray(parsed.columns) ? parsed.columns : [];
  } catch {
    return [];
  }
}
