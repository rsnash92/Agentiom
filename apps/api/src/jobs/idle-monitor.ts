/**
 * Idle Monitor Job - Phase 2
 * 
 * Background job that periodically checks for idle agents
 * and puts them to sleep to conserve resources.
 * 
 * Runs every minute (configurable).
 */

import type { LifecycleService } from '../services/lifecycle.service';
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
      const result = await this.lifecycle.sleepIdleAgents();

      if (result.slept > 0 || result.failed > 0) {
        log.info(
          { slept: result.slept, failed: result.failed },
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
  config?: Partial<IdleMonitorConfig>
): IdleMonitor {
  const monitor = new IdleMonitor(lifecycle, {
    intervalMs: config?.intervalMs ?? 60000,
    enabled: config?.enabled ?? true,
  });

  return monitor;
}
