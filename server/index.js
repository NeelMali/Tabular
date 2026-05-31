import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import extractRoutes from './routes/extract.js';
import errorHandler from './middleware/errorHandler.js';
import { closeDb } from './db/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

// ── Security ──
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts in dev
  crossOriginEmbedderPolicy: false
}));

// ── CORS — allow Vite dev server in development ──
app.use(cors({
  origin: isProduction ? false : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

// ── Logging ──
app.use(morgan(isProduction ? 'combined' : 'dev'));

// ── Body parsing ──
app.use(express.json({ limit: '1mb' }));

// ── API routes ──
app.use('/api', extractRoutes);

// ── Serve frontend in production ──
if (isProduction) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ── Health check ──
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Error handler (must be last) ──
app.use(errorHandler);

// ── Start server ──
const server = app.listen(PORT, () => {
  console.log(`\n  ⚡ Server running at http://localhost:${PORT}`);
  console.log(`  📦 Mode: ${isProduction ? 'production' : 'development'}`);
  if (!isProduction) {
    console.log(`  🖥️  Frontend: http://localhost:5173\n`);
  }
});

// ── Graceful shutdown ──
function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    closeDb();
    process.exit(0);
  });
  // Force exit after 5s
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
