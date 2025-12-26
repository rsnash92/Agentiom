/**
 * Demo Agent - Simplified for Landing Page
 *
 * Receives webhook from GitHub stars and logs activity to Agentiom API.
 * No external API keys needed - just demonstrates the wake/work/sleep cycle.
 */

import { Hono } from 'hono';

const app = new Hono();

const AGENTIOM_API = process.env.AGENTIOM_API_URL || 'http://localhost:3000';
const AGENT_ID = process.env.AGENT_ID;
const AGENT_TOKEN = process.env.AGENT_TOKEN;

// Log activity to Agentiom API
async function logActivity(type: string, data: Record<string, any>) {
  if (!AGENT_ID || !AGENT_TOKEN) return;

  try {
    await fetch(`${AGENTIOM_API}/demo/activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AGENT_TOKEN}`,
      },
      body: JSON.stringify({
        agentId: AGENT_ID,
        type,
        data,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error('Failed to log activity:', e);
  }
}

// Health check
app.get('/health', (c) => c.json({ status: 'awake', agentId: AGENT_ID }));

// GitHub webhook handler
app.post('/webhook/github', async (c) => {
  const event = c.req.header('x-github-event');
  const payload = await c.req.json();

  console.log(`Received GitHub event: ${event}`);

  if (event === 'star' && payload.action === 'created') {
    const stargazer = payload.sender?.login || 'anonymous';
    const repo = payload.repository?.full_name || 'unknown';

    await logActivity('github_star', {
      stargazer,
      repo,
      totalStars: payload.repository?.stargazers_count,
    });

    console.log(`⭐ New star from ${stargazer} on ${repo}!`);

    return c.json({
      success: true,
      message: `Thanks for the star, ${stargazer}!`,
    });
  }

  // Log other events too
  await logActivity('github_event', { event, action: payload.action });

  return c.json({ success: true, event });
});

// Manual trigger for testing
app.post('/trigger', async (c) => {
  const body = await c.req.json().catch(() => ({}));

  await logActivity('manual_trigger', body);

  return c.json({
    success: true,
    message: 'Agent triggered manually',
    timestamp: new Date().toISOString(),
  });
});

console.log(`🤖 Demo agent starting on port ${process.env.PORT || 8080}`);

export default {
  port: parseInt(process.env.PORT || '8080'),
  fetch: app.fetch,
};
