/**
 * DE Connect Cloud API Server
 */

import express from 'express';
import cors from 'cors';
import { agentsRouter } from './routes/agents.js';
import { syncRouter } from './routes/sync.js';
import { practicesRouter } from './routes/practices.js';
import { getDatabase, closeDatabase } from './db/database.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.raw({ type: 'application/zip', limit: '100mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/v1/agents', agentsRouter);
app.use('/v1/sync', syncRouter);
app.use('/v1/practices', practicesRouter);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database on startup
getDatabase();

// Graceful shutdown
const shutdown = (): void => {
  console.log('Shutting down...');
  closeDatabase();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
app.listen(PORT, () => {
  console.log(`DE Connect Cloud API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export { app };
