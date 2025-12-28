/**
 * Proxy Routes
 *
 * Routes requests to individual agent machines.
 * Handles wake-on-request: if agent is sleeping, wakes it first.
 *
 * Usage:
 *   POST /agents/:slug/proxy/webhook  -> Proxied to agent's /webhook endpoint
 *   GET  /agents/:slug/proxy/health   -> Proxied to agent's /health endpoint
 *   POST /agents/:slug/proxy/*        -> Proxied to agent's /* endpoint
 */

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { agents } from '@agentiom/db/schema';
import type { Env } from '../types';
import { createLogger } from '@agentiom/shared';

const log = createLogger('proxy-routes');

// Fly.io networking
const FLY_APP_NAME = process.env.AGENTIOM_FLY_APP_NAME || 'agentiom-agents';

/**
 * Build URL for a Fly.io machine.
 * Uses public HTTPS URL which supports fly-force-instance-id header.
 * TODO: Switch to Flycast for internal networking once both apps are same region.
 */
function getAgentUrl(path: string): string {
  return `https://${FLY_APP_NAME}.fly.dev${path}`;
}

const proxyRoutes = new Hono<Env>();

// =============================================================================
// ALL /agents/:slug/proxy/* - Proxy requests to agent machines
// =============================================================================

proxyRoutes.all('/:slug/proxy/*', async (c) => {
  const slug = c.req.param('slug');
  const db = c.get('db');
  const lifecycle = c.get('lifecycle');
  const activity = c.get('activity');

  // Extract the path after /proxy/
  const fullPath = c.req.path;
  const proxyPath = fullPath.replace(`/agents/${slug}/proxy`, '') || '/';

  log.info({ slug, proxyPath, method: c.req.method }, 'Proxy request received');

  // Look up agent by slug
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.slug, slug))
    .limit(1);

  if (!agent) {
    log.warn({ slug }, 'Agent not found');
    return c.json({ error: 'Agent not found' }, 404);
  }

  if (!agent.machineId) {
    log.warn({ slug, agentId: agent.id }, 'Agent has no machine');
    return c.json({ error: 'Agent not deployed' }, 503);
  }

  // Track start time for latency measurement
  const startTime = Date.now();

  // If agent is sleeping, wake it first
  if (agent.status === 'sleeping' || agent.status === 'stopped') {
    log.info({ slug, agentId: agent.id, status: agent.status }, 'Agent sleeping, waking...');

    const wakeResult = await lifecycle.wake(agent.id, 'webhook', {
      source: 'proxy',
      path: proxyPath,
      method: c.req.method,
      timestamp: new Date().toISOString(),
    });

    if (!wakeResult.success) {
      log.error({ slug, error: wakeResult.error }, 'Failed to wake agent');
      await activity.logError(agent.id, `Failed to wake: ${wakeResult.error}`);
      return c.json({
        error: 'Failed to wake agent',
        details: wakeResult.error,
      }, 503);
    }

    log.info({ slug, wakeLatencyMs: wakeResult.latencyMs }, 'Agent woken');
    await activity.logWake(agent.id, 'webhook', wakeResult.latencyMs || 0);
  }

  // Build the target URL
  const targetUrl = getAgentUrl(proxyPath);

  // Log the incoming request
  let requestPreview = `${c.req.method} ${proxyPath}`;
  try {
    if (['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
      const clonedBody = await c.req.raw.clone().text();
      if (clonedBody) {
        const parsed = JSON.parse(clonedBody);
        requestPreview = parsed.message || parsed.text || clonedBody.slice(0, 100);
      }
    }
  } catch {
    // Ignore parsing errors
  }
  await activity.logRequest(agent.id, proxyPath === '/slack' ? 'Slack' : 'Webhook', requestPreview);

  try {
    // Forward the request to the agent machine
    const headers = new Headers();

    // Copy relevant headers from original request
    const headersToCopy = [
      'content-type',
      'accept',
      'authorization',
      'x-request-id',
      'x-forwarded-for',
      'user-agent',
    ];

    for (const header of headersToCopy) {
      const value = c.req.header(header);
      if (value) {
        headers.set(header, value);
      }
    }

    // Add proxy headers
    headers.set('x-agentiom-agent-id', agent.id);
    headers.set('x-agentiom-agent-slug', agent.slug);
    headers.set('x-forwarded-host', c.req.header('host') || '');

    // Target specific machine via Flycast
    headers.set('fly-force-instance-id', agent.machineId);

    // Get request body for POST/PUT/PATCH
    let body: BodyInit | undefined;
    if (['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
      body = await c.req.raw.clone().arrayBuffer();
    }

    log.debug({ targetUrl, method: c.req.method }, 'Forwarding request');

    const response = await fetch(targetUrl, {
      method: c.req.method,
      headers,
      body,
    });

    const proxyLatencyMs = Date.now() - startTime;

    // Stream the response back
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('x-agentiom-proxy-latency', String(proxyLatencyMs));
    responseHeaders.set('x-agentiom-agent-id', agent.id);

    log.info({
      slug,
      proxyPath,
      status: response.status,
      proxyLatencyMs,
    }, 'Proxy request completed');

    // Log successful response
    await activity.logResponse(agent.id, proxyLatencyMs);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error({ slug, targetUrl, error: errorMessage }, 'Proxy request failed');

    // Log the error
    await activity.logError(agent.id, `Proxy error: ${errorMessage}`);

    // Check if it's a connection error (machine might still be starting)
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
      return c.json({
        error: 'Agent not ready',
        details: 'The agent machine is starting up. Please retry in a moment.',
        retryAfter: 2,
      }, 503);
    }

    return c.json({
      error: 'Proxy error',
      details: errorMessage,
    }, 502);
  }
});

export { proxyRoutes };
