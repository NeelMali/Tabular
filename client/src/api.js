const API_BASE = '/api';

/**
 * Extract data from a document file.
 */
export async function extractData(file, columns) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('columns', JSON.stringify(columns));

  const res = await fetch(`${API_BASE}/extract`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
    throw new Error(err.error || `Extraction failed with status ${res.status}`);
  }

  return res.json();
}

/**
 * Auto-detect column headers from a file.
 */
export async function detectColumns(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/detect-columns`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
    throw new Error(err.error || `Column detection failed with status ${res.status}`);
  }

  return res.json();
}

/**
 * Get available AI providers and models.
 */
export async function getProviders() {
  const res = await fetch(`${API_BASE}/providers`);
  if (!res.ok) throw new Error('Failed to fetch providers');
  return res.json();
}

/**
 * Get extraction history.
 */
export async function getHistory() {
  const res = await fetch(`${API_BASE}/extractions`);
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

/**
 * Get a single extraction by ID.
 */
export async function getExtraction(id) {
  const res = await fetch(`${API_BASE}/extractions/${id}`);
  if (!res.ok) throw new Error('Extraction not found');
  return res.json();
}

/**
 * Delete an extraction record.
 */
export async function deleteExtraction(id) {
  const res = await fetch(`${API_BASE}/extractions/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete extraction');
}
