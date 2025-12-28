/**
 * Lifecycle Routes - Phase 2
 * 
 * Endpoints for controlling agent sleep/wake state:
 * - POST /agents/:id/wake - Wake a sleeping agent
 * - POST /agents/:id/sleep - Put a running agent to sleep
 * - GET /agents/:id/status - Get agent runtime status
 * - PATCH /agents/:id/auto-sleep - Configure auto-sleep settings
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { agents, activityLogs } from '@agentiom/db/schema';
import type { Env } from '../types';

const lifecycleRoutes = new Hono<Env>();

// =============================================================================
// POST /agents/:id/wake - Wake a sleeping agent
// =============================================================================

const wakeSchema = z.object({
  triggerType: z.enum(['webhook', 'cron', 'email', 'api']).default('api'),
  context: z.record(z.unknown()).optional(),
});

lifecycleRoutes.post(
  '/:id/wake',
  zValidator('json', wakeSchema),
  async (c) => {
    const agentId = c.req.param('id');
    const { triggerType, context } = c.req.valid('json');
    const lifecycle = c.get('lifecycle');
    const db = c.get('db');
    const user = c.get('user');

    // Verify agent ownership
    const [agent] = await db
      .select({ userId: agents.userId })
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    if (agent.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // Wake the agent
    const result = await lifecycle.wake(agentId, triggerType, context);

    if (!result.success) {
      return c.json(
        {
          error: result.error || 'Failed to wake agent',
          previousStatus: result.previousStatus,
        },
        400
      );
    }

    return c.json({
      success: true,
      status: result.newStatus,
      previousStatus: result.previousStatus,
      latencyMs: result.latencyMs,
    });
  }
);

// =============================================================================
// POST /agents/:id/sleep - Put an agent to sleep
// =============================================================================

lifecycleRoutes.post('/:id/sleep', async (c) => {
  const agentId = c.req.param('id');
  const lifecycle = c.get('lifecycle');
  const db = c.get('db');
  const user = c.get('user');

  // Verify agent ownership
  const [agent] = await db
    .select({ userId: agents.userId, status: agents.status })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  if (agent.userId !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Sleep the agent
  const result = await lifecycle.sleep(agentId);

  if (!result.success) {
    return c.json(
      {
        error: result.error || 'Failed to sleep agent',
        currentStatus: agent.status,
      },
      400
    );
  }

  return c.json({
    success: true,
    status: 'sleeping',
    previousStatus: agent.status,
  });
});

// =============================================================================
// GET /agents/:id/status - Get runtime status
// =============================================================================

lifecycleRoutes.get('/:id/status', async (c) => {
  const agentId = c.req.param('id');
  const lifecycle = c.get('lifecycle');
  const db = c.get('db');
  const user = c.get('user');

  // Verify agent ownership
  const [agent] = await db
    .select({ userId: agents.userId })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  if (agent.userId !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const status = await lifecycle.getStatus(agentId);

  if (!status) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  return c.json(status);
});

// =============================================================================
// PATCH /agents/:id/auto-sleep - Configure auto-sleep
// =============================================================================

const autoSleepSchema = z.object({
  enabled: z.boolean(),
  idleTimeoutMins: z.number().min(1).max(60).optional(),
});

lifecycleRoutes.patch(
  '/:id/auto-sleep',
  zValidator('json', autoSleepSchema),
  async (c) => {
    const agentId = c.req.param('id');
    const { enabled, idleTimeoutMins } = c.req.valid('json');
    const lifecycle = c.get('lifecycle');
    const db = c.get('db');
    const user = c.get('user');

    // Verify agent ownership
    const [agent] = await db
      .select({ userId: agents.userId, autoSleep: agents.autoSleep, idleTimeoutMins: agents.idleTimeoutMins })
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    if (agent.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    await lifecycle.configureAutoSleep(agentId, {
      enabled,
      idleTimeoutMins,
    });

    return c.json({
      success: true,
      autoSleep: enabled,
      idleTimeoutMins: idleTimeoutMins ?? agent.idleTimeoutMins,
    });
  }
);

// =============================================================================
// POST /agents/:id/activity - Record activity (keeps agent awake)
// =============================================================================

lifecycleRoutes.post('/:id/activity', async (c) => {
  const agentId = c.req.param('id');
  const lifecycle = c.get('lifecycle');
  const db = c.get('db');
  const user = c.get('user');

  // Verify agent ownership
  const [agent] = await db
    .select({ userId: agents.userId })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  if (agent.userId !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  await lifecycle.recordActivity(agentId);

  return c.json({ success: true });
});

// =============================================================================
// GET /agents/:id/activity - Get activity log
// =============================================================================

lifecycleRoutes.get('/:id/activity', async (c) => {
  const agentId = c.req.param('id');
  const db = c.get('db');
  const user = c.get('user');
  const limit = Number(c.req.query('limit') || 50);

  // Verify agent ownership
  const [agent] = await db
    .select({ userId: agents.userId })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  if (agent.userId !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Get activity logs
  const activities = await db
    .select()
    .from(activityLogs)
    .where(eq(activityLogs.agentId, agentId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);

  return c.json({ activities });
});

export { lifecycleRoutes };
