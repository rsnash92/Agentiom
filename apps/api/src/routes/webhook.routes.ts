/**
 * Webhook Routes - Phase 2
 * 
 * Public endpoints for webhook triggers:
 * - POST /webhooks/:agentId/:secret - Trigger agent via webhook
 * - POST /webhooks/:agentId/:secret/:path* - Trigger with custom path
 * 
 * These endpoints don't require auth - security is via the webhook secret.
 */

import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { agents, triggers } from '@agentiom/db/schema';
import type { Env } from '../types';
import { createLogger } from '@agentiom/shared';

const log = createLogger('webhook-routes');

const webhookRoutes = new Hono<Env>();

// =============================================================================
// POST /webhooks/:agentId/generate-secret - Generate webhook secret (AUTH REQUIRED)
// This must be defined BEFORE the /:agentId/:secret route to avoid matching
// =============================================================================

webhookRoutes.post('/:agentId/generate-secret', async (c) => {
  const agentId = c.req.param('agentId');
  const db = c.get('db');
  const user = c.get('user');

  // User should be set by auth middleware
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

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

  // Generate new secret
  const secret = crypto.randomUUID().replace(/-/g, '');

  // Update agent
  await db
    .update(agents)
    .set({
      webhookSecret: secret,
      updatedAt: new Date(),
    })
    .where(eq(agents.id, agentId));

  return c.json({
    success: true,
    webhookSecret: secret,
    webhookUrl: `${c.req.url.split('/webhooks')[0]}/webhooks/${agentId}/${secret}`,
  });
});

/**
 * Verify webhook secret matches
 */
async function verifyWebhookSecret(
  db: any,
  agentId: string,
  secret: string
): Promise<{ valid: boolean; agent?: any }> {
  const [agent] = await db
    .select({
      id: agents.id,
      status: agents.status,
      webhookSecret: agents.webhookSecret,
      url: agents.url,
    })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (!agent) {
    return { valid: false };
  }

  if (agent.webhookSecret !== secret) {
    return { valid: false };
  }

  return { valid: true, agent };
}

// =============================================================================
// POST /webhooks/:agentId/:secret - Trigger webhook
// =============================================================================

webhookRoutes.post('/:agentId/:secret', async (c) => {
  const { agentId, secret } = c.req.param();
  const db = c.get('db');
  const lifecycle = c.get('lifecycle');

  log.info({ agentId }, 'Webhook received');

  // Verify secret
  const { valid, agent } = await verifyWebhookSecret(db, agentId, secret);

  if (!valid) {
    log.warn({ agentId }, 'Invalid webhook secret');
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Get request body
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    body = null;
  }

  // Get headers that might be useful
  const headers: Record<string, string> = {};
  const relevantHeaders = ['content-type', 'x-github-event', 'x-gitlab-event', 'x-stripe-signature'];
  for (const h of relevantHeaders) {
    const value = c.req.header(h);
    if (value) headers[h] = value;
  }

  // Build trigger context
  const triggerContext = {
    source: 'webhook',
    path: '/',
    method: 'POST',
    headers,
    body,
    timestamp: new Date().toISOString(),
  };

  // Wake the agent
  const result = await lifecycle.wake(agentId, 'webhook', triggerContext);

  if (!result.success) {
    log.error({ agentId, error: result.error }, 'Failed to wake agent via webhook');
    return c.json(
      {
        error: result.error || 'Failed to wake agent',
        status: result.newStatus,
      },
      500
    );
  }

  log.info(
    { agentId, latencyMs: result.latencyMs },
    'Agent woken via webhook'
  );

  // If agent is running and has a URL, we could optionally forward
  // the webhook payload to the agent (future enhancement)

  return c.json({
    success: true,
    agentStatus: result.newStatus,
    latencyMs: result.latencyMs,
    message: 'Webhook processed successfully',
  });
});

// =============================================================================
// POST /webhooks/:agentId/:secret/:path* - Trigger with custom path
// =============================================================================

webhookRoutes.post('/:agentId/:secret/*', async (c) => {
  const { agentId, secret } = c.req.param();
  const path = c.req.path.replace(`/webhooks/${agentId}/${secret}`, '') || '/';
  const db = c.get('db');
  const lifecycle = c.get('lifecycle');

  log.info({ agentId, path }, 'Webhook received with path');

  // Verify secret
  const { valid, agent } = await verifyWebhookSecret(db, agentId, secret);

  if (!valid) {
    log.warn({ agentId }, 'Invalid webhook secret');
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Get request body
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    body = null;
  }

  // Get headers
  const headers: Record<string, string> = {};
  const relevantHeaders = ['content-type', 'x-github-event', 'x-gitlab-event', 'x-stripe-signature'];
  for (const h of relevantHeaders) {
    const value = c.req.header(h);
    if (value) headers[h] = value;
  }

  // Build trigger context with path info
  const triggerContext = {
    source: 'webhook',
    path,
    method: 'POST',
    headers,
    body,
    timestamp: new Date().toISOString(),
  };

  // Wake the agent
  const result = await lifecycle.wake(agentId, 'webhook', triggerContext);

  if (!result.success) {
    log.error({ agentId, error: result.error }, 'Failed to wake agent via webhook');
    return c.json(
      {
        error: result.error || 'Failed to wake agent',
        status: result.newStatus,
      },
      500
    );
  }

  log.info(
    { agentId, path, latencyMs: result.latencyMs },
    'Agent woken via webhook with path'
  );

  return c.json({
    success: true,
    agentStatus: result.newStatus,
    latencyMs: result.latencyMs,
    path,
    message: 'Webhook processed successfully',
  });
});

export { webhookRoutes };
