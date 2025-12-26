/**
 * Agentiom SDK - Agent Class
 *
 * The main class for building stateful agents.
 * Handles event routing, state persistence, and lifecycle.
 *
 * @example
 * ```ts
 * import { Agent } from '@agentiom/sdk';
 *
 * const agent = new Agent();
 *
 * agent.on('webhook', async (event, ctx) => {
 *   const count = ctx.state.get('count') || 0;
 *   ctx.state.set('count', count + 1);
 *   return { message: `Hello! Count: ${count + 1}` };
 * });
 *
 * agent.start();
 * ```
 */

import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { StateManager } from './state';
import { AgentContext } from './context';
import type {
  AgentConfig,
  EventHandler,
  WebhookEvent,
  CronEvent,
  SlackEvent,
  DiscordEvent,
  TelegramEvent,
  EmailEvent,
  StartupHandler,
  ShutdownHandler,
} from './types';

export class Agent {
  private app: Hono;
  private state: StateManager;
  private config: AgentConfig;

  // Event handlers
  private webhookHandler?: EventHandler<WebhookEvent>;
  private cronHandler?: EventHandler<CronEvent>;
  private slackHandler?: EventHandler<SlackEvent>;
  private discordHandler?: EventHandler<DiscordEvent>;
  private telegramHandler?: EventHandler<TelegramEvent>;
  private emailHandler?: EventHandler<EmailEvent>;

  // Lifecycle handlers
  private startupHandlers: StartupHandler[] = [];
  private shutdownHandlers: ShutdownHandler[] = [];

  constructor(config: Partial<AgentConfig> = {}) {
    this.config = {
      name: config.name || process.env.AGENTIOM_AGENT_NAME || 'agent',
      port: config.port || parseInt(process.env.PORT || '3000', 10),
      statePath: config.statePath || process.env.AGENTIOM_STATE_PATH || './state',
      logLevel: config.logLevel || 'info',
      ...config,
    };

    this.app = new Hono();
    this.state = new StateManager(this.config.statePath);

    this.setupRoutes();
  }

  // ===========================================================================
  // Event Registration
  // ===========================================================================

  /**
   * Handle incoming webhook requests
   */
  on(event: 'webhook', handler: EventHandler<WebhookEvent>): this;

  /**
   * Handle cron/scheduled triggers
   */
  on(event: 'cron', handler: EventHandler<CronEvent>): this;

  /**
   * Handle Slack messages and events
   */
  on(event: 'slack', handler: EventHandler<SlackEvent>): this;

  /**
   * Handle Discord messages and events
   */
  on(event: 'discord', handler: EventHandler<DiscordEvent>): this;

  /**
   * Handle Telegram messages and events
   */
  on(event: 'telegram', handler: EventHandler<TelegramEvent>): this;

  /**
   * Handle incoming emails
   */
  on(event: 'email', handler: EventHandler<EmailEvent>): this;

  on(event: string, handler: EventHandler<any>): this {
    switch (event) {
      case 'webhook':
        this.webhookHandler = handler;
        break;
      case 'cron':
        this.cronHandler = handler;
        break;
      case 'slack':
        this.slackHandler = handler;
        break;
      case 'discord':
        this.discordHandler = handler;
        break;
      case 'telegram':
        this.telegramHandler = handler;
        break;
      case 'email':
        this.emailHandler = handler;
        break;
      default:
        console.warn(`Unknown event type: ${event}`);
    }
    return this;
  }

  /**
   * Run code when the agent starts
   */
  onStartup(handler: StartupHandler): this {
    this.startupHandlers.push(handler);
    return this;
  }

  /**
   * Run code when the agent shuts down (before sleeping)
   */
  onShutdown(handler: ShutdownHandler): this {
    this.shutdownHandlers.push(handler);
    return this;
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Start the agent server
   */
  async start(): Promise<void> {
    // Initialize state
    await this.state.load();

    // Run startup handlers
    const ctx = this.createContext();
    for (const handler of this.startupHandlers) {
      await handler(ctx);
    }

    // Start server
    const server = Bun.serve({
      port: this.config.port,
      fetch: this.app.fetch,
    });

    console.log(`🤖 Agent "${this.config.name}" running on port ${this.config.port}`);
    console.log(`   Webhook: http://localhost:${this.config.port}/webhook`);
    console.log(`   Health:  http://localhost:${this.config.port}/health`);

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log('\n🛑 Shutting down...');

      // Run shutdown handlers
      for (const handler of this.shutdownHandlers) {
        await handler(ctx);
      }

      // Save state
      await this.state.save();

      console.log('💤 Agent saved state and is ready to sleep');
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  // ===========================================================================
  // Route Setup
  // ===========================================================================

  private setupRoutes(): void {
    // Logging
    if (this.config.logLevel !== 'silent') {
      this.app.use('*', logger());
    }

    // Health check
    this.app.get('/health', (c) => {
      return c.json({
        status: 'ok',
        agent: this.config.name,
        uptime: process.uptime(),
      });
    });

    // Activity endpoint (for Agentiom to track activity)
    this.app.post('/activity', async (c) => {
      await this.state.save();
      return c.json({ ok: true });
    });

    // Main webhook endpoint
    this.app.post('/webhook', async (c) => {
      return this.handleEvent(c, 'webhook');
    });

    // Platform-specific endpoints (used by socket proxy)
    this.app.post('/slack', async (c) => {
      return this.handleEvent(c, 'slack');
    });

    this.app.post('/discord', async (c) => {
      return this.handleEvent(c, 'discord');
    });

    this.app.post('/telegram', async (c) => {
      return this.handleEvent(c, 'telegram');
    });

    this.app.post('/email', async (c) => {
      return this.handleEvent(c, 'email');
    });

    this.app.post('/cron', async (c) => {
      return this.handleEvent(c, 'cron');
    });

    // Generic event endpoint (socket proxy uses this)
    this.app.post('/event', async (c) => {
      const body = await c.req.json();
      const eventType = body.type || c.req.header('X-Agentiom-Event-Type') || 'webhook';
      return this.handleEvent(c, eventType, body);
    });
  }

  private async handleEvent(
    c: any,
    eventType: string,
    providedBody?: any
  ): Promise<Response> {
    const startTime = Date.now();

    try {
      const body = providedBody || await c.req.json().catch(() => ({}));
      const ctx = this.createContext();

      let handler: EventHandler<any> | undefined;
      let event: any;

      switch (eventType) {
        case 'webhook':
          handler = this.webhookHandler;
          event = this.parseWebhookEvent(c, body);
          break;
        case 'cron':
          handler = this.cronHandler;
          event = this.parseCronEvent(body);
          break;
        case 'slack':
          handler = this.slackHandler || this.webhookHandler;
          event = this.parseSlackEvent(body);
          break;
        case 'discord':
          handler = this.discordHandler || this.webhookHandler;
          event = this.parseDiscordEvent(body);
          break;
        case 'telegram':
          handler = this.telegramHandler || this.webhookHandler;
          event = this.parseTelegramEvent(body);
          break;
        case 'email':
          handler = this.emailHandler || this.webhookHandler;
          event = this.parseEmailEvent(body);
          break;
        default:
          handler = this.webhookHandler;
          event = { type: eventType, data: body };
      }

      if (!handler) {
        return c.json({ error: `No handler for event type: ${eventType}` }, 400);
      }

      // Execute handler
      const result = await handler(event, ctx);

      // Save state after handling
      await this.state.save();

      const latency = Date.now() - startTime;

      return c.json({
        ok: true,
        latency,
        ...result,
      });

    } catch (error) {
      console.error('Event handler error:', error);
      return c.json({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  // ===========================================================================
  // Context & Event Parsing
  // ===========================================================================

  private createContext(): AgentContext {
    return new AgentContext(this.state, this.config);
  }

  private parseWebhookEvent(c: any, body: any): WebhookEvent {
    return {
      type: 'webhook',
      method: c.req.method,
      path: c.req.path,
      headers: Object.fromEntries(c.req.raw.headers),
      query: Object.fromEntries(new URL(c.req.url).searchParams),
      body,
      timestamp: new Date(),
    };
  }

  private parseCronEvent(body: any): CronEvent {
    return {
      type: 'cron',
      schedule: body.schedule || body.cronExpression,
      scheduledTime: body.scheduledTime ? new Date(body.scheduledTime) : new Date(),
      timestamp: new Date(),
    };
  }

  private parseSlackEvent(body: any): SlackEvent {
    const payload = body.payload || body;
    return {
      type: 'slack',
      eventType: payload.type || 'message',
      channel: payload.channel,
      user: payload.user,
      text: payload.text,
      threadTs: payload.thread_ts,
      ts: payload.ts,
      raw: payload,
      timestamp: new Date(),
    };
  }

  private parseDiscordEvent(body: any): DiscordEvent {
    const payload = body.payload || body;
    return {
      type: 'discord',
      eventType: payload.type || body.type || 'messageCreate',
      channelId: payload.channelId,
      guildId: payload.guildId,
      author: payload.author,
      content: payload.content,
      messageId: payload.id,
      raw: payload,
      timestamp: new Date(),
    };
  }

  private parseTelegramEvent(body: any): TelegramEvent {
    const payload = body.payload || body;
    const message = payload.message || payload;
    return {
      type: 'telegram',
      eventType: body.type || 'message',
      chatId: message.chat?.id,
      from: message.from,
      text: message.text,
      messageId: message.message_id,
      raw: payload,
      timestamp: new Date(),
    };
  }

  private parseEmailEvent(body: any): EmailEvent {
    return {
      type: 'email',
      from: body.from,
      to: body.to,
      subject: body.subject,
      text: body.text,
      html: body.html,
      attachments: body.attachments,
      raw: body,
      timestamp: new Date(),
    };
  }

  // ===========================================================================
  // Direct Access (Advanced)
  // ===========================================================================

  /**
   * Get the underlying Hono app for custom routes
   */
  getApp(): Hono {
    return this.app;
  }

  /**
   * Get the state manager for direct access
   */
  getState(): StateManager {
    return this.state;
  }
}
