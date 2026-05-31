import { Router } from 'express';
import upload, { cleanupFile } from '../middleware/upload.js';
import extractionLimiter from '../middleware/rateLimiter.js';
import { parseDocument, getFileType } from '../services/parser.js';
import { extractWithGemini } from '../services/gemini.js';
import {
  insertExtraction,
  getAllExtractions,
  getExtractionById,
  deleteExtraction
} from '../db/database.js';

const router = Router();

/**
 * POST /api/extract
 * Upload a file + provide columns → extract structured data via Gemini.
 *
 * Body (multipart/form-data):
 *   - file: the document file
 *   - columns: JSON string array of column names, e.g. '["Name","Email"]'
 */
router.post('/extract', extractionLimiter, upload.single('file'), async (req, res, next) => {
  let filePath = null;

  try {
    // Validate file
    if (!req.file) {
      const err = new Error('No file uploaded. Please attach a document.');
      err.statusCode = 400;
      throw err;
    }
    filePath = req.file.path;

    // Validate columns
    let columns;
    try {
      columns = JSON.parse(req.body.columns || '[]');
    } catch {
      const err = new Error('Invalid columns format. Expected a JSON array of strings.');
      err.statusCode = 400;
      throw err;
    }

    if (!Array.isArray(columns) || columns.length === 0) {
      const err = new Error('At least one column is required.');
      err.statusCode = 400;
      throw err;
    }

    // Filter out empty column names
    columns = columns.map(c => String(c).trim()).filter(Boolean);
    if (columns.length === 0) {
      const err = new Error('All column names are empty. Please provide at least one valid column name.');
      err.statusCode = 400;
      throw err;
    }

    // Parse document
    const { text, isImage } = await parseDocument(filePath, req.file.originalname);

    // Extract with Gemini
    const result = await extractWithGemini(text, columns, isImage);

    // Save to database
    const fileType = getFileType(req.file.originalname);
    const id = insertExtraction({
      filename: req.file.originalname,
      columns,
      result,
      rowCount: result.length,
      fileType
    });

    // Respond
    res.json({
      id: Number(id),
      filename: req.file.originalname,
      fileType,
      columns,
      data: result,
      rowCount: result.length
    });

  } catch (err) {
    next(err);
  } finally {
    // Always clean up uploaded file
    cleanupFile(filePath);
  }
});

/**
 * GET /api/extractions
 * List past extractions (most recent first).
 */
router.get('/extractions', (_req, res) => {
  const extractions = getAllExtractions(50);
  res.json(extractions);
});

/**
 * GET /api/extractions/:id
 * Get a single extraction with full result data.
 */
router.get('/extractions/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid extraction ID.' });
  }

  const extraction = getExtractionById(id);
  if (!extraction) {
    return res.status(404).json({ error: 'Extraction not found.' });
  }

  res.json(extraction);
});

/**
 * DELETE /api/extractions/:id
 * Delete an extraction record.
 */
router.delete('/extractions/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid extraction ID.' });
  }

  const deleted = deleteExtraction(id);
  if (!deleted) {
    return res.status(404).json({ error: 'Extraction not found.' });
  }

  res.json({ success: true });
});

export default router;
