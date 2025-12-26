import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { createLogger } from '@agentiom/shared';
import { createDatabase } from '@agentiom/db';
import { isAgentiomError } from '@agentiom/shared';
import { AuthService } from './services/auth.service';
import { AgentService } from './services/agent.service';
import { DeployService } from './services/deploy.service';
import { LifecycleService } from './services/lifecycle.service';
import { createAuthRoutes } from './routes/auth';
import { createAgentRoutes } from './routes/agents';
import { lifecycleRoutes } from './routes/lifecycle.routes';
import { webhookRoutes } from './routes/webhook.routes';
import { triggerRoutes } from './routes/trigger.routes';
import { demoRoutes } from './routes/demo.routes';
import { createIdleMonitor } from './jobs/idle-monitor';
import { createAuthMiddleware } from './middleware/auth';
import type { Env } from './types';

const log = createLogger('api');

// Environment validation
const DATABASE_URL = process.env.DATABASE_URL ?? 'file:local.db';
const JWT_SECRET = process.env.JWT_SECRET;
const FLY_API_TOKEN = process.env.FLY_API_TOKEN;
const FLY_APP_NAME = process.env.FLY_APP_NAME;

if (!JWT_SECRET) {
  log.error('JWT_SECRET environment variable is required');
  process.exit(1);
}

// Log provider status
if (FLY_API_TOKEN && FLY_APP_NAME) {
  log.info({ appName: FLY_APP_NAME }, 'Fly.io credentials configured');
} else {
  log.warn('FLY_API_TOKEN or FLY_APP_NAME not set, using mock providers');
}

// Initialize database
const db = createDatabase(DATABASE_URL);

// Initialize services
const authService = new AuthService(db, JWT_SECRET);
const agentService = new AgentService(db);
const deployService = new DeployService(db, {
  flyApiToken: FLY_API_TOKEN,
  flyAppName: FLY_APP_NAME,
});
const lifecycleService = new LifecycleService(db, deployService.providers);

// Start idle monitor
const idleMonitor = createIdleMonitor(lifecycleService);
idleMonitor.start();

// Create app with typed context
const app = new Hono<Env>();

// Global middleware
app.use('*', logger());
app.use('*', cors());

// Inject db and lifecycle into context for all routes
app.use('*', async (c, next) => {
  c.set('db', db);
  c.set('lifecycle', lifecycleService);
  await next();
});

// Global error handler
app.onError((err, c) => {
  if (isAgentiomError(err)) {
    log.warn({ error: err.toJSON(), path: c.req.path }, 'Request error');
    return c.json(err.toJSON(), err.statusCode as 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502);
  }

  log.error({ error: err.message, stack: err.stack, path: c.req.path }, 'Unhandled error');
  return c.json(
    {
      error: {
        code: 'internal_error',
        message: 'An unexpected error occurred',
      },
    },
    500
  );
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    version: '0.0.1',
    timestamp: new Date().toISOString(),
  });
});

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Agentiom API',
    version: '0.0.1',
    docs: '/docs',
  });
});

// Auth routes (public)
app.route('/auth', createAuthRoutes(authService));

// Agent routes (authenticated)
app.route('/agents', createAgentRoutes(agentService, deployService, authService));

// Create auth middleware for lifecycle/trigger routes
const requireAuth = createAuthMiddleware(authService);

// Lifecycle routes (authenticated) - /agents/:id/wake, /sleep, /status, /auto-sleep
app.use('/agents/:id/wake', requireAuth);
app.use('/agents/:id/sleep', requireAuth);
app.use('/agents/:id/status', requireAuth);
app.use('/agents/:id/auto-sleep', requireAuth);
app.use('/agents/:id/activity', requireAuth);
app.route('/agents', lifecycleRoutes);

// Trigger routes (authenticated) - /agents/:id/triggers/*
app.use('/agents/:id/triggers', requireAuth);
app.use('/agents/:id/triggers/*', requireAuth);
app.use('/agents/:id/wake-events', requireAuth);
app.route('/agents', triggerRoutes);

// Webhook routes - /webhooks/:agentId/:secret (public), generate-secret (authenticated)
app.use('/webhooks/:agentId/generate-secret', requireAuth);
app.route('/webhooks', webhookRoutes);

// Demo routes (public) - for landing page live feed
app.route('/demo', demoRoutes);

log.info('API running on http://localhost:3000');

export default {
  port: 3000,
  fetch: app.fetch,
};
