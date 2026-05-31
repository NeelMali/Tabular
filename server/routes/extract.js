import { Router } from 'express';
import upload, { cleanupFile } from '../middleware/upload.js';
import extractionLimiter from '../middleware/rateLimiter.js';
import { parseDocument, getFileType, detectColumns } from '../services/parser.js';
import { extractWithAI, detectColumnsWithAI, getProviderList } from '../services/gemini.js';
import {
  insertExtraction,
  getAllExtractions,
  getExtractionById,
  deleteExtraction
} from '../db/database.js';

const router = Router();

/**
 * Helper: extract AI options from request body.
 */
function getAIOptions(body) {
  return {
    provider: body.provider || 'groq',
    model: body.model || undefined,
    apiKey: body.apiKey || undefined,
  };
}

/**
 * GET /api/providers
 * List available AI providers and their models.
 */
router.get('/providers', (_req, res) => {
  res.json(getProviderList());
});

/**
 * POST /api/extract
 * Upload a file + provide columns → extract structured data.
 */
router.post('/extract', extractionLimiter, upload.single('file'), async (req, res, next) => {
  let filePath = null;

  try {
    if (!req.file) {
      const err = new Error('No file uploaded. Please attach a document.');
      err.statusCode = 400;
      throw err;
    }
    filePath = req.file.path;

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

    columns = columns.map(c => String(c).trim()).filter(Boolean);
    if (columns.length === 0) {
      const err = new Error('All column names are empty.');
      err.statusCode = 400;
      throw err;
    }

    const { text, isImage } = await parseDocument(filePath, req.file.originalname);
    const aiOpts = getAIOptions(req.body);
    const result = await extractWithAI(text, columns, isImage, aiOpts);

    const fileType = getFileType(req.file.originalname);
    const id = insertExtraction({
      filename: req.file.originalname,
      columns,
      result,
      rowCount: result.length,
      fileType
    });

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
    cleanupFile(filePath);
  }
});

/**
 * POST /api/detect-columns
 * Upload a file → auto-detect column headers.
 */
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
        fileType: getFileType(req.file.originalname)
      });
    }

    const aiOpts = getAIOptions(req.body);
    const columns = await detectColumnsWithAI(
      detection.preview || '',
      detection.isImage || false,
      aiOpts
    );

    res.json({
      columns,
      method: 'ai',
      fileType: getFileType(req.file.originalname)
    });

  } catch (err) {
    next(err);
  } finally {
    cleanupFile(filePath);
  }
});

/**
 * GET /api/extractions
 */
router.get('/extractions', (_req, res) => {
  const extractions = getAllExtractions(50);
  res.json(extractions);
});

/**
 * GET /api/extractions/:id
 */
router.get('/extractions/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid extraction ID.' });
  const extraction = getExtractionById(id);
  if (!extraction) return res.status(404).json({ error: 'Extraction not found.' });
  res.json(extraction);
});

/**
 * DELETE /api/extractions/:id
 */
router.delete('/extractions/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid extraction ID.' });
  const deleted = deleteExtraction(id);
  if (!deleted) return res.status(404).json({ error: 'Extraction not found.' });
  res.json({ success: true });
});

export default router;
