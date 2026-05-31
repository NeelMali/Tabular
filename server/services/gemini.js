/**
 * Multi-provider AI service.
 * Routes requests to Groq, Google Gemini, OpenAI, or Anthropic Claude.
 */

// ── Provider Configurations ──
const PROVIDERS = {
  groq: {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    models: [
      { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout (Free)' },
      { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick' },
      { id: 'qwen/qwen3-32b', label: 'Qwen 3 32B' },
      { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 70B' },
    ],
    defaultModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
    format: 'openai',
    envKey: 'GROQ_API_KEY',
  },
  google: {
    name: 'Google',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    ],
    defaultModel: 'gemini-2.5-flash',
    format: 'openai', // Google supports OpenAI-compatible endpoint
    envKey: 'GOOGLE_API_KEY',
  },
  openai: {
    name: 'OpenAI',
    url: 'https://api.openai.com/v1/chat/completions',
    models: [
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
      { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    ],
    defaultModel: 'gpt-4.1-mini',
    format: 'openai',
    envKey: 'OPENAI_API_KEY',
  },
  claude: {
    name: 'Anthropic Claude',
    url: 'https://api.anthropic.com/v1/messages',
    models: [
      { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
      { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    ],
    defaultModel: 'claude-sonnet-4-20250514',
    format: 'anthropic',
    envKey: 'ANTHROPIC_API_KEY',
  },
};

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

const DETECT_PROMPT = `You are a data analysis expert. Analyze the following document and identify the column names / field names / data categories present in it.

Rules:
- Return ONLY valid JSON: {"columns": ["col1", "col2", ...]}
- Return the exact column names as they appear in the document.
- If the document is a table, return the header row values.
- If the document is unstructured, identify the key data fields present.
- Return at most 20 columns.
- If you cannot detect any columns, return {"columns": []}.`;

/**
 * Get the list of available providers and their models.
 */
export function getProviderList() {
  return Object.entries(PROVIDERS).map(([key, p]) => ({
    id: key,
    name: p.name,
    models: p.models,
    defaultModel: p.defaultModel,
    requiresKey: !process.env[p.envKey],
  }));
}

/**
 * Resolve the API key: prefer user-provided, fall back to .env
 */
function resolveApiKey(provider, userKey) {
  const key = userKey || process.env[PROVIDERS[provider]?.envKey];
  if (!key) {
    throw Object.assign(
      new Error(`No API key provided for ${PROVIDERS[provider]?.name || provider}. Please enter your API key in the settings.`),
      { statusCode: 400, code: 'MISSING_API_KEY' }
    );
  }
  return key;
}

/**
 * Call an OpenAI-compatible chat completions endpoint.
 */
async function callOpenAI(url, apiKey, model, messages, provider) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  // Google uses query param for key
  let finalUrl = url;
  if (provider === 'google') {
    finalUrl = `${url}?key=${apiKey}`;
    delete headers['Authorization'];
  }

  const payload = {
    model,
    messages,
    response_format: { type: 'json_object' },
    temperature: 0.0,
  };

  const res = await fetch(finalUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg = errBody.error?.message || `API error (${res.status})`;
    throw new Error(msg);
  }

  const data = await res.json();
  if (data.usage) {
    console.log(`  📊 ${PROVIDERS[provider]?.name} Tokens — total: ${data.usage.total_tokens || 'N/A'}`);
  }
  return data.choices[0].message.content;
}

/**
 * Call Anthropic's Claude Messages API.
 */
async function callClaude(apiKey, model, systemPrompt, messages) {
  // Convert from OpenAI-style messages to Claude format
  const claudeMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => {
      if (typeof m.content === 'string') {
        return { role: m.role, content: m.content };
      }
      // Multimodal: convert image_url to Claude's source format
      const parts = m.content.map(part => {
        if (part.type === 'text') return { type: 'text', text: part.text };
        if (part.type === 'image_url') {
          const url = part.image_url.url;
          const match = url.match(/^data:(image\/\w+);base64,(.+)$/);
          if (match) {
            return {
              type: 'image',
              source: { type: 'base64', media_type: match[1], data: match[2] }
            };
          }
        }
        return part;
      });
      return { role: m.role, content: parts };
    });

  const payload = {
    model,
    max_tokens: 8192,
    system: systemPrompt,
    messages: claudeMessages,
  };

  const res = await fetch(PROVIDERS.claude.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `Claude API error (${res.status})`);
  }

  const data = await res.json();
  if (data.usage) {
    console.log(`  📊 Claude Tokens — in: ${data.usage.input_tokens}, out: ${data.usage.output_tokens}`);
  }
  return data.content[0].text;
}

/**
 * Universal AI call dispatcher.
 */
async function callAI(provider, model, apiKey, systemPrompt, messages) {
  const config = PROVIDERS[provider];
  if (!config) throw new Error(`Unknown provider: ${provider}`);

  if (config.format === 'anthropic') {
    return callClaude(apiKey, model, systemPrompt, messages);
  }

  // OpenAI-compatible (Groq, Google, OpenAI)
  const allMessages = [{ role: 'system', content: systemPrompt }, ...messages];
  return callOpenAI(config.url, apiKey, model, allMessages, provider);
}

/**
 * Build messages for extraction.
 */
function buildExtractionMessages(content, columns, isImage) {
  if (isImage) {
    const b64Data = content.includes(',') ? content : `data:image/jpeg;base64,${content}`;
    return [{
      role: 'user',
      content: [
        { type: 'text', text: `Extract the following columns: ${columns.join(', ')}` },
        { type: 'image_url', image_url: { url: b64Data } },
      ],
    }];
  }
  return [{
    role: 'user',
    content: `Extract the following columns: ${columns.join(', ')}\n\nDocument text:\n"""\n${content.slice(0, 30000)}\n"""`,
  }];
}

/**
 * Extract structured data from document content.
 *
 * @param {string} content - Document text or base64 image data URI
 * @param {string[]} columns - Column names to extract
 * @param {boolean} isImage - Whether the content is an image
 * @param {{ provider?: string, model?: string, apiKey?: string }} opts
 * @returns {Object[]} Array of extracted row objects
 */
export async function extractWithAI(content, columns, isImage = false, opts = {}) {
  const provider = opts.provider || 'groq';
  const config = PROVIDERS[provider];
  const model = opts.model || config?.defaultModel;
  const apiKey = resolveApiKey(provider, opts.apiKey);

  const messages = buildExtractionMessages(content, columns, isImage);

  // Retry logic
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await callAI(provider, model, apiKey, SYSTEM_PROMPT, messages);

      // Parse the JSON response
      const parsed = JSON.parse(text);
      if (!parsed.data || !Array.isArray(parsed.data)) {
        throw new Error('AI returned non-array response in "data" field');
      }
      return parsed.data;
    } catch (err) {
      lastError = err;
      console.error(`  ⚠️ Attempt ${attempt + 1}/3 failed:`, err.message);
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
    }
  }

  throw Object.assign(
    new Error(`AI extraction failed (${PROVIDERS[provider]?.name}): ${lastError?.message}`),
    { statusCode: 502, code: 'AI_SERVICE_ERROR' }
  );
}

/**
 * Detect column names from a document preview using AI.
 */
export async function detectColumnsWithAI(preview, isImage = false, opts = {}) {
  const provider = opts.provider || 'groq';
  const config = PROVIDERS[provider];
  const model = opts.model || config?.defaultModel;
  const apiKey = resolveApiKey(provider, opts.apiKey);

  let messages;
  if (isImage) {
    const b64Data = preview.includes(',') ? preview : `data:image/jpeg;base64,${preview}`;
    messages = [{
      role: 'user',
      content: [
        { type: 'text', text: 'Detect the column names from this document.' },
        { type: 'image_url', image_url: { url: b64Data } },
      ],
    }];
  } else {
    messages = [{
      role: 'user',
      content: `Document preview:\n"""\n${preview}\n"""`,
    }];
  }

  const text = await callAI(provider, model, apiKey, DETECT_PROMPT, messages);
  const parsed = JSON.parse(text);

  if (parsed.columns && Array.isArray(parsed.columns)) {
    return parsed.columns.map(c => String(c).trim()).filter(Boolean);
  }
  return [];
}

// Backwards-compatible alias
export const extractWithGemini = extractWithAI;
