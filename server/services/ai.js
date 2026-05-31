/**
 * AI service — routes to Anthropic Claude by default.
 * For structured files (Excel/CSV), extraction is handled directly by the parser.
 * AI is only used for unstructured documents: PDF, Word, and Images.
 */

import Anthropic from '@anthropic-ai/sdk';

// ── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_MODEL  = 'claude-sonnet-4-20250514';
const MAX_TEXT_CHARS = 100_000; // ~75k tokens — well within Claude's 200k context

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

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw Object.assign(
      new Error('ANTHROPIC_API_KEY is not set in .env'),
      { statusCode: 503 }
    );
  }
  return new Anthropic({ apiKey: key });
}

function parseJSON(raw) {
  // Strip any accidental markdown fences
  const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract structured data from a document using Claude.
 * Only called for PDF / Word / Image — Excel & CSV are parsed directly.
 *
 * @param {string}   content  - Text content or base64 data URI (for images)
 * @param {string[]} columns  - Column names to extract
 * @param {boolean}  isImage  - Whether content is an image data URI
 * @returns {Object[]} Array of row objects
 */
export async function extractWithAI(content, columns, isImage) {
  const client = getClient();

  let userContent;

  if (isImage) {
    // Claude vision: send image as base64
    const [meta, data] = content.split(',');
    const mediaType = (meta.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
    userContent = [
      {
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data },
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

  const msg = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 8192,
    system: EXTRACT_SYSTEM,
    messages: [{ role: 'user', content: userContent }],
  });

  const raw = msg.content.find(b => b.type === 'text')?.text || '{"data":[]}';

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

  console.log(`  📊 Claude (${DEFAULT_MODEL}) — extracted ${parsed.data.length} rows | tokens: ${msg.usage?.input_tokens}→${msg.usage?.output_tokens}`);

  return parsed.data;
}

/**
 * Detect column headers from an unstructured document using Claude.
 *
 * @param {string}  preview   - First ~3000 chars of document text, or base64 image URI
 * @param {boolean} isImage   - Whether preview is an image
 * @returns {string[]} Array of detected column names
 */
export async function detectColumnsWithAI(preview, isImage) {
  const client = getClient();

  let userContent;

  if (isImage) {
    const [meta, data] = preview.split(',');
    const mediaType = (meta.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
    userContent = [
      {
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data },
      },
      { type: 'text', text: 'Detect the column names/fields in this image. Output JSON only.' },
    ];
  } else {
    userContent = `Detect the column names from this document excerpt:\n\n"""\n${preview}\n"""\n\nOutput JSON only.`;
  }

  const msg = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 1024,
    system: DETECT_SYSTEM,
    messages: [{ role: 'user', content: userContent }],
  });

  const raw = msg.content.find(b => b.type === 'text')?.text || '{"columns":[]}';

  try {
    const parsed = parseJSON(raw);
    return Array.isArray(parsed.columns) ? parsed.columns : [];
  } catch {
    return [];
  }
}
