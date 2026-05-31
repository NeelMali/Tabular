import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import XLSX from 'xlsx';
import mammoth from 'mammoth';
import Papa from 'papaparse';

// ── Supported extensions ───────────────────────────────────────────────────

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const STRUCTURED_EXTS = new Set(['.xlsx', '.xls', '.csv']);

const MIME_MAP = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
};

const FILE_TYPE_MAP = {
  '.pdf':  'PDF',
  '.xlsx': 'Excel',
  '.xls':  'Excel',
  '.docx': 'Word',
  '.csv':  'CSV',
  '.jpg':  'Image',
  '.jpeg': 'Image',
  '.png':  'Image',
  '.webp': 'Image',
};

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Parse a document and return its content for AI extraction.
 * For images, returns a base64 data URI.
 *
 * @returns {{ text: string, isImage: boolean }}
 */
export async function parseDocument(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === '.pdf')  return { text: await parsePdf(filePath), isImage: false };
  if (ext === '.docx') return { text: await parseDocx(filePath), isImage: false };
  if (ext === '.xlsx' || ext === '.xls') return { text: parseExcelText(filePath), isImage: false };
  if (ext === '.csv')  return { text: parseCsvText(filePath), isImage: false };
  if (IMAGE_EXTS.has(ext)) return { text: encodeImage(filePath, ext), isImage: true };

  throw Object.assign(
    new Error(`Unsupported file type: ${ext}`),
    { statusCode: 400, code: 'UNSUPPORTED_FILE_TYPE' }
  );
}

/**
 * For Excel/CSV files: directly parse ALL rows into structured objects.
 * No AI needed — returns rows mapped to the requested columns.
 * Returns null for non-structured file types (caller should use AI instead).
 *
 * @param {string}   filePath
 * @param {string}   originalName
 * @param {string[]} columns  - Requested column names
 * @returns {Object[]|null}
 */
export function parseStructured(filePath, originalName, columns) {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === '.xlsx' || ext === '.xls') {
    return parseExcelRows(filePath, columns);
  }

  if (ext === '.csv') {
    return parseCsvRows(filePath, columns);
  }

  return null; // caller will use AI
}

/**
 * Detect column headers from a file directly (no AI).
 * For Excel/CSV returns headers from the first row.
 * For other types returns null (caller should invoke AI).
 *
 * @returns {{ columns: string[]|null, needsAI: boolean, preview?: string, isImage?: boolean }}
 */
export async function detectColumns(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  // ── Structured: read header row directly ──
  if (ext === '.csv') {
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = Papa.parse(content, { skipEmptyLines: true, preview: 1 });
    const headers = result.data[0]?.map(h => String(h).trim()).filter(Boolean) || [];
    if (headers.length) return { columns: headers, needsAI: false };
    return { columns: null, needsAI: true, preview: content.slice(0, 3000) };
  }

  if (ext === '.xlsx' || ext === '.xls') {
    const buffer = fs.readFileSync(filePath);
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = ws ? XLSX.utils.sheet_to_json(ws, { header: 1 }) : [];
    const headers = data[0]?.map(h => String(h).trim()).filter(Boolean) || [];
    if (headers.length) return { columns: headers, needsAI: false };
    return { columns: null, needsAI: true, preview: parseExcelText(filePath).slice(0, 3000) };
  }

  // ── Unstructured: need AI ──
  if (ext === '.pdf') {
    const text = await parsePdf(filePath);
    return { columns: null, needsAI: true, preview: text.slice(0, 3000) };
  }

  if (ext === '.docx') {
    const text = await parseDocx(filePath);
    return { columns: null, needsAI: true, preview: text.slice(0, 3000) };
  }

  if (IMAGE_EXTS.has(ext)) {
    return { columns: null, needsAI: true, isImage: true, preview: encodeImage(filePath, ext) };
  }

  return { columns: null, needsAI: true, preview: '' };
}

/**
 * Human-readable file type label.
 */
export function getFileType(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  return FILE_TYPE_MAP[ext] || 'Unknown';
}

/**
 * True for Excel/CSV — these are parsed without AI.
 */
export function isStructuredFile(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  return STRUCTURED_EXTS.has(ext);
}

// ── Internal parsers ───────────────────────────────────────────────────────

async function parsePdf(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

async function parseDocx(filePath) {
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Convert Excel to plain CSV text (for AI ingestion).
 */
function parseExcelText(filePath) {
  const buffer = fs.readFileSync(filePath);
  const wb = XLSX.read(buffer, { type: 'buffer' });
  let text = '';
  for (const name of wb.SheetNames) {
    text += `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}\n\n`;
  }
  return text;
}

/**
 * Parse ALL rows from Excel, mapped to requested columns.
 * Column matching is case-insensitive and trims whitespace.
 */
function parseExcelRows(filePath, requestedCols) {
  const buffer = fs.readFileSync(filePath);
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const rows = [];

  for (const sheetName of wb.SheetNames) {
    const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });
    for (const srcRow of data) {
      rows.push(mapRow(srcRow, requestedCols));
    }
  }

  return rows;
}

/**
 * Parse ALL rows from CSV, mapped to requested columns.
 */
function parseCsvRows(filePath, requestedCols) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const result = Papa.parse(content, { header: true, skipEmptyLines: true, dynamicTyping: false });
  return result.data.map(srcRow => mapRow(srcRow, requestedCols));
}

/**
 * Convert a CSV plain text for AI ingestion (used in detect).
 */
function parseCsvText(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const result = Papa.parse(content, { skipEmptyLines: true });
  return result.data.map(row => row.join('\t')).join('\n');
}

/**
 * Map a raw parsed row to exactly the requested columns.
 * Matching is case-insensitive; falls back to null.
 */
function mapRow(srcRow, requestedCols) {
  const keys = Object.keys(srcRow);
  const lowerKeys = keys.map(k => k.toLowerCase().trim());

  const row = {};
  for (const col of requestedCols) {
    const idx = lowerKeys.indexOf(col.toLowerCase().trim());
    row[col] = idx !== -1 ? (srcRow[keys[idx]] ?? null) : null;
  }
  return row;
}

function encodeImage(filePath, ext) {
  const buffer = fs.readFileSync(filePath);
  const mime = MIME_MAP[ext] || 'image/jpeg';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}
