/**
 * Activity Logging Service
 *
 * Logs agent activity events to the database for visibility in the dashboard.
 */

import type { DatabaseClient } from '@agentiom/db';
import { activityLogs, type ActivityType } from '@agentiom/db/schema';
import { createLogger } from '@agentiom/shared';

const log = createLogger('activity-service');

export interface ActivityService {
  log(
    agentId: string,
    type: ActivityType,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void>;

  logWake(agentId: string, trigger: string, latencyMs: number): Promise<void>;
  logSleep(agentId: string, reason: string): Promise<void>;
  logRequest(agentId: string, source: string, preview: string): Promise<void>;
  logResponse(agentId: string, latencyMs: number): Promise<void>;
  logStateSave(agentId: string, keysCount: number): Promise<void>;
  logError(agentId: string, error: string): Promise<void>;
}

export function createActivityService(db: DatabaseClient): ActivityService {
  return {
    async log(
      agentId: string,
      type: ActivityType,
      message: string,
      metadata?: Record<string, unknown>
    ): Promise<void> {
      try {
        await db.insert(activityLogs).values({
          agentId,
          type,
          message,
          metadata: metadata || null,
        });
        log.debug({ agentId, type, message }, 'Activity logged');
      } catch (error) {
        // Don't let logging failures affect the main operation
        log.error({ agentId, type, error }, 'Failed to log activity');
      }
    },

    async logWake(agentId: string, trigger: string, latencyMs: number): Promise<void> {
      await this.log(agentId, 'wake', `Woke from ${trigger} (${latencyMs}ms)`, {
        trigger,
        latencyMs,
      });
    },

    async logSleep(agentId: string, reason: string): Promise<void> {
      await this.log(agentId, 'sleep', `Sleeping: ${reason}`, { reason });
    },

    async logRequest(agentId: string, source: string, preview: string): Promise<void> {
      const truncated = preview.length > 50 ? preview.slice(0, 50) + '...' : preview;
      await this.log(agentId, 'request', `${source}: "${truncated}"`, { source, preview });
    },

    async logResponse(agentId: string, latencyMs: number): Promise<void> {
      await this.log(agentId, 'response', `Response sent (${latencyMs}ms)`, { latencyMs });
    },

    async logStateSave(agentId: string, keysCount: number): Promise<void> {
      await this.log(agentId, 'state_save', `State saved (${keysCount} keys)`, { keysCount });
    },

    async logError(agentId: string, error: string): Promise<void> {
      await this.log(agentId, 'error', error, { error });
    },
  };
}
