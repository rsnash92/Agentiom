/**
 * Trigger Routes - Phase 2
 * 
 * CRUD endpoints for managing agent triggers:
 * - GET /agents/:id/triggers - List triggers for an agent
 * - POST /agents/:id/triggers - Create a new trigger
 * - GET /agents/:id/triggers/:triggerId - Get trigger details
 * - PATCH /agents/:id/triggers/:triggerId - Update trigger
 * - DELETE /agents/:id/triggers/:triggerId - Delete trigger
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { agents, triggers, wakeEvents } from '@agentiom/db/schema';
import type { Env } from '../types';

const triggerRoutes = new Hono<Env>();

// =============================================================================
// Schemas
// =============================================================================

const createTriggerSchema = z.object({
  type: z.enum(['webhook', 'cron', 'email', 'api']),
  config: z.record(z.unknown()).optional(),
  cronExpression: z.string().optional(),
  cronTimezone: z.string().default('UTC'),
  webhookPath: z.string().optional(),
  enabled: z.boolean().default(true),
});

const updateTriggerSchema = z.object({
  config: z.record(z.unknown()).optional(),
  cronExpression: z.string().optional(),
  cronTimezone: z.string().optional(),
  webhookPath: z.string().optional(),
  enabled: z.boolean().optional(),
});

// =============================================================================
// GET /agents/:id/triggers - List triggers
// =============================================================================

triggerRoutes.get('/:id/triggers', async (c) => {
  const agentId = c.req.param('id');
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

  const agentTriggers = await db
    .select()
    .from(triggers)
    .where(eq(triggers.agentId, agentId));

  return c.json({ triggers: agentTriggers });
});

// =============================================================================
// POST /agents/:id/triggers - Create trigger
// =============================================================================

triggerRoutes.post(
  '/:id/triggers',
  zValidator('json', createTriggerSchema),
  async (c) => {
    const agentId = c.req.param('id');
    const data = c.req.valid('json');
    const db = c.get('db');
    const user = c.get('user');

    // Verify agent ownership
    const [agent] = await db
      .select({ userId: agents.userId, webhookSecret: agents.webhookSecret })
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    if (agent.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // For webhook triggers, ensure agent has a webhook secret
    if (data.type === 'webhook' && !agent.webhookSecret) {
      const secret = crypto.randomUUID().replace(/-/g, '');
      await db
        .update(agents)
        .set({
          webhookSecret: secret,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, agentId));
    }

    // Calculate next run time for cron triggers
    let nextRunAt: Date | undefined;
    if (data.type === 'cron' && data.cronExpression) {
      // TODO: Calculate next run from cron expression
      // For now, we'll set it to 1 hour from now as placeholder
      nextRunAt = new Date(Date.now() + 60 * 60 * 1000);
    }

    // Create trigger
    const [trigger] = await db
      .insert(triggers)
      .values({
        agentId,
        type: data.type,
        config: data.config as any,
        cronExpression: data.cronExpression,
        cronTimezone: data.cronTimezone,
        webhookPath: data.webhookPath,
        enabled: data.enabled,
        nextRunAt,
      })
      .returning();

    return c.json({ trigger }, 201);
  }
);

// =============================================================================
// GET /agents/:id/triggers/:triggerId - Get trigger details
// =============================================================================

triggerRoutes.get('/:id/triggers/:triggerId', async (c) => {
  const { id: agentId, triggerId } = c.req.param();
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

  // Get trigger
  const [trigger] = await db
    .select()
    .from(triggers)
    .where(and(eq(triggers.id, triggerId), eq(triggers.agentId, agentId)))
    .limit(1);

  if (!trigger) {
    return c.json({ error: 'Trigger not found' }, 404);
  }

  // Get recent wake events for this trigger
  const recentEvents = await db
    .select()
    .from(wakeEvents)
    .where(eq(wakeEvents.triggerId, triggerId))
    .orderBy(wakeEvents.createdAt)
    .limit(10);

  return c.json({ trigger, recentEvents });
});

// =============================================================================
// PATCH /agents/:id/triggers/:triggerId - Update trigger
// =============================================================================

triggerRoutes.patch(
  '/:id/triggers/:triggerId',
  zValidator('json', updateTriggerSchema),
  async (c) => {
    const { id: agentId, triggerId } = c.req.param();
    const data = c.req.valid('json');
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

    // Verify trigger exists and belongs to agent
    const [existing] = await db
      .select()
      .from(triggers)
      .where(and(eq(triggers.id, triggerId), eq(triggers.agentId, agentId)))
      .limit(1);

    if (!existing) {
      return c.json({ error: 'Trigger not found' }, 404);
    }

    // Update trigger
    const [trigger] = await db
      .update(triggers)
      .set({
        ...data,
        config: data.config as any,
        updatedAt: new Date(),
      })
      .where(eq(triggers.id, triggerId))
      .returning();

    return c.json({ trigger });
  }
);

// =============================================================================
// DELETE /agents/:id/triggers/:triggerId - Delete trigger
// =============================================================================

triggerRoutes.delete('/:id/triggers/:triggerId', async (c) => {
  const { id: agentId, triggerId } = c.req.param();
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

  // Verify trigger exists and belongs to agent
  const [existing] = await db
    .select()
    .from(triggers)
    .where(and(eq(triggers.id, triggerId), eq(triggers.agentId, agentId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Trigger not found' }, 404);
  }

  // Delete trigger
  await db.delete(triggers).where(eq(triggers.id, triggerId));

  return c.json({ success: true });
});

// =============================================================================
// GET /agents/:id/wake-events - Get wake event history
// =============================================================================

triggerRoutes.get('/:id/wake-events', async (c) => {
  const agentId = c.req.param('id');
  const limit = parseInt(c.req.query('limit') || '50', 10);
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

  const events = await db
    .select()
    .from(wakeEvents)
    .where(eq(wakeEvents.agentId, agentId))
    .orderBy(wakeEvents.createdAt)
    .limit(Math.min(limit, 100));

  // Calculate stats
  const successCount = events.filter((e) => e.success).length;
  const avgLatency =
    events.length > 0
      ? events.reduce((sum, e) => sum + (e.wakeLatencyMs || 0), 0) / events.length
      : 0;

  return c.json({
    events,
    stats: {
      total: events.length,
      successful: successCount,
      failed: events.length - successCount,
      avgLatencyMs: Math.round(avgLatency),
    },
  });
});

export { triggerRoutes };
