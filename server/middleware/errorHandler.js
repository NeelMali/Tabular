/**
 * Centralized error handler middleware.
 * Catches all errors thrown in routes and sends structured JSON responses.
 */
export default function errorHandler(err, _req, res, _next) {
  // Log the error
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR:`, err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    const maxMB = process.env.MAX_FILE_SIZE_MB || '20';
    return res.status(413).json({
      error: `File too large. Maximum size is ${maxMB} MB.`,
      code: 'FILE_TOO_LARGE'
    });
  }

  // Multer file type error
  if (err.message && err.message.includes('Unsupported file type')) {
    return res.status(400).json({
      error: err.message,
      code: 'UNSUPPORTED_FILE_TYPE'
    });
  }

  // Validation errors (thrown manually with statusCode)
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code || 'VALIDATION_ERROR'
    });
  }

  // Gemini API errors
  if (err.message && err.message.includes('Gemini')) {
    return res.status(502).json({
      error: err.message,
      code: 'AI_SERVICE_ERROR'
    });
  }

  // Default: internal server error
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again.'
      : err.message,
    code: 'INTERNAL_ERROR'
  });
}
