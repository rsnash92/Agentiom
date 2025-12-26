# @agentiom/sdk

Build stateful AI agents that sleep between tasks.

## Install

```bash
bun add @agentiom/sdk
# or
npm install @agentiom/sdk
```

## Quick Start

```typescript
import { Agent } from '@agentiom/sdk';

const agent = new Agent({ name: 'my-agent' });

// Handle incoming webhooks
agent.on('webhook', async (event, ctx) => {
  // State persists between invocations
  const count = ctx.state.get('count') || 0;
  ctx.state.set('count', count + 1);

  return { message: `Hello! This is request #${count + 1}` };
});

agent.start();
```

```bash
$ bun run index.ts
🤖 Agent "my-agent" running on port 3000
   Webhook: http://localhost:3000/webhook
   Health:  http://localhost:3000/health
```

## Features

### Persistent State

State survives agent sleep/wake cycles:

```typescript
agent.on('webhook', async (event, ctx) => {
  // Simple key-value
  ctx.state.set('lastSeen', new Date());

  // Nested access with dot notation
  ctx.state.set('user.profile.name', 'Alice');
  const name = ctx.state.get('user.profile.name');

  // Arrays
  ctx.state.push('messages', { text: event.body.text, time: Date.now() });

  // Counters
  const views = ctx.state.increment('pageViews');

  // Scoped state (namespacing)
  const userState = ctx.state.scope(`users.${event.body.userId}`);
  userState.set('preferences', { theme: 'dark' });
});
```

### Multiple Event Types

```typescript
// HTTP webhooks
agent.on('webhook', async (event, ctx) => {
  console.log(event.method, event.path, event.body);
});

// Scheduled/cron jobs
agent.on('cron', async (event, ctx) => {
  console.log('Running scheduled task at', event.scheduledTime);
});

// Slack messages
agent.on('slack', async (event, ctx) => {
  console.log(`${event.user} said: ${event.text}`);
  return { text: 'Got it!' }; // Reply
});

// Discord messages
agent.on('discord', async (event, ctx) => {
  console.log(`${event.author?.username}: ${event.content}`);
  return { content: 'Hello!' };
});

// Telegram messages
agent.on('telegram', async (event, ctx) => {
  console.log(`Chat ${event.chatId}: ${event.text}`);
  return { text: 'Received!' };
});

// Incoming emails
agent.on('email', async (event, ctx) => {
  console.log(`Email from ${event.from}: ${event.subject}`);
});
```

### Lifecycle Hooks

```typescript
// Run on startup (when agent wakes)
agent.onStartup(async (ctx) => {
  ctx.log.info('Agent waking up!');

  // Load any external data
  const data = await fetch('https://api.example.com/init');
  ctx.state.set('externalData', await data.json());
});

// Run on shutdown (before agent sleeps)
agent.onShutdown(async (ctx) => {
  ctx.log.info('Agent going to sleep...');

  // Cleanup, save to external systems, etc.
  await saveToExternalDB(ctx.state.toJSON());
});
```

### Context Utilities

```typescript
agent.on('webhook', async (event, ctx) => {
  // Logging
  ctx.log.debug('Processing request');
  ctx.log.info('User action');
  ctx.log.warn('Something odd');
  ctx.log.error('Something wrong');

  // Environment variables
  const apiKey = ctx.requireEnv('OPENAI_API_KEY');
  const optional = ctx.getEnv('DEBUG', 'false');

  // Utilities
  const id = ctx.randomId(); // 'a3f8b2c1d4e5...'
  const time = ctx.now();    // { date, iso, unix, unixMs }
  await ctx.sleep(1000);     // Wait 1 second

  // HTTP requests
  const response = await ctx.fetch('https://api.example.com/data');
});
```

### Custom Routes

For advanced use cases, access the underlying Hono app:

```typescript
const agent = new Agent();
const app = agent.getApp();

// Add custom routes
app.get('/custom', (c) => c.json({ custom: true }));
app.post('/upload', async (c) => {
  const body = await c.req.formData();
  // Handle file upload
});

agent.start();
```

## Configuration

```typescript
const agent = new Agent({
  name: 'my-agent',        // Agent name
  port: 3000,              // Port to listen on
  statePath: './state',    // Where to store state
  logLevel: 'info',        // debug | info | warn | error | silent
});
```

Or via environment variables:

```bash
AGENTIOM_AGENT_NAME=my-agent
PORT=3000
AGENTIOM_STATE_PATH=./state
```

## Deployment

### With Agentiom CLI

```bash
$ npx agentiom deploy

🔍 Detected: Node.js agent
📦 Building...
🚀 Deploying...

✅ Deployed!
   URL: https://my-agent.agentiom.dev
```

### With Docker

```dockerfile
FROM oven/bun:1.1-alpine
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
CMD ["bun", "run", "index.ts"]
```

## Event Reference

### WebhookEvent

```typescript
interface WebhookEvent {
  type: 'webhook';
  method: string;          // GET, POST, etc.
  path: string;            // /webhook
  headers: Record<string, string>;
  query: Record<string, string>;
  body: any;
  timestamp: Date;
}
```

### SlackEvent

```typescript
interface SlackEvent {
  type: 'slack';
  eventType: string;       // message, app_mention, etc.
  channel?: string;
  user?: string;
  text?: string;
  threadTs?: string;
  ts?: string;
  raw: any;                // Full Slack payload
  timestamp: Date;
}
```

### DiscordEvent

```typescript
interface DiscordEvent {
  type: 'discord';
  eventType: string;       // messageCreate, interactionCreate, etc.
  channelId?: string;
  guildId?: string;
  author?: { id: string; username: string };
  content?: string;
  messageId?: string;
  raw: any;
  timestamp: Date;
}
```

### TelegramEvent

```typescript
interface TelegramEvent {
  type: 'telegram';
  eventType: string;       // message, callback_query, etc.
  chatId?: number;
  from?: { id: number; username?: string; first_name?: string };
  text?: string;
  messageId?: number;
  raw: any;
  timestamp: Date;
}
```

### CronEvent

```typescript
interface CronEvent {
  type: 'cron';
  schedule: string;        // Cron expression
  scheduledTime: Date;
  timestamp: Date;
}
```

### EmailEvent

```typescript
interface EmailEvent {
  type: 'email';
  from: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    size: number;
    content?: string;      // Base64
  }>;
  raw: any;
  timestamp: Date;
}
```

## License

MIT
