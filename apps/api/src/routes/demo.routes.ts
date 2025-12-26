/**
 * Demo Routes
 *
 * Public endpoints for the landing page demo feed:
 * - GET /demo/activity - Get recent activity
 * - GET /demo/status - Get demo agent status
 * - GET /demo/stats - Get aggregate stats
 * - POST /demo/activity - Log activity from demo agent (authenticated)
 */

import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import type { Env } from '../types';
import { createLogger } from '@agentiom/shared';

const log = createLogger('demo-routes');

// In-memory activity store (in production, use Redis or database)
interface Activity {
  id: string;
  agentId: string;
  type: string;
  data: Record<string, any>;
  timestamp: string;
}

const activities: Activity[] = [];
const MAX_ACTIVITIES = 100;

// Demo agent stats
let stats = {
  totalWakes: 0,
  totalStars: 0,
  lastWake: null as string | null,
  agentStatus: 'sleeping' as 'sleeping' | 'waking' | 'running' | 'stopping',
};

const demoRoutes = new Hono<Env>();

// =============================================================================
// GET /demo/activity - Get recent activity (public)
// =============================================================================

demoRoutes.get('/activity', async (c) => {
  const limit = parseInt(c.req.query('limit') || '10');
  const safeLimit = Math.min(Math.max(limit, 1), 50);

  return c.json({
    activities: activities.slice(0, safeLimit),
    total: activities.length,
  });
});

// =============================================================================
// GET /demo/status - Get demo agent status (public)
// =============================================================================

demoRoutes.get('/status', async (c) => {
  return c.json({
    agentStatus: stats.agentStatus,
    lastWake: stats.lastWake,
    totalWakes: stats.totalWakes,
    totalStars: stats.totalStars,
  });
});

// =============================================================================
// GET /demo/stats - Get aggregate stats (public)
// =============================================================================

demoRoutes.get('/stats', async (c) => {
  return c.json({
    totalActivities: activities.length,
    totalWakes: stats.totalWakes,
    totalStars: stats.totalStars,
    recentActivity: activities.slice(0, 5),
  });
});

// =============================================================================
// POST /demo/activity - Log activity from demo agent
// =============================================================================

demoRoutes.post('/activity', async (c) => {
  // Simple auth check - demo agent sends a token
  const authHeader = c.req.header('Authorization');
  const expectedToken = process.env.DEMO_AGENT_TOKEN;

  // Allow unauthenticated in dev, or check token in prod
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const { agentId, type, data, timestamp } = body;

  const activity: Activity = {
    id: crypto.randomUUID(),
    agentId: agentId || 'demo-agent',
    type: type || 'unknown',
    data: data || {},
    timestamp: timestamp || new Date().toISOString(),
  };

  // Add to front of list
  activities.unshift(activity);

  // Trim to max size
  if (activities.length > MAX_ACTIVITIES) {
    activities.pop();
  }

  // Update stats based on activity type
  if (type === 'github_star') {
    stats.totalStars++;
    if (data?.totalStars) {
      stats.totalStars = data.totalStars;
    }
  }

  if (type === 'wake') {
    stats.totalWakes++;
    stats.lastWake = activity.timestamp;
    stats.agentStatus = 'running';
  }

  if (type === 'sleep') {
    stats.agentStatus = 'sleeping';
  }

  log.info({ type, agentId: activity.agentId }, 'Demo activity logged');

  return c.json({ success: true, id: activity.id });
});

// =============================================================================
// POST /demo/status - Update agent status (for lifecycle integration)
// =============================================================================

demoRoutes.post('/status', async (c) => {
  const body = await c.req.json();
  const { status } = body;

  if (status && ['sleeping', 'waking', 'running', 'stopping'].includes(status)) {
    stats.agentStatus = status;

    if (status === 'running') {
      stats.totalWakes++;
      stats.lastWake = new Date().toISOString();
    }

    log.info({ status }, 'Demo agent status updated');
  }

  return c.json({ success: true, status: stats.agentStatus });
});

// =============================================================================
// POST /demo/reset - Reset demo stats (for testing)
// =============================================================================

demoRoutes.post('/reset', async (c) => {
  activities.length = 0;
  stats = {
    totalWakes: 0,
    totalStars: 0,
    lastWake: null,
    agentStatus: 'sleeping',
  };

  log.info('Demo stats reset');

  return c.json({ success: true, message: 'Demo stats reset' });
});

export { demoRoutes };
