/**
 * Agent Routes
 *
 * Registration, heartbeat, and reconnect endpoints.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  getPracticeByToken,
  createAgent,
  getAgentById,
  createHeartbeat,
  getLatestHeartbeat,
} from '../db/database.js';
import {
  generateAuthToken,
  hashAuthToken,
  authMiddleware,
  type AuthenticatedRequest,
} from '../middleware/auth.js';

const router = Router();

/**
 * POST /v1/agents/register
 * Register a new agent
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { activationToken, machineFingerprint } = req.body;

    if (!activationToken || !machineFingerprint) {
      res.status(400).json({
        error: 'Missing required fields: activationToken, machineFingerprint',
      });
      return;
    }

    // Look up practice by activation token
    const practice = getPracticeByToken(activationToken);
    if (!practice) {
      res.status(404).json({ error: 'Invalid activation token' });
      return;
    }

    // Generate agent ID and auth token
    const agentId = `agent-${uuidv4()}`;
    const authToken = generateAuthToken(agentId, practice.id);
    const authTokenHash = hashAuthToken(authToken);

    // Create agent
    createAgent({
      id: agentId,
      practice_id: practice.id,
      machine_fingerprint: machineFingerprint,
      auth_token_hash: authTokenHash,
    });

    console.log(`Agent registered: ${agentId} for practice ${practice.id}`);

    res.status(201).json({
      agentId,
      practiceId: practice.id,
      authToken,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /v1/agents/:agentId/heartbeat
 * Receive heartbeat from agent
 */
router.post(
  '/:agentId/heartbeat',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { agentId } = req.params;

      // Verify agent ID matches token
      if (req.agent?.id !== agentId) {
        res.status(403).json({ error: 'Agent ID mismatch' });
        return;
      }

      const {
        status,
        agentVersion,
        system,
        lastSync,
        issues,
        resources,
      } = req.body;

      // Store heartbeat
      createHeartbeat({
        agent_id: agentId,
        status,
        agent_version: agentVersion,
        system_info: system ? JSON.stringify(system) : undefined,
        last_sync_info: lastSync ? JSON.stringify(lastSync) : undefined,
        issues: issues ? JSON.stringify(issues) : undefined,
        resources: resources ? JSON.stringify(resources) : undefined,
      });

      res.json({ received: true });
    } catch (error) {
      console.error('Heartbeat error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /v1/agents/:agentId/status
 * Get agent status
 */
router.get(
  '/:agentId/status',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { agentId } = req.params;

      if (req.agent?.id !== agentId) {
        res.status(403).json({ error: 'Agent ID mismatch' });
        return;
      }

      const agent = getAgentById(agentId);
      if (!agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      const lastHeartbeat = getLatestHeartbeat(agentId);

      res.json({
        agentId: agent.id,
        practiceId: agent.practice_id,
        status: agent.status,
        lastSeenAt: agent.last_seen_at,
        lastHeartbeat: lastHeartbeat ? {
          status: lastHeartbeat.status,
          createdAt: lastHeartbeat.created_at,
        } : null,
      });
    } catch (error) {
      console.error('Status error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * POST /v1/agents/:agentId/reconnect
 * Request reconnection (triggers email to practice)
 */
router.post(
  '/:agentId/reconnect',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { agentId } = req.params;

      if (req.agent?.id !== agentId) {
        res.status(403).json({ error: 'Agent ID mismatch' });
        return;
      }

      const { reason, message } = req.body;

      // In production, this would:
      // 1. Create a reconnect request record
      // 2. Send email to practice with deep link
      // 3. Track reconnect status

      console.log(`Reconnect requested for agent ${agentId}: ${reason} - ${message}`);

      // For now, just acknowledge
      res.json({
        received: true,
        message: 'Reconnect request received. An email will be sent to the practice.',
      });
    } catch (error) {
      console.error('Reconnect error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /v1/agents/:agentId/updates
 * Check for agent updates
 */
router.get(
  '/:agentId/updates',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { agentId } = req.params;
      const { version } = req.query;

      if (req.agent?.id !== agentId) {
        res.status(403).json({ error: 'Agent ID mismatch' });
        return;
      }

      // For now, no updates available
      // In production, would check version against latest
      res.json({
        available: false,
        currentVersion: version,
        latestVersion: version,
      });
    } catch (error) {
      console.error('Updates error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export { router as agentsRouter };
