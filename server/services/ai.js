/**
 * AI service — calls Anthropic Claude API directly via fetch.
 * No external SDK required.
 *
 * Only used for unstructured documents (PDF, Word, Image).
 * Excel/CSV are parsed directly by parser.js — no AI needed.
 */

const DEFAULT_MODEL  = 'claude-sonnet-4-20250514';
const API_URL        = 'https://api.anthropic.com/v1/messages';
const API_VERSION    = '2023-06-01';
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
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw Object.assign(
      new Error('ANTHROPIC_API_KEY is not set in .env'),
      { statusCode: 503 }
    );
  }
  return key;
}

async function callClaude(system, messages, maxTokens = 8192) {
  const apiKey = getApiKey();

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': API_VERSION,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`  ❌ Claude API error (${res.status}): ${body}`);
    throw Object.assign(
      new Error(`Claude API error: ${res.status} — ${body.slice(0, 200)}`),
      { statusCode: 502 }
    );
  }

  const data = await res.json();

  if (data.usage) {
    console.log(`  📊 Claude (${DEFAULT_MODEL}) — input: ${data.usage.input_tokens}, output: ${data.usage.output_tokens} tokens`);
  }

  const text = data.content?.find(b => b.type === 'text')?.text || '';
  return text;
}

function parseJSON(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(cleaned);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract structured data from a document using Claude.
 * Only called for PDF / Word / Image — Excel & CSV are parsed directly.
 */
export async function extractWithAI(content, columns, isImage) {
  let userContent;

  if (isImage) {
    const [meta, b64data] = content.split(',');
    const mediaType = (meta.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
    userContent = [
      {
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: b64data },
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

  const raw = await callClaude(EXTRACT_SYSTEM, [{ role: 'user', content: userContent }]);

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
 * Detect column headers from an unstructured document using Claude.
 */
export async function detectColumnsWithAI(preview, isImage) {
  let userContent;

  if (isImage) {
    const [meta, b64data] = preview.split(',');
    const mediaType = (meta.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
    userContent = [
      {
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: b64data },
      },
      { type: 'text', text: 'Detect the column names/fields in this image. Output JSON only.' },
    ];
  } else {
    userContent = `Detect the column names from this document excerpt:\n\n"""\n${preview}\n"""\n\nOutput JSON only.`;
  }

  const raw = await callClaude(DETECT_SYSTEM, [{ role: 'user', content: userContent }], 1024);

  try {
    const parsed = parseJSON(raw);
    return Array.isArray(parsed.columns) ? parsed.columns : [];
  } catch {
    return [];
  }
}
