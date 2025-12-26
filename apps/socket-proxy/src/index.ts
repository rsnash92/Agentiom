/**
 * Agentiom Socket Proxy
 *
 * A lightweight always-on service that maintains persistent connections
 * to platforms (Slack, Discord, Telegram) and forwards events to sleeping agents.
 *
 * Architecture:
 * 1. Loads all active integrations from DB on startup
 * 2. Establishes socket connections for each integration
 * 3. When events arrive, wakes the target agent and forwards the event
 * 4. Handles reconnection, retries, and error recovery
 */

import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { createLogger } from '@agentiom/shared';
import { ConnectionManager } from './services/connection-manager';
import { EventRouter } from './services/event-router';
import { SlackIntegration } from './integrations/slack';
import { DiscordIntegration } from './integrations/discord';
import { TelegramIntegration } from './integrations/telegram';

const log = createLogger('socket-proxy');

// =============================================================================
// Configuration
// =============================================================================

const config = {
  port: parseInt(process.env.PORT || '3002', 10),
  apiUrl: process.env.AGENTIOM_API_URL || 'http://localhost:3001',
  internalToken: process.env.AGENTIOM_INTERNAL_TOKEN || '',
  databaseUrl: process.env.DATABASE_URL || '',

  // Reconnection settings
  maxRetries: 10,
  baseRetryDelayMs: 1000,
  maxRetryDelayMs: 60000,

  // Health check interval
  healthCheckIntervalMs: 30000,
};

// =============================================================================
// Initialize Services
// =============================================================================

const eventRouter = new EventRouter({
  apiUrl: config.apiUrl,
  internalToken: config.internalToken,
});

const connectionManager = new ConnectionManager({
  eventRouter,
  maxRetries: config.maxRetries,
  baseRetryDelayMs: config.baseRetryDelayMs,
  maxRetryDelayMs: config.maxRetryDelayMs,
});

// Register platform integrations
connectionManager.registerPlatform('slack', SlackIntegration);
connectionManager.registerPlatform('discord', DiscordIntegration);
connectionManager.registerPlatform('telegram', TelegramIntegration);

// =============================================================================
// HTTP API (for management and health checks)
// =============================================================================

const app = new Hono();

app.use('*', logger());

// Health check
app.get('/health', (c) => {
  const stats = connectionManager.getStats();
  return c.json({
    status: 'ok',
    uptime: process.uptime(),
    connections: stats,
  });
});

// Get all active connections
app.get('/connections', (c) => {
  const connections = connectionManager.getAllConnections();
  return c.json({ connections });
});

// Get connection for specific integration
app.get('/connections/:integrationId', (c) => {
  const integrationId = c.req.param('integrationId');
  const connection = connectionManager.getConnection(integrationId);

  if (!connection) {
    return c.json({ error: 'Connection not found' }, 404);
  }

  return c.json(connection);
});

// Connect a new integration
app.post('/connections', async (c) => {
  try {
    const body = await c.req.json();
    const { integrationId } = body;

    if (!integrationId) {
      return c.json({ error: 'integrationId is required' }, 400);
    }

    await connectionManager.connect(integrationId);

    return c.json({ success: true, integrationId });
  } catch (error) {
    log.error({ error }, 'Failed to connect integration');
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to connect'
    }, 500);
  }
});

// Disconnect an integration
app.delete('/connections/:integrationId', async (c) => {
  const integrationId = c.req.param('integrationId');

  try {
    await connectionManager.disconnect(integrationId);
    return c.json({ success: true });
  } catch (error) {
    log.error({ error }, 'Failed to disconnect integration');
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to disconnect'
    }, 500);
  }
});

// Reconnect an integration
app.post('/connections/:integrationId/reconnect', async (c) => {
  const integrationId = c.req.param('integrationId');

  try {
    await connectionManager.reconnect(integrationId);
    return c.json({ success: true });
  } catch (error) {
    log.error({ error }, 'Failed to reconnect integration');
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to reconnect'
    }, 500);
  }
});

// Telegram webhook endpoint (Telegram uses HTTP webhooks, not sockets)
app.post('/webhook/telegram/:integrationId', async (c) => {
  const integrationId = c.req.param('integrationId');

  try {
    const update = await c.req.json();
    await connectionManager.handleTelegramWebhook(integrationId, update);
    return c.json({ ok: true });
  } catch (error) {
    log.error({ error, integrationId }, 'Failed to handle Telegram webhook');
    return c.json({ error: 'Failed to process update' }, 500);
  }
});

// =============================================================================
// Startup
// =============================================================================

async function start() {
  log.info({ config: { port: config.port, apiUrl: config.apiUrl } }, 'Starting socket proxy');

  // Load and connect all active integrations
  try {
    await connectionManager.loadAndConnectAll();
    log.info('All integrations loaded');
  } catch (error) {
    log.error({ error }, 'Failed to load integrations');
  }

  // Start health check loop
  setInterval(() => {
    connectionManager.checkHealth();
  }, config.healthCheckIntervalMs);

  // Start HTTP server
  Bun.serve({
    port: config.port,
    fetch: app.fetch,
  });

  log.info({ port: config.port }, 'Socket proxy listening');
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  log.info('Received SIGTERM, shutting down gracefully');
  await connectionManager.disconnectAll();
  process.exit(0);
});

process.on('SIGINT', async () => {
  log.info('Received SIGINT, shutting down gracefully');
  await connectionManager.disconnectAll();
  process.exit(0);
});

start().catch((error) => {
  log.error({ error }, 'Failed to start socket proxy');
  process.exit(1);
});
