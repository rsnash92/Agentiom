/**
 * Integration Routes
 *
 * Add this to your main API app to manage platform integrations.
 * These routes handle CRUD for integrations and communicate with the socket proxy.
 */

import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { integrations, agents } from '@agentiom/db/schema';
import { createLogger } from '@agentiom/shared';
import type { Env } from '../types';

const log = createLogger('integration-routes');

const SOCKET_PROXY_URL = process.env.SOCKET_PROXY_URL || 'http://localhost:3002';
const INTERNAL_TOKEN = process.env.AGENTIOM_INTERNAL_TOKEN || '';

const integrationRoutes = new Hono<Env>();

// =============================================================================
// List integrations for an agent
// =============================================================================

integrationRoutes.get('/:agentId/integrations', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const agentId = c.req.param('agentId');

  // Verify agent ownership
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, user.id)))
    .limit(1);

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  const results = await db
    .select()
    .from(integrations)
    .where(eq(integrations.agentId, agentId));

  // Strip sensitive tokens from response
  const sanitized = results.map(i => ({
    id: i.id,
    agentId: i.agentId,
    platform: i.platform,
    name: i.name,
    status: i.status,
    statusMessage: i.statusMessage,
    lastConnectedAt: i.lastConnectedAt,
    lastEventAt: i.lastEventAt,
    eventsReceived: i.eventsReceived,
    eventsDelivered: i.eventsDelivered,
    eventsFailed: i.eventsFailed,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  }));

  return c.json({ integrations: sanitized });
});

// =============================================================================
// Get single integration
// =============================================================================

integrationRoutes.get('/integrations/:integrationId', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const integrationId = c.req.param('integrationId');

  const [integration] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.id, integrationId))
    .limit(1);

  if (!integration) {
    return c.json({ error: 'Integration not found' }, 404);
  }

  // Verify ownership via agent
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, integration.agentId), eq(agents.userId, user.id)))
    .limit(1);

  if (!agent) {
    return c.json({ error: 'Integration not found' }, 404);
  }

  // Strip sensitive tokens
  return c.json({
    id: integration.id,
    agentId: integration.agentId,
    platform: integration.platform,
    name: integration.name,
    status: integration.status,
    statusMessage: integration.statusMessage,
    webhookPath: integration.webhookPath,
    eventFilter: integration.eventFilter,
    lastConnectedAt: integration.lastConnectedAt,
    lastEventAt: integration.lastEventAt,
    eventsReceived: integration.eventsReceived,
    eventsDelivered: integration.eventsDelivered,
    eventsFailed: integration.eventsFailed,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
    // Include workspace/server info where available
    slackTeamName: integration.slackTeamName,
    discordGuildId: integration.discordGuildId,
  });
});

// =============================================================================
// Create integration
// =============================================================================

integrationRoutes.post('/:agentId/integrations', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const agentId = c.req.param('agentId');

  // Verify agent ownership
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, user.id)))
    .limit(1);

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  const body = await c.req.json();
  const { platform, name, ...credentials } = body;

  if (!platform || !name) {
    return c.json({ error: 'platform and name are required' }, 400);
  }

  // Validate platform-specific credentials
  if (platform === 'slack') {
    if (!credentials.slackAppToken || !credentials.slackBotToken) {
      return c.json({
        error: 'slackAppToken and slackBotToken are required for Slack'
      }, 400);
    }
  } else if (platform === 'discord') {
    if (!credentials.discordBotToken) {
      return c.json({
        error: 'discordBotToken is required for Discord'
      }, 400);
    }
  } else if (platform === 'telegram') {
    if (!credentials.telegramBotToken) {
      return c.json({
        error: 'telegramBotToken is required for Telegram'
      }, 400);
    }
  }

  // Create integration record
  const [integration] = await db
    .insert(integrations)
    .values({
      agentId,
      platform,
      name,
      status: 'pending',
      webhookPath: credentials.webhookPath || '/webhook',
      eventFilter: credentials.eventFilter || null,
      // Slack
      slackAppToken: credentials.slackAppToken,
      slackBotToken: credentials.slackBotToken,
      slackTeamId: credentials.slackTeamId,
      slackTeamName: credentials.slackTeamName,
      // Discord
      discordBotToken: credentials.discordBotToken,
      discordGuildId: credentials.discordGuildId,
      discordApplicationId: credentials.discordApplicationId,
      // Telegram
      telegramBotToken: credentials.telegramBotToken,
      telegramWebhookSecret: credentials.telegramWebhookSecret,
      // Custom WS
      customWsUrl: credentials.customWsUrl,
      customWsHeaders: credentials.customWsHeaders,
    })
    .returning();

  log.info({ integrationId: integration.id, platform }, 'Integration created');

  // Notify socket proxy to connect
  try {
    const proxyResponse = await fetch(`${SOCKET_PROXY_URL}/connections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INTERNAL_TOKEN}`,
      },
      body: JSON.stringify({
        integrationId: integration.id,
        config: {
          id: integration.id,
          agentId,
          platform,
          name,
          ...credentials,
        },
      }),
    });

    if (proxyResponse.ok) {
      await db
        .update(integrations)
        .set({ status: 'connecting' })
        .where(eq(integrations.id, integration.id));
    }
  } catch (error) {
    log.error({ error, integrationId: integration.id }, 'Failed to notify socket proxy');
    // Don't fail the request - integration is created, proxy will retry
  }

  return c.json({
    id: integration.id,
    agentId: integration.agentId,
    platform: integration.platform,
    name: integration.name,
    status: 'connecting',
    createdAt: integration.createdAt,
  }, 201);
});

// =============================================================================
// Update integration
// =============================================================================

integrationRoutes.patch('/integrations/:integrationId', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const integrationId = c.req.param('integrationId');

  const [integration] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.id, integrationId))
    .limit(1);

  if (!integration) {
    return c.json({ error: 'Integration not found' }, 404);
  }

  // Verify ownership
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, integration.agentId), eq(agents.userId, user.id)))
    .limit(1);

  if (!agent) {
    return c.json({ error: 'Integration not found' }, 404);
  }

  const body = await c.req.json();
  const allowedUpdates = [
    'name',
    'webhookPath',
    'eventFilter',
    'slackAppToken',
    'slackBotToken',
    'discordBotToken',
    'discordGuildId',
    'telegramBotToken',
    'customWsUrl',
    'customWsHeaders',
  ];

  const updates: any = {};
  for (const key of allowedUpdates) {
    if (body[key] !== undefined) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'No valid updates provided' }, 400);
  }

  updates.updatedAt = new Date();

  await db
    .update(integrations)
    .set(updates)
    .where(eq(integrations.id, integrationId));

  // If credentials changed, reconnect
  const credentialFields = [
    'slackAppToken', 'slackBotToken',
    'discordBotToken',
    'telegramBotToken',
    'customWsUrl', 'customWsHeaders'
  ];

  const credentialsChanged = credentialFields.some(f => body[f] !== undefined);

  if (credentialsChanged) {
    try {
      await fetch(`${SOCKET_PROXY_URL}/connections/${integrationId}/reconnect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${INTERNAL_TOKEN}`,
        },
      });
    } catch (error) {
      log.error({ error, integrationId }, 'Failed to trigger reconnect');
    }
  }

  return c.json({ success: true });
});

// =============================================================================
// Delete integration
// =============================================================================

integrationRoutes.delete('/integrations/:integrationId', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const integrationId = c.req.param('integrationId');

  const [integration] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.id, integrationId))
    .limit(1);

  if (!integration) {
    return c.json({ error: 'Integration not found' }, 404);
  }

  // Verify ownership
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, integration.agentId), eq(agents.userId, user.id)))
    .limit(1);

  if (!agent) {
    return c.json({ error: 'Integration not found' }, 404);
  }

  // Disconnect from socket proxy first
  try {
    await fetch(`${SOCKET_PROXY_URL}/connections/${integrationId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${INTERNAL_TOKEN}`,
      },
    });
  } catch (error) {
    log.error({ error, integrationId }, 'Failed to disconnect from socket proxy');
  }

  // Delete from database
  await db
    .delete(integrations)
    .where(eq(integrations.id, integrationId));

  log.info({ integrationId }, 'Integration deleted');

  return c.json({ success: true });
});

// =============================================================================
// Reconnect integration
// =============================================================================

integrationRoutes.post('/integrations/:integrationId/reconnect', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const integrationId = c.req.param('integrationId');

  const [integration] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.id, integrationId))
    .limit(1);

  if (!integration) {
    return c.json({ error: 'Integration not found' }, 404);
  }

  // Verify ownership
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, integration.agentId), eq(agents.userId, user.id)))
    .limit(1);

  if (!agent) {
    return c.json({ error: 'Integration not found' }, 404);
  }

  try {
    const response = await fetch(`${SOCKET_PROXY_URL}/connections/${integrationId}/reconnect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${INTERNAL_TOKEN}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return c.json({ error: `Failed to reconnect: ${error}` }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    log.error({ error, integrationId }, 'Failed to reconnect');
    return c.json({ error: 'Failed to reconnect' }, 500);
  }
});

// =============================================================================
// Disable integration (stop receiving events)
// =============================================================================

integrationRoutes.post('/integrations/:integrationId/disable', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const integrationId = c.req.param('integrationId');

  const [integration] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.id, integrationId))
    .limit(1);

  if (!integration) {
    return c.json({ error: 'Integration not found' }, 404);
  }

  // Verify ownership
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, integration.agentId), eq(agents.userId, user.id)))
    .limit(1);

  if (!agent) {
    return c.json({ error: 'Integration not found' }, 404);
  }

  // Disconnect from socket proxy
  try {
    await fetch(`${SOCKET_PROXY_URL}/connections/${integrationId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${INTERNAL_TOKEN}`,
      },
    });
  } catch (error) {
    log.error({ error, integrationId }, 'Failed to disconnect');
  }

  // Update status
  await db
    .update(integrations)
    .set({
      status: 'disabled',
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, integrationId));

  return c.json({ success: true });
});

// =============================================================================
// Enable integration (start receiving events)
// =============================================================================

integrationRoutes.post('/integrations/:integrationId/enable', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const integrationId = c.req.param('integrationId');

  const [integration] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.id, integrationId))
    .limit(1);

  if (!integration) {
    return c.json({ error: 'Integration not found' }, 404);
  }

  // Verify ownership
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, integration.agentId), eq(agents.userId, user.id)))
    .limit(1);

  if (!agent) {
    return c.json({ error: 'Integration not found' }, 404);
  }

  // Connect via socket proxy
  try {
    const response = await fetch(`${SOCKET_PROXY_URL}/connections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INTERNAL_TOKEN}`,
      },
      body: JSON.stringify({
        integrationId: integration.id,
      }),
    });

    if (response.ok) {
      await db
        .update(integrations)
        .set({
          status: 'connecting',
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, integrationId));
    }
  } catch (error) {
    log.error({ error, integrationId }, 'Failed to enable');
    return c.json({ error: 'Failed to enable' }, 500);
  }

  return c.json({ success: true });
});

export { integrationRoutes };
