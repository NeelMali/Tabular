import { Router } from 'express';
import upload, { cleanupFile } from '../middleware/upload.js';
import extractionLimiter from '../middleware/rateLimiter.js';
import {
  parseDocument,
  parseStructured,
  detectColumns,
  getFileType,
  isStructuredFile,
} from '../services/parser.js';
import { extractWithAI, detectColumnsWithAI } from '../services/ai.js';
import {
  insertExtraction,
  getAllExtractions,
  getExtractionById,
  deleteExtraction,
} from '../db/database.js';

const router = Router();

// ── POST /api/extract ────────────────────────────────────────────────────────

router.post('/extract', extractionLimiter, upload.single('file'), async (req, res, next) => {
  let filePath = null;

  try {
    if (!req.file) {
      const err = new Error('No file uploaded.');
      err.statusCode = 400;
      throw err;
    }
    filePath = req.file.path;

    // Parse column list
    let columns;
    try {
      columns = JSON.parse(req.body.columns || '[]');
    } catch {
      const err = new Error('Invalid columns format. Expected a JSON array of strings.');
      err.statusCode = 400;
      throw err;
    }

    columns = columns.map(c => String(c).trim()).filter(Boolean);
    if (!columns.length) {
      const err = new Error('At least one column is required.');
      err.statusCode = 400;
      throw err;
    }

    const originalName = req.file.originalname;
    let result;

    if (isStructuredFile(originalName)) {
      // ── Excel / CSV: parse directly — all rows, no AI ──
      console.log(`  📋 Structured file detected — parsing directly (${originalName})`);
      result = parseStructured(filePath, originalName, columns);
    } else {
      // ── PDF / Word / Image: send to Claude ──
      const { text, isImage } = await parseDocument(filePath, originalName);
      result = await extractWithAI(text, columns, isImage);
    }

    const fileType = getFileType(originalName);
    const id = insertExtraction({
      filename: originalName,
      columns,
      result,
      rowCount: result.length,
      fileType,
    });

    res.json({
      id: Number(id),
      filename: originalName,
      fileType,
      columns,
      data: result,
      rowCount: result.length,
    });

  } catch (err) {
    next(err);
  } finally {
    cleanupFile(filePath);
  }
});

// ── POST /api/detect-columns ─────────────────────────────────────────────────

router.post('/detect-columns', upload.single('file'), async (req, res, next) => {
  let filePath = null;

  try {
    if (!req.file) {
      const err = new Error('No file uploaded.');
      err.statusCode = 400;
      throw err;
    }
    filePath = req.file.path;

    const detection = await detectColumns(filePath, req.file.originalname);

    if (!detection.needsAI && detection.columns) {
      return res.json({
        columns: detection.columns,
        method: 'direct',
        fileType: getFileType(req.file.originalname),
      });
    }

    // AI detection for unstructured documents
    const columns = await detectColumnsWithAI(
      detection.preview || '',
      detection.isImage || false
    );

    res.json({
      columns,
      method: 'ai',
      fileType: getFileType(req.file.originalname),
    });

  } catch (err) {
    next(err);
  } finally {
    cleanupFile(filePath);
  }
});

// ── GET /api/extractions ──────────────────────────────────────────────────────

router.get('/extractions', (_req, res) => {
  res.json(getAllExtractions(50));
});

// ── GET /api/extractions/:id ──────────────────────────────────────────────────

router.get('/extractions/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid extraction ID.' });
  const extraction = getExtractionById(id);
  if (!extraction) return res.status(404).json({ error: 'Extraction not found.' });
  res.json(extraction);
});

// ── DELETE /api/extractions/:id ───────────────────────────────────────────────

router.delete('/extractions/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid extraction ID.' });
  const deleted = deleteExtraction(id);
  if (!deleted) return res.status(404).json({ error: 'Extraction not found.' });
  res.json({ success: true });
});

export default router;
