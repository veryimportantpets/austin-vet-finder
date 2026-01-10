/**
 * Authentication Middleware
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { getAgentById, updateAgentLastSeen } from '../db/database.js';

// Secret key (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET ?? 'de-connect-dev-secret-change-in-production';

/**
 * Extended request with auth info
 */
export interface AuthenticatedRequest extends Request {
  agent?: {
    id: string;
    practiceId: string;
  };
}

/**
 * Generate auth token for an agent
 */
export function generateAuthToken(agentId: string, practiceId: string): string {
  return jwt.sign(
    { agentId, practiceId },
    JWT_SECRET,
    { expiresIn: '365d' }
  );
}

/**
 * Hash auth token for storage
 */
export function hashAuthToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Verify auth token
 */
export function verifyAuthToken(token: string): { agentId: string; practiceId: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { agentId: string; practiceId: string };
    return payload;
  } catch {
    return null;
  }
}

/**
 * Authentication middleware
 */
export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyAuthToken(token);

  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // Verify agent exists and is active
  const agent = getAgentById(payload.agentId);
  if (!agent || agent.status !== 'active') {
    res.status(401).json({ error: 'Agent not found or inactive' });
    return;
  }

  // Update last seen
  updateAgentLastSeen(agent.id);

  req.agent = {
    id: payload.agentId,
    practiceId: payload.practiceId,
  };

  next();
}

/**
 * Optional authentication (doesn't fail if no token)
 */
export function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = verifyAuthToken(token);

    if (payload) {
      const agent = getAgentById(payload.agentId);
      if (agent && agent.status === 'active') {
        req.agent = {
          id: payload.agentId,
          practiceId: payload.practiceId,
        };
      }
    }
  }

  next();
}
