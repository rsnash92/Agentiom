/**
 * Idle Monitor Job - Phase 2
 * 
 * Background job that periodically checks for idle agents
 * and puts them to sleep to conserve resources.
 * 
 * Runs every minute (configurable).
 */

import type { LifecycleService } from '../services/lifecycle.service';
import type { ActivityService } from '../services/activity.service';
import { createLogger } from '@agentiom/shared';

const log = createLogger('idle-monitor');

export interface IdleMonitorConfig {
  intervalMs: number;  // How often to check (default: 60000 = 1 minute)
  enabled: boolean;
}

export class IdleMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private lifecycle: LifecycleService,
    private activity: ActivityService | null = null,
    private config: IdleMonitorConfig = { intervalMs: 60000, enabled: true }
  ) {}

  /**
   * Start the idle monitor
   */
  start(): void {
    if (!this.config.enabled) {
      log.info('Idle monitor is disabled');
      return;
    }

    if (this.intervalId) {
      log.warn('Idle monitor is already running');
      return;
    }

    log.info(
      { intervalMs: this.config.intervalMs },
      'Starting idle monitor'
    );

    // Run immediately on start
    this.tick();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.tick();
    }, this.config.intervalMs);
  }

  /**
   * Stop the idle monitor
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log.info('Idle monitor stopped');
    }
  }

  /**
   * One iteration of the monitor
   */
  private async tick(): Promise<void> {
    // Prevent overlapping runs
    if (this.isRunning) {
      log.debug('Previous tick still running, skipping');
      return;
    }

    this.isRunning = true;

    try {
      // Get idle agents first so we can log them
      const idleAgentIds = await this.lifecycle.findIdleAgents();

      if (idleAgentIds.length === 0) {
        this.isRunning = false;
        return;
      }

      log.info({ count: idleAgentIds.length }, 'Found idle agents to sleep');

      let slept = 0;
      let failed = 0;

      for (const agentId of idleAgentIds) {
        const result = await this.lifecycle.sleep(agentId);
        if (result.success) {
          slept++;
          // Log the sleep event
          if (this.activity) {
            await this.activity.logSleep(agentId, 'Idle timeout');
          }
        } else {
          failed++;
          if (this.activity) {
            await this.activity.logError(agentId, `Failed to sleep: ${result.error}`);
          }
        }
      }

      if (slept > 0 || failed > 0) {
        log.info(
          { slept, failed },
          'Idle monitor tick completed'
        );
      }
    } catch (error) {
      log.error({ error }, 'Idle monitor tick failed');
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check if the monitor is active
   */
  isActive(): boolean {
    return this.intervalId !== null;
  }
}

/**
 * Create and start the idle monitor
 */
export function createIdleMonitor(
  lifecycle: LifecycleService,
  activity?: ActivityService,
  config?: Partial<IdleMonitorConfig>
): IdleMonitor {
  const monitor = new IdleMonitor(
    lifecycle,
    activity || null,
    {
      intervalMs: config?.intervalMs ?? 60000,
      enabled: config?.enabled ?? true,
    }
  );

  return monitor;
}
