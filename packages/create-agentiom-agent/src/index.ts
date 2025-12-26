#!/usr/bin/env node
/**
 * create-agentiom-agent
 *
 * Scaffold a new Agentiom agent project from a template.
 *
 * Usage:
 *   npx create-agentiom-agent
 *   npx create-agentiom-agent my-agent
 *   npx create-agentiom-agent my-agent --template slack-bot
 */

import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import * as readline from 'readline';

// =============================================================================
// Templates
// =============================================================================

const TEMPLATES = {
  'blank': {
    name: 'Blank Agent',
    description: 'Start from scratch with a minimal agent',
  },
  'webhook-handler': {
    name: 'Webhook Handler',
    description: 'Handle HTTP webhooks with persistent state',
  },
  'slack-bot': {
    name: 'Slack Bot',
    description: 'Respond to Slack messages with context memory',
  },
  'discord-bot': {
    name: 'Discord Bot',
    description: 'Full Discord.js integration with state',
  },
  'cron-agent': {
    name: 'Cron Agent',
    description: 'Run scheduled tasks daily or hourly',
  },
};

// =============================================================================
// CLI Helpers
// =============================================================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(message: string) {
  console.log(message);
}

function success(message: string) {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

function info(message: string) {
  console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
}

// =============================================================================
// Template Files
// =============================================================================

const TEMPLATE_FILES: Record<string, Record<string, string>> = {
  'blank': {
    'src/index.ts': `import { Agent } from '@agentiom/sdk';

const agent = new Agent({ name: '{{name}}' });

agent.on('webhook', async (event, ctx) => {
  ctx.log.info('Received webhook:', event.body);

  // Your logic here
  const count = ctx.state.increment('requestCount');

  return {
    message: 'Hello from {{name}}!',
    requestNumber: count,
  };
});

agent.start();
`,
    'package.json': `{
  "name": "{{name}}",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "start": "bun run src/index.ts",
    "deploy": "agentiom deploy"
  },
  "dependencies": {
    "@agentiom/sdk": "^0.1.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.0.0"
  }
}
`,
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
`,
    '.gitignore': `node_modules
dist
.env
.env.local
state/
*.log
`,
    'README.md': `# {{name}}

A stateful agent built with [Agentiom](https://agentiom.dev).

## Getting Started

\`\`\`bash
# Install dependencies
bun install

# Run locally
bun run dev

# Deploy to Agentiom
bun run deploy
\`\`\`

## How it works

This agent handles webhook requests and maintains persistent state between invocations.
When idle, it sleeps to save costs. When a request arrives, it wakes up with its state intact.

## Learn more

- [Agentiom Documentation](https://docs.agentiom.dev)
- [SDK Reference](https://docs.agentiom.dev/sdk)
`,
  },

  'webhook-handler': {
    'src/index.ts': `import { Agent } from '@agentiom/sdk';

const agent = new Agent({ name: '{{name}}' });

// Startup: runs when agent wakes
agent.onStartup(async (ctx) => {
  ctx.log.info('Agent waking up...');
  ctx.log.info(\`Total requests handled: \${ctx.state.get('totalRequests') || 0}\`);
});

// Handle webhooks
agent.on('webhook', async (event, ctx) => {
  const startTime = Date.now();

  // Track requests
  const requestId = ctx.randomId(8);
  ctx.state.increment('totalRequests');
  ctx.state.push('recentRequests', {
    id: requestId,
    path: event.path,
    method: event.method,
    timestamp: ctx.now().iso,
  });

  // Keep only last 100 requests
  const recent = ctx.state.get<any[]>('recentRequests') || [];
  if (recent.length > 100) {
    ctx.state.set('recentRequests', recent.slice(-100));
  }

  ctx.log.info(\`[#\${requestId}] \${event.method} \${event.path}\`);

  // Process the webhook
  const result = await processWebhook(event.body, ctx);

  return {
    requestId,
    processingTime: Date.now() - startTime,
    ...result,
  };
});

async function processWebhook(body: any, ctx: any) {
  // Your business logic here
  return {
    received: true,
    data: body,
  };
}

// Shutdown: runs before agent sleeps
agent.onShutdown(async (ctx) => {
  ctx.log.info('Agent going to sleep...');
});

agent.start();
`,
    'package.json': `{
  "name": "{{name}}",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "start": "bun run src/index.ts",
    "deploy": "agentiom deploy"
  },
  "dependencies": {
    "@agentiom/sdk": "^0.1.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.0.0"
  }
}
`,
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
`,
    '.gitignore': `node_modules
dist
.env
.env.local
state/
*.log
`,
    'README.md': `# {{name}}

A webhook handler agent with persistent state.

## Getting Started

\`\`\`bash
bun install
bun run dev
\`\`\`

## Testing

\`\`\`bash
curl -X POST http://localhost:3000/webhook \\
  -H "Content-Type: application/json" \\
  -d '{"event": "test", "data": {"foo": "bar"}}'
\`\`\`

## Deployment

\`\`\`bash
bun run deploy
\`\`\`

Your agent will get a URL like \`https://{{name}}.agentiom.dev/webhook\`
`,
  },

  'slack-bot': {
    'src/index.ts': `import { Agent, SlackEvent } from '@agentiom/sdk';

const agent = new Agent({ name: '{{name}}' });

// Track conversation context per user
interface UserContext {
  messageCount: number;
  lastMessage: string;
  lastMessageTime: string;
  topics: string[];
}

agent.on('slack', async (event: SlackEvent, ctx) => {
  const userId = event.user || 'unknown';
  const userState = ctx.state.scope(\`users.\${userId}\`);

  // Get or create user context
  const context = userState.get<UserContext>('context') || {
    messageCount: 0,
    lastMessage: '',
    lastMessageTime: '',
    topics: [],
  };

  // Update context
  context.messageCount++;
  context.lastMessage = event.text || '';
  context.lastMessageTime = ctx.now().iso;

  userState.set('context', context);

  ctx.log.info(\`Message from \${userId}: "\${event.text}"\`);
  ctx.log.info(\`This is message #\${context.messageCount} from this user\`);

  // Generate response based on context
  const response = await generateResponse(event.text || '', context, ctx);

  // Return response (will be sent back to Slack)
  return { text: response };
});

async function generateResponse(
  message: string,
  context: UserContext,
  ctx: any
): Promise<string> {
  // Simple example - replace with LLM call for real agents

  if (message.toLowerCase().includes('hello')) {
    if (context.messageCount === 1) {
      return "Hello! Nice to meet you!";
    } else {
      return \`Hello again! This is our \${context.messageCount}th conversation.\`;
    }
  }

  if (message.toLowerCase().includes('remember')) {
    if (context.lastMessage) {
      return \`Your last message was: "\${context.lastMessage}" at \${context.lastMessageTime}\`;
    } else {
      return "I don't have any previous messages from you yet.";
    }
  }

  return \`Got it! You said: "\${message}". I'll remember this.\`;
}

agent.start();

console.log(\`
Slack Bot Ready!

To connect to Slack:
1. Create a Slack App at https://api.slack.com/apps
2. Enable Socket Mode
3. Add to your Agentiom dashboard
4. Deploy: bun run deploy
\`);
`,
    'package.json': `{
  "name": "{{name}}",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "start": "bun run src/index.ts",
    "deploy": "agentiom deploy"
  },
  "dependencies": {
    "@agentiom/sdk": "^0.1.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.0.0"
  }
}
`,
    'agentiom.json': `{
  "name": "{{name}}",
  "triggers": {
    "slack": true
  },
  "sleep": {
    "idleTimeout": "5m"
  }
}
`,
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
`,
    '.gitignore': `node_modules
dist
.env
.env.local
state/
*.log
`,
    '.env.example': `# Slack credentials (add via Agentiom dashboard, not here)
# SLACK_APP_TOKEN=xapp-...
# SLACK_BOT_TOKEN=xoxb-...
`,
    'README.md': `# {{name}}

A Slack bot with conversation memory.

## Features

- Remembers conversation context per user
- Persists state between sleep/wake cycles
- Easy Slack integration via Agentiom Socket Proxy

## Getting Started

\`\`\`bash
bun install
bun run dev
\`\`\`

## Connecting to Slack

1. Create a Slack App at https://api.slack.com/apps
2. Enable Socket Mode (Settings > Socket Mode)
3. Add event subscriptions (Event Subscriptions > Subscribe to bot events):
   - \`message.channels\`
   - \`message.im\`
   - \`app_mention\`
4. Install to your workspace
5. Add the Slack integration in your Agentiom dashboard
6. Deploy: \`bun run deploy\`

## How it works

Messages flow like this:
1. User sends message in Slack
2. Agentiom Socket Proxy receives it
3. Your sleeping agent wakes up
4. Agent processes message with full context
5. Agent returns response
6. Socket Proxy sends response to Slack
7. Agent goes back to sleep
`,
  },

  'discord-bot': {
    'src/index.ts': `import { Agent, DiscordEvent } from '@agentiom/sdk';

const agent = new Agent({ name: '{{name}}' });

// Server/guild context
interface ServerContext {
  memberCount: number;
  messageCount: number;
  lastActive: string;
}

agent.on('discord', async (event: DiscordEvent, ctx) => {
  const guildId = event.guildId || 'dm';
  const userId = event.author?.id || 'unknown';

  // Track per-server stats
  const serverState = ctx.state.scope(\`servers.\${guildId}\`);
  serverState.increment('messageCount');
  serverState.set('lastActive', ctx.now().iso);

  // Track per-user in server
  const userState = ctx.state.scope(\`servers.\${guildId}.users.\${userId}\`);
  userState.increment('messageCount');
  userState.set('lastMessage', event.content);
  userState.set('lastMessageTime', ctx.now().iso);

  ctx.log.info(\`[\${guildId}] \${event.author?.username}: \${event.content}\`);

  // Command handling
  const content = event.content || '';

  if (content.startsWith('!stats')) {
    const serverMessages = serverState.get('messageCount') || 0;
    const userMessages = userState.get('messageCount') || 0;

    return {
      content: \`**Stats**\\n\\nServer messages: \${serverMessages}\\nYour messages: \${userMessages}\`,
    };
  }

  if (content.startsWith('!ping')) {
    return { content: 'Pong!' };
  }

  if (content.startsWith('!help')) {
    return {
      content: \`**Available Commands**\\n\\n\` +
        \`\\\`!stats\\\` - View message statistics\\n\` +
        \`\\\`!ping\\\` - Check if bot is alive\\n\` +
        \`\\\`!help\\\` - Show this message\`,
    };
  }

  // No response for regular messages
  return null;
});

agent.start();

console.log(\`
Discord Bot Ready!

To connect to Discord:
1. Create a Discord App at https://discord.com/developers
2. Add a Bot and copy the token
3. Enable Message Content Intent
4. Add to your Agentiom dashboard
5. Deploy: bun run deploy
\`);
`,
    'package.json': `{
  "name": "{{name}}",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "start": "bun run src/index.ts",
    "deploy": "agentiom deploy"
  },
  "dependencies": {
    "@agentiom/sdk": "^0.1.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.0.0"
  }
}
`,
    'agentiom.json': `{
  "name": "{{name}}",
  "triggers": {
    "discord": true
  },
  "sleep": {
    "idleTimeout": "5m"
  }
}
`,
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
`,
    '.gitignore': `node_modules
dist
.env
.env.local
state/
*.log
`,
    'README.md': `# {{name}}

A Discord bot with persistent state.

## Getting Started

\`\`\`bash
bun install
bun run dev
\`\`\`

## Connecting to Discord

1. Create a Discord Application at https://discord.com/developers
2. Add a Bot (Bot > Add Bot)
3. Enable Message Content Intent (Bot > Privileged Gateway Intents)
4. Copy the bot token
5. Generate OAuth2 URL (OAuth2 > URL Generator):
   - Scopes: \`bot\`
   - Permissions: \`Send Messages\`, \`Read Message History\`
6. Invite bot to your server
7. Add Discord integration in Agentiom dashboard
8. Deploy: \`bun run deploy\`

## Commands

- \`!stats\` - View message statistics
- \`!ping\` - Check if bot is alive
- \`!help\` - Show help message
`,
  },

  'cron-agent': {
    'src/index.ts': `import { Agent, CronEvent } from '@agentiom/sdk';

const agent = new Agent({ name: '{{name}}' });

// Track cron run history
interface RunHistory {
  timestamp: string;
  success: boolean;
  duration: number;
  result?: any;
  error?: string;
}

agent.on('cron', async (event: CronEvent, ctx) => {
  const startTime = Date.now();
  ctx.log.info(\`Cron triggered at \${event.scheduledTime.toISOString()}\`);

  try {
    // Your scheduled task here
    const result = await runScheduledTask(ctx);

    const duration = Date.now() - startTime;

    // Record success
    const history: RunHistory = {
      timestamp: ctx.now().iso,
      success: true,
      duration,
      result,
    };
    ctx.state.push('runHistory', history);

    // Keep only last 100 runs
    const allHistory = ctx.state.get<RunHistory[]>('runHistory') || [];
    if (allHistory.length > 100) {
      ctx.state.set('runHistory', allHistory.slice(-100));
    }

    ctx.state.increment('successCount');
    ctx.log.info(\`Task completed in \${duration}ms\`);

    return { success: true, duration, result };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Record failure
    const history: RunHistory = {
      timestamp: ctx.now().iso,
      success: false,
      duration,
      error: errorMessage,
    };
    ctx.state.push('runHistory', history);
    ctx.state.increment('failureCount');

    ctx.log.error(\`Task failed: \${errorMessage}\`);

    return { success: false, duration, error: errorMessage };
  }
});

async function runScheduledTask(ctx: any): Promise<any> {
  // Example: Fetch data and store it
  ctx.log.info('Fetching external data...');

  // Simulate some work
  await ctx.sleep(100);

  // Store the result
  const data = {
    fetchedAt: ctx.now().iso,
    value: Math.random() * 100,
  };

  ctx.state.set('latestData', data);

  return data;
}

// Also handle webhook for checking status
agent.on('webhook', async (event, ctx) => {
  const successCount = ctx.state.get('successCount') || 0;
  const failureCount = ctx.state.get('failureCount') || 0;
  const history = ctx.state.get<RunHistory[]>('runHistory') || [];
  const latestData = ctx.state.get('latestData');

  return {
    status: 'ok',
    stats: {
      totalRuns: successCount + failureCount,
      successCount,
      failureCount,
      successRate: successCount / (successCount + failureCount) || 0,
    },
    lastRun: history[history.length - 1] || null,
    latestData,
  };
});

agent.start();

console.log(\`
Cron Agent Ready!

This agent will run on a schedule. Configure the schedule in agentiom.json.

To check status:
  curl http://localhost:3000/webhook
\`);
`,
    'package.json': `{
  "name": "{{name}}",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "start": "bun run src/index.ts",
    "deploy": "agentiom deploy"
  },
  "dependencies": {
    "@agentiom/sdk": "^0.1.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.0.0"
  }
}
`,
    'agentiom.json': `{
  "name": "{{name}}",
  "triggers": {
    "webhook": true,
    "cron": "0 9 * * *"
  },
  "sleep": {
    "idleTimeout": "1m"
  }
}
`,
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
`,
    '.gitignore': `node_modules
dist
.env
.env.local
state/
*.log
`,
    'README.md': `# {{name}}

A cron/scheduled agent that runs tasks on a schedule.

## Schedule

The default schedule is \`0 9 * * *\` (9 AM daily). Edit \`agentiom.json\` to change.

Common cron expressions:
- \`0 * * * *\` - Every hour
- \`0 9 * * *\` - 9 AM daily
- \`0 9 * * 1\` - 9 AM every Monday
- \`*/5 * * * *\` - Every 5 minutes

## Getting Started

\`\`\`bash
bun install
bun run dev
\`\`\`

## Check Status

\`\`\`bash
curl http://localhost:3000/webhook
\`\`\`

## Deployment

\`\`\`bash
bun run deploy
\`\`\`
`,
  },
};

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log(`
${colors.cyan}create-agentiom-agent${colors.reset}
Build stateful agents that sleep

`);

  // Get project name from args or prompt
  let projectName = process.argv[2];
  if (!projectName || projectName.startsWith('-')) {
    projectName = await prompt('Project name: ');
  }

  if (!projectName) {
    console.error('Project name is required');
    process.exit(1);
  }

  // Validate project name
  const validName = projectName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (validName !== projectName) {
    log(`Using "${validName}" as project name`);
    projectName = validName;
  }

  // Check if directory exists
  const projectPath = join(process.cwd(), projectName);
  if (existsSync(projectPath)) {
    console.error(`Directory "${projectName}" already exists`);
    process.exit(1);
  }

  // Get template from args or prompt
  let templateArg = process.argv.find(arg => arg.startsWith('--template='));
  let template = templateArg?.split('=')[1];

  if (!template) {
    console.log('\nPick a template:\n');
    const templateKeys = Object.keys(TEMPLATES);
    templateKeys.forEach((key, i) => {
      const t = TEMPLATES[key as keyof typeof TEMPLATES];
      console.log(`  ${colors.cyan}${i + 1}.${colors.reset} ${t.name}`);
      console.log(`     ${colors.dim}${t.description}${colors.reset}`);
    });

    const answer = await prompt('\nEnter number (1): ');
    const index = parseInt(answer, 10) - 1;
    template = templateKeys[index >= 0 && index < templateKeys.length ? index : 0];
  }

  if (!TEMPLATE_FILES[template]) {
    console.error(`Unknown template: ${template}`);
    process.exit(1);
  }

  // Create project
  log('');
  info(`Creating ${projectName} with template "${template}"...`);

  await mkdir(projectPath, { recursive: true });
  await mkdir(join(projectPath, 'src'), { recursive: true });

  // Write template files
  const files = TEMPLATE_FILES[template];
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = join(projectPath, filePath);
    const dir = dirname(fullPath);

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    // Replace placeholders
    const processedContent = content
      .replace(/\{\{name\}\}/g, projectName);

    await writeFile(fullPath, processedContent);
    success(`Created ${filePath}`);
  }

  // Done!
  console.log(`
${colors.green}Created ${projectName}!${colors.reset}

Next steps:

  ${colors.cyan}cd ${projectName}${colors.reset}
  ${colors.cyan}bun install${colors.reset}
  ${colors.cyan}bun run dev${colors.reset}

Then deploy:

  ${colors.cyan}bun run deploy${colors.reset}

${colors.dim}Learn more: https://docs.agentiom.dev${colors.reset}
`);

  rl.close();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
