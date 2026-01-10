/**
 * Practice Routes
 *
 * Practice management and data access endpoints.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  createPractice,
  getPracticeById,
  getAllPractices,
  getDatabase,
} from '../db/database.js';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

/**
 * POST /v1/practices
 * Create a new practice (admin endpoint)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, phone } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Practice name is required' });
      return;
    }

    const practiceId = `practice-${uuidv4()}`;
    const activationToken = uuidv4(); // Simple token for now

    const practice = createPractice({
      id: practiceId,
      name,
      email,
      phone,
      activation_token: activationToken,
    });

    console.log(`Practice created: ${practiceId}`);

    res.status(201).json({
      id: practice.id,
      name: practice.name,
      activationToken,
      message: 'Use this activation token in the DE Connect setup wizard',
    });
  } catch (error) {
    console.error('Create practice error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /v1/practices
 * List all practices (admin endpoint)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const practices = getAllPractices();

    res.json({
      practices: practices.map(p => ({
        id: p.id,
        name: p.name,
        email: p.email,
        createdAt: p.created_at,
      })),
    });
  } catch (error) {
    console.error('List practices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /v1/practices/:practiceId
 * Get practice details
 */
router.get('/:practiceId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { practiceId } = req.params;

    // Verify access
    if (req.agent?.practiceId !== practiceId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const practice = getPracticeById(practiceId);
    if (!practice) {
      res.status(404).json({ error: 'Practice not found' });
      return;
    }

    res.json({
      id: practice.id,
      name: practice.name,
      email: practice.email,
      phone: practice.phone,
      createdAt: practice.created_at,
    });
  } catch (error) {
    console.error('Get practice error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /v1/practices/:practiceId/connections
 * Get practice connections (agents) status
 */
router.get('/:practiceId/connections', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { practiceId } = req.params;

    if (req.agent?.practiceId !== practiceId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const db = getDatabase();

    // Get all agents for this practice with latest heartbeat
    const agents = db.prepare(`
      SELECT
        a.id,
        a.status,
        a.agent_version,
        a.created_at,
        a.last_seen_at,
        h.status as last_heartbeat_status,
        h.last_sync_info,
        h.issues
      FROM agents a
      LEFT JOIN (
        SELECT agent_id, status, last_sync_info, issues,
               ROW_NUMBER() OVER (PARTITION BY agent_id ORDER BY created_at DESC) as rn
        FROM heartbeats
      ) h ON a.id = h.agent_id AND h.rn = 1
      WHERE a.practice_id = ?
    `).all(practiceId);

    res.json({
      connections: agents.map((agent: any) => ({
        agentId: agent.id,
        status: agent.status,
        agentVersion: agent.agent_version,
        createdAt: agent.created_at,
        lastSeenAt: agent.last_seen_at,
        lastHeartbeatStatus: agent.last_heartbeat_status,
        lastSync: agent.last_sync_info ? JSON.parse(agent.last_sync_info) : null,
        issues: agent.issues ? JSON.parse(agent.issues) : [],
      })),
    });
  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /v1/practices/:practiceId/data/clients
 * Get synced clients for a practice
 */
router.get('/:practiceId/data/clients', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { practiceId } = req.params;

    if (req.agent?.practiceId !== practiceId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { limit = '100', offset = '0', active } = req.query;

    const db = getDatabase();

    let query = 'SELECT * FROM canonical_clients WHERE practice_id = ?';
    const params: (string | number)[] = [practiceId];

    if (active === 'true') {
      query += ' AND is_active = 1';
    } else if (active === 'false') {
      query += ' AND is_active = 0';
    }

    query += ' ORDER BY last_seen_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string, 10), parseInt(offset as string, 10));

    const clients = db.prepare(query).all(...params);

    res.json({
      clients,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /v1/practices/:practiceId/data/patients
 * Get synced patients for a practice
 */
router.get('/:practiceId/data/patients', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { practiceId } = req.params;

    if (req.agent?.practiceId !== practiceId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { limit = '100', offset = '0', clientId } = req.query;

    const db = getDatabase();

    let query = 'SELECT * FROM canonical_patients WHERE practice_id = ?';
    const params: (string | number)[] = [practiceId];

    if (clientId) {
      query += ' AND source_client_id = ?';
      params.push(clientId as string);
    }

    query += ' ORDER BY last_seen_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string, 10), parseInt(offset as string, 10));

    const patients = db.prepare(query).all(...params);

    res.json({
      patients,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /v1/practices/:practiceId/data/stats
 * Get data statistics for a practice
 */
router.get('/:practiceId/data/stats', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { practiceId } = req.params;

    if (req.agent?.practiceId !== practiceId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const db = getDatabase();

    const stats = {
      clients: db.prepare('SELECT COUNT(*) as count FROM canonical_clients WHERE practice_id = ?').get(practiceId) as { count: number },
      patients: db.prepare('SELECT COUNT(*) as count FROM canonical_patients WHERE practice_id = ?').get(practiceId) as { count: number },
      appointments: db.prepare('SELECT COUNT(*) as count FROM canonical_appointments WHERE practice_id = ?').get(practiceId) as { count: number },
      reminders: db.prepare('SELECT COUNT(*) as count FROM canonical_reminders WHERE practice_id = ?').get(practiceId) as { count: number },
      invoices: db.prepare('SELECT COUNT(*) as count FROM canonical_invoices WHERE practice_id = ?').get(practiceId) as { count: number },
    };

    const lastSync = db.prepare(`
      SELECT created_at, status
      FROM sync_packages
      WHERE practice_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(practiceId) as { created_at: string; status: string } | undefined;

    res.json({
      counts: {
        clients: stats.clients.count,
        patients: stats.patients.count,
        appointments: stats.appointments.count,
        reminders: stats.reminders.count,
        invoices: stats.invoices.count,
      },
      lastSync: lastSync ? {
        at: lastSync.created_at,
        status: lastSync.status,
      } : null,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as practicesRouter };
