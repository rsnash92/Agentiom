/**
 * Lifecycle Service - Phase 2
 * 
 * Handles agent sleep/wake operations:
 * - Force wake: Start a sleeping agent
 * - Force sleep: Stop a running agent  
 * - Get status: Check if agent is running/sleeping/stopped
 * - Record activity: Update last activity timestamp
 * 
 * This is the foundation for the trigger system.
 */

import { eq, and, lt } from 'drizzle-orm';
import type { DatabaseClient } from '@agentiom/db';
import { agents, wakeEvents, type TriggerType } from '@agentiom/db/schema';
import type { ProviderManager } from '@agentiom/providers';
import { createLogger } from '@agentiom/shared';

const log = createLogger('lifecycle-service');

export interface WakeResult {
  success: boolean;
  latencyMs: number;
  previousStatus: string;
  newStatus: string;
  error?: string;
}

export interface AgentRuntime {
  status: 'running' | 'sleeping' | 'stopped' | 'unknown';
  machineState?: string;
  lastActivityAt?: Date;
  uptime?: number; // seconds
}

export class LifecycleService {
  constructor(
    private db: DatabaseClient,
    private providers: ProviderManager
  ) {}

  /**
   * Wake a sleeping agent
   * 
   * @param agentId - Agent ID to wake
   * @param triggerType - What caused the wake
   * @param triggerContext - Additional context about the trigger
   */
  async wake(
    agentId: string,
    triggerType: TriggerType,
    triggerContext?: Record<string, unknown>
  ): Promise<WakeResult> {
    const startTime = Date.now();
    
    log.info({ agentId, triggerType }, 'Waking agent');

    // Get agent
    const [agent] = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (!agent) {
      log.warn({ agentId }, 'Agent not found for wake');
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        previousStatus: 'unknown',
        newStatus: 'unknown',
        error: 'Agent not found',
      };
    }

    const previousStatus = agent.status;

    // If already running, just update activity
    if (agent.status === 'running') {
      await this.recordActivity(agentId);
      return {
        success: true,
        latencyMs: Date.now() - startTime,
        previousStatus,
        newStatus: 'running',
      };
    }

    // Can only wake from 'sleeping' or 'stopped'
    if (agent.status !== 'sleeping' && agent.status !== 'stopped') {
      log.warn({ agentId, status: agent.status }, 'Cannot wake agent in this state');
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        previousStatus,
        newStatus: agent.status,
        error: `Cannot wake agent in '${agent.status}' state`,
      };
    }

    try {
      // Start the machine via provider
      if (agent.machineId) {
        log.debug({ agentId, machineId: agent.machineId }, 'Starting machine');
        await this.providers.compute.startMachine(agent.machineId);
        
        // Wait for machine to be healthy
        await this.providers.compute.waitForState(
          agent.machineId,
          'started',
          30000 // 30 second timeout
        );
      }

      const latencyMs = Date.now() - startTime;

      // Update agent status
      await this.db
        .update(agents)
        .set({
          status: 'running',
          lastWakeAt: new Date(),
          lastActivityAt: new Date(),
          wakeCount: (agent.wakeCount || 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, agentId));

      // Record wake event
      await this.db.insert(wakeEvents).values({
        agentId,
        triggerType,
        triggerContext: triggerContext as any,
        wakeLatencyMs: latencyMs,
        success: true,
      });

      log.info(
        { agentId, latencyMs, triggerType },
        'Agent woken successfully'
      );

      return {
        success: true,
        latencyMs,
        previousStatus,
        newStatus: 'running',
      };

    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      log.error({ agentId, error }, 'Failed to wake agent');

      // Record failed wake event
      await this.db.insert(wakeEvents).values({
        agentId,
        triggerType,
        triggerContext: triggerContext as any,
        wakeLatencyMs: latencyMs,
        success: false,
        errorMessage,
      });

      // Update agent to error state
      await this.db
        .update(agents)
        .set({
          status: 'error',
          updatedAt: new Date(),
        })
        .where(eq(agents.id, agentId));

      return {
        success: false,
        latencyMs,
        previousStatus,
        newStatus: 'error',
        error: errorMessage,
      };
    }
  }

  /**
   * Put an agent to sleep (stop but preserve state)
   */
  async sleep(agentId: string): Promise<{ success: boolean; error?: string }> {
    log.info({ agentId }, 'Putting agent to sleep');

    const [agent] = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (!agent) {
      return { success: false, error: 'Agent not found' };
    }

    // Can only sleep a running agent
    if (agent.status !== 'running') {
      log.warn({ agentId, status: agent.status }, 'Cannot sleep agent in this state');
      return {
        success: false,
        error: `Cannot sleep agent in '${agent.status}' state`,
      };
    }

    try {
      // Stop the machine via provider
      if (agent.machineId) {
        log.debug({ agentId, machineId: agent.machineId }, 'Stopping machine');
        await this.providers.compute.stopMachine(agent.machineId);
      }

      // Update agent status
      await this.db
        .update(agents)
        .set({
          status: 'sleeping',
          lastSleepAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(agents.id, agentId));

      log.info({ agentId }, 'Agent is now sleeping');

      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error({ agentId, error }, 'Failed to put agent to sleep');

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get the runtime status of an agent
   */
  async getStatus(agentId: string): Promise<AgentRuntime | null> {
    const [agent] = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (!agent) {
      return null;
    }

    // If we have a machine, check its actual state
    let machineState: string | undefined;
    if (agent.machineId) {
      try {
        const machine = await this.providers.compute.getMachine(agent.machineId);
        machineState = machine?.state;
      } catch (error) {
        log.warn({ agentId, error }, 'Failed to get machine state');
      }
    }

    // Calculate uptime if running
    let uptime: number | undefined;
    if (agent.status === 'running' && agent.lastWakeAt) {
      uptime = Math.floor((Date.now() - agent.lastWakeAt.getTime()) / 1000);
    }

    // Map DB status to runtime status
    let status: 'running' | 'sleeping' | 'stopped' | 'unknown';
    switch (agent.status) {
      case 'running':
        status = 'running';
        break;
      case 'sleeping':
        status = 'sleeping';
        break;
      case 'stopped':
      case 'pending':
      case 'destroyed':
        status = 'stopped';
        break;
      default:
        status = 'unknown';
    }

    return {
      status,
      machineState,
      lastActivityAt: agent.lastActivityAt || undefined,
      uptime,
    };
  }

  /**
   * Record activity for an agent (resets idle timer)
   */
  async recordActivity(agentId: string): Promise<void> {
    await this.db
      .update(agents)
      .set({
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agentId));
  }

  /**
   * Find agents that should be put to sleep due to inactivity
   * 
   * @returns Array of agent IDs that should be put to sleep
   */
  async findIdleAgents(): Promise<string[]> {
    const now = new Date();

    // Find running agents with auto-sleep enabled where last activity
    // is older than their idle timeout
    const result = await this.db
      .select({
        id: agents.id,
        lastActivityAt: agents.lastActivityAt,
        idleTimeoutMins: agents.idleTimeoutMins,
      })
      .from(agents)
      .where(
        and(
          eq(agents.status, 'running'),
          eq(agents.autoSleep, true)
        )
      );

    const idleAgentIds: string[] = [];

    for (const agent of result) {
      if (!agent.lastActivityAt) continue;

      const idleMs = now.getTime() - agent.lastActivityAt.getTime();
      const timeoutMs = (agent.idleTimeoutMins || 5) * 60 * 1000;

      if (idleMs >= timeoutMs) {
        idleAgentIds.push(agent.id);
      }
    }

    return idleAgentIds;
  }

  /**
   * Sleep all idle agents
   * Used by the idle monitor background job
   */
  async sleepIdleAgents(): Promise<{ slept: number; failed: number }> {
    const idleAgentIds = await this.findIdleAgents();
    
    if (idleAgentIds.length === 0) {
      return { slept: 0, failed: 0 };
    }

    log.info({ count: idleAgentIds.length }, 'Found idle agents to sleep');

    let slept = 0;
    let failed = 0;

    for (const agentId of idleAgentIds) {
      const result = await this.sleep(agentId);
      if (result.success) {
        slept++;
      } else {
        failed++;
      }
    }

    log.info({ slept, failed }, 'Finished sleeping idle agents');

    return { slept, failed };
  }

  /**
   * Configure auto-sleep settings for an agent
   */
  async configureAutoSleep(
    agentId: string,
    settings: {
      enabled: boolean;
      idleTimeoutMins?: number;
    }
  ): Promise<void> {
    await this.db
      .update(agents)
      .set({
        autoSleep: settings.enabled,
        ...(settings.idleTimeoutMins !== undefined && {
          idleTimeoutMins: settings.idleTimeoutMins,
        }),
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agentId));
  }
}
