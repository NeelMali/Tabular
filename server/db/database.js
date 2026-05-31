/**
 * Simple JSON file-based database for extraction history.
 * No native dependencies — works everywhere without build tools.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', '..', 'data', 'extractions.json');
const dataDir = path.dirname(dbPath);

// Auto-create data directory
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function readDb() {
  try {
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    // Corrupted file — start fresh
  }
  return { nextId: 1, extractions: [] };
}

function writeDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Query functions ──

export function insertExtraction({ filename, columns, result, rowCount, fileType }) {
  const db = readDb();
  const id = db.nextId++;
  const record = {
    id,
    filename,
    columns,
    result,
    row_count: rowCount,
    file_type: fileType,
    created_at: new Date().toISOString()
  };
  db.extractions.unshift(record); // newest first
  writeDb(db);
  return id;
}

export function getAllExtractions(limit = 50) {
  const db = readDb();
  return db.extractions.slice(0, limit).map(({ result, ...rest }) => rest);
}

export function getExtractionById(id) {
  const db = readDb();
  return db.extractions.find(e => e.id === id) || null;
}

export function deleteExtraction(id) {
  const db = readDb();
  const idx = db.extractions.findIndex(e => e.id === id);
  if (idx === -1) return false;
  db.extractions.splice(idx, 1);
  writeDb(db);
  return true;
}

export function closeDb() {
  // No-op — JSON file needs no cleanup
}

export function getDb() {
  return readDb();
}
