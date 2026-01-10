/**
 * Health Monitor
 *
 * Tracks agent health and sends heartbeats to cloud.
 */

import { createLogger, type Logger } from '@de-connect/shared';
import type {
  AgentHeartbeat,
  AgentStatus,
  AgentIssue,
  LastSyncInfo,
  SystemInfo,
  ResourceUsage,
} from '@de-connect/contracts';

/**
 * Health monitor configuration
 */
export interface HealthConfig {
  /**
   * Cloud API base URL
   */
  apiBaseUrl: string;

  /**
   * Agent ID
   */
  agentId: string;

  /**
   * Practice ID
   */
  practiceId: string;

  /**
   * Auth token
   */
  authToken: string;

  /**
   * Agent version
   */
  agentVersion: string;

  /**
   * Heartbeat interval (ms)
   */
  heartbeatIntervalMs: number;

  /**
   * Logger instance
   */
  logger?: Logger;
}

/**
 * Health Monitor
 */
export class HealthMonitor {
  private logger: Logger;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private issues: AgentIssue[] = [];
  private lastSyncInfo: LastSyncInfo | null = null;
  private adapterVersions: Record<string, string> = {};
  private isRunning = false;

  constructor(private config: HealthConfig) {
    this.logger = config.logger ?? createLogger('HealthMonitor');
  }

  /**
   * Start health monitoring
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.logger.info('Starting health monitor', {
      intervalMs: this.config.heartbeatIntervalMs,
    });

    // Send initial heartbeat
    this.sendHeartbeat();

    // Schedule periodic heartbeats
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatIntervalMs);
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.logger.info('Stopped health monitor');
  }

  /**
   * Add an issue
   */
  addIssue(issue: Omit<AgentIssue, 'firstSeenAt'>): void {
    // Check if issue already exists
    const existing = this.issues.find(i => i.code === issue.code);
    if (existing) return;

    const fullIssue: AgentIssue = {
      ...issue,
      firstSeenAt: new Date().toISOString(),
    };

    this.issues.push(fullIssue);
    this.logger.warn('Issue detected', { code: issue.code, message: issue.message });
  }

  /**
   * Remove an issue
   */
  removeIssue(code: string): void {
    const idx = this.issues.findIndex(i => i.code === code);
    if (idx >= 0) {
      this.issues.splice(idx, 1);
      this.logger.info('Issue resolved', { code });
    }
  }

  /**
   * Clear all issues
   */
  clearIssues(): void {
    this.issues = [];
  }

  /**
   * Update last sync info
   */
  updateLastSync(info: LastSyncInfo): void {
    this.lastSyncInfo = info;

    // Add/remove issues based on sync result
    if (!info.success) {
      this.addIssue({
        code: 'SYNC_FAILED',
        severity: 'error',
        message: info.errorMessage ?? 'Last sync failed',
        suggestedAction: 'Check connection and retry',
        autoResolvable: true,
      });
    } else {
      this.removeIssue('SYNC_FAILED');
    }
  }

  /**
   * Update adapter versions
   */
  updateAdapterVersions(versions: Record<string, string>): void {
    this.adapterVersions = versions;
  }

  /**
   * Get current health status
   */
  getStatus(): AgentStatus {
    if (this.issues.some(i => i.severity === 'error')) {
      return AgentStatus.Error;
    }

    if (this.issues.some(i => i.severity === 'warning')) {
      return AgentStatus.Degraded;
    }

    if (this.issues.length > 0) {
      return AgentStatus.NeedsAttention;
    }

    return AgentStatus.Healthy;
  }

  /**
   * Get system info
   */
  private async getSystemInfo(): Promise<SystemInfo> {
    const os = await import('os');

    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      hostname: os.hostname(),
      uptime: os.uptime(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  /**
   * Get resource usage
   */
  private getResourceUsage(): ResourceUsage {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Simple CPU calculation (not accurate, but indicative)
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000 / process.uptime() * 100;

    return {
      memoryMb: Math.round(memUsage.heapUsed / 1024 / 1024),
      cpuPercent: Math.min(100, Math.round(cpuPercent)),
      diskFreeMb: 0, // Would need fs stats
    };
  }

  /**
   * Send heartbeat to cloud
   */
  async sendHeartbeat(): Promise<boolean> {
    try {
      const systemInfo = await this.getSystemInfo();
      const resources = this.getResourceUsage();

      const heartbeat: AgentHeartbeat = {
        agentId: this.config.agentId,
        practiceId: this.config.practiceId,
        status: this.getStatus(),
        timestamp: new Date().toISOString(),
        agentVersion: this.config.agentVersion,
        adapterVersions: this.adapterVersions,
        system: systemInfo,
        lastSync: this.lastSyncInfo ?? undefined,
        issues: this.issues,
        resources,
      };

      const url = `${this.config.apiBaseUrl}/agents/${this.config.agentId}/heartbeat`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(heartbeat),
      });

      if (!response.ok) {
        throw new Error(`Heartbeat failed: ${response.status}`);
      }

      this.logger.debug('Heartbeat sent', { status: heartbeat.status });
      return true;
    } catch (error) {
      this.logger.error('Failed to send heartbeat', error instanceof Error ? error : undefined);
      return false;
    }
  }

  /**
   * Request reconnection (for session expired, MFA required, etc.)
   */
  async requestReconnect(reason: string, message: string): Promise<boolean> {
    try {
      const url = `${this.config.apiBaseUrl}/agents/${this.config.agentId}/reconnect`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason,
          message,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Reconnect request failed: ${response.status}`);
      }

      this.addIssue({
        code: 'RECONNECT_REQUIRED',
        severity: 'warning',
        message,
        suggestedAction: 'Click the reconnect link in your email',
        autoResolvable: false,
      });

      this.logger.info('Reconnect requested', { reason, message });
      return true;
    } catch (error) {
      this.logger.error('Failed to request reconnect', error instanceof Error ? error : undefined);
      return false;
    }
  }
}
