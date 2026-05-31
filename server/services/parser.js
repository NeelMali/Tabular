import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import XLSX from 'xlsx';
import mammoth from 'mammoth';
import Papa from 'papaparse';

/**
 * Parse a document file and return its text content.
 * For images, returns a base64-encoded data URI.
 *
 * @param {string} filePath - Absolute path to the uploaded file
 * @param {string} originalName - Original filename for extension detection
 * @returns {{ text: string, isImage: boolean }}
 */
export async function parseDocument(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  switch (ext) {
    case '.pdf':
      return { text: await parsePdf(filePath), isImage: false };

    case '.xlsx':
    case '.xls':
      return { text: parseExcel(filePath), isImage: false };

    case '.docx':
      return { text: await parseDocx(filePath), isImage: false };

    case '.csv':
      return { text: parseCsv(filePath), isImage: false };

    case '.jpg':
    case '.jpeg':
    case '.png':
    case '.webp':
      return { text: encodeImage(filePath, ext), isImage: true };

    default:
      throw Object.assign(
        new Error(`Unsupported file type: ${ext}`),
        { statusCode: 400, code: 'UNSUPPORTED_FILE_TYPE' }
      );
  }
}

// ── Individual parsers ──

async function parsePdf(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

function parseExcel(filePath) {
  const buffer = fs.readFileSync(filePath);
  const wb = XLSX.read(buffer, { type: 'buffer' });
  let text = '';
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    text += `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(ws)}\n\n`;
  }
  return text;
}

async function parseDocx(filePath) {
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function parseCsv(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const result = Papa.parse(fileContent, { skipEmptyLines: true });
  return result.data.map(row => row.join('\t')).join('\n');
}

function encodeImage(filePath, ext) {
  const buffer = fs.readFileSync(filePath);
  const mimeMap = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp'
  };
  const mime = mimeMap[ext] || 'image/jpeg';
  const base64 = buffer.toString('base64');
  return `data:${mime};base64,${base64}`;
}

/**
 * Get a human-readable file type label from extension.
 */
export function getFileType(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const map = {
    '.pdf': 'PDF',
    '.xlsx': 'Excel',
    '.xls': 'Excel',
    '.docx': 'Word',
    '.csv': 'CSV',
    '.jpg': 'Image',
    '.jpeg': 'Image',
    '.png': 'Image',
    '.webp': 'Image'
  };
  return map[ext] || 'Unknown';
}
