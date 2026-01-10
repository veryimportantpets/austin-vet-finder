/**
 * Sync Routes
 *
 * Package upload and sync status endpoints.
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import multer from 'multer';
import {
  createSyncPackage,
  getSyncPackageById,
  getAgentById,
} from '../db/database.js';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Configure multer for file uploads
const uploadsDir = process.env.UPLOADS_DIR ?? './data/uploads';
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max
  },
});

/**
 * POST /v1/sync
 * Upload a sync package
 */
router.post(
  '/',
  authMiddleware,
  upload.single('package'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const agentId = req.agent?.id;
      const practiceId = req.agent?.practiceId;

      if (!agentId || !practiceId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Handle both multipart and raw body uploads
      let fileBuffer: Buffer;
      let filename: string;

      if (req.file) {
        // Multipart upload
        fileBuffer = req.file.buffer;
        filename = req.file.originalname;
      } else if (req.body && Buffer.isBuffer(req.body)) {
        // Raw body upload
        fileBuffer = req.body;
        filename = req.headers['x-filename'] as string ?? `sync_${Date.now()}.zip`;
      } else if (req.headers['content-type'] === 'application/zip') {
        // Stream body as buffer
        const chunks: Buffer[] = [];
        for await (const chunk of req as unknown as AsyncIterable<Buffer>) {
          chunks.push(chunk);
        }
        fileBuffer = Buffer.concat(chunks);
        filename = req.headers['x-filename'] as string ?? `sync_${Date.now()}.zip`;
      } else {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // Generate sync ID and file path
      const syncId = `sync-${uuidv4()}`;
      const filePath = join(uploadsDir, `${syncId}.zip`);

      // Save file
      await writeFile(filePath, fileBuffer);

      // Create sync package record
      const pkg = createSyncPackage({
        id: syncId,
        agent_id: agentId,
        practice_id: practiceId,
        filename,
        file_path: filePath,
        file_size: fileBuffer.length,
      });

      console.log(`Sync package uploaded: ${syncId} (${fileBuffer.length} bytes)`);

      res.status(201).json({
        syncId: pkg.id,
        status: pkg.status,
        receivedAt: pkg.created_at,
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /v1/sync/:syncId
 * Get sync package status
 */
router.get(
  '/:syncId',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { syncId } = req.params;

      const pkg = getSyncPackageById(syncId);
      if (!pkg) {
        res.status(404).json({ error: 'Sync package not found' });
        return;
      }

      // Verify access
      if (pkg.practice_id !== req.agent?.practiceId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      res.json({
        syncId: pkg.id,
        status: pkg.status,
        filename: pkg.filename,
        fileSize: pkg.file_size,
        createdAt: pkg.created_at,
        processedAt: pkg.processed_at,
        errorMessage: pkg.error_message,
        manifest: pkg.manifest ? JSON.parse(pkg.manifest) : null,
      });
    } catch (error) {
      console.error('Get sync error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /v1/sync
 * List sync packages for the agent's practice
 */
router.get(
  '/',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const practiceId = req.agent?.practiceId;
      if (!practiceId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { limit = '20', offset = '0', status } = req.query;

      // Build query
      const db = (await import('../db/database.js')).getDatabase();

      let query = 'SELECT * FROM sync_packages WHERE practice_id = ?';
      const params: (string | number)[] = [practiceId];

      if (status) {
        query += ' AND status = ?';
        params.push(status as string);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit as string, 10), parseInt(offset as string, 10));

      const packages = db.prepare(query).all(...params);

      res.json({
        packages: packages.map((pkg: any) => ({
          syncId: pkg.id,
          status: pkg.status,
          filename: pkg.filename,
          fileSize: pkg.file_size,
          createdAt: pkg.created_at,
          processedAt: pkg.processed_at,
        })),
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      });
    } catch (error) {
      console.error('List sync error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export { router as syncRouter };
