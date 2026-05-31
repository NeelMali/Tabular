const API_BASE = '/api';

/**
 * Extract data from a document file.
 * @param {File} file - The document file
 * @param {string[]} columns - Column names to extract
 * @returns {Promise<Object>} Extraction result with data array
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
 * Get extraction history.
 * @returns {Promise<Object[]>} Array of past extractions
 */
export async function getHistory() {
  const res = await fetch(`${API_BASE}/extractions`);
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

/**
 * Get a single extraction by ID.
 * @param {number} id
 * @returns {Promise<Object>} Full extraction with result data
 */
export async function getExtraction(id) {
  const res = await fetch(`${API_BASE}/extractions/${id}`);
  if (!res.ok) throw new Error('Extraction not found');
  return res.json();
}

/**
 * Delete an extraction record.
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteExtraction(id) {
  const res = await fetch(`${API_BASE}/extractions/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete extraction');
}
