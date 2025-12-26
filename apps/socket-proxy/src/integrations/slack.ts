/**
 * Slack Integration
 *
 * Uses Slack's Socket Mode to maintain a persistent connection
 * and receive events in real-time without needing a public endpoint.
 *
 * Requirements:
 * - Slack App with Socket Mode enabled
 * - App-level token (xapp-...)
 * - Bot token (xoxb-...)
 *
 * Events supported:
 * - message: Direct messages and channel messages where bot is mentioned
 * - app_mention: @mentions of the bot
 * - app_home_opened: User opens the app home tab
 * - reaction_added/removed: Emoji reactions
 * - And any other events subscribed in the Slack app config
 */

import { SocketModeClient } from '@slack/socket-mode';
import { WebClient } from '@slack/web-api';
import { createLogger } from '@agentiom/shared';
import { BasePlatformIntegration, type IntegrationConfig } from '../services/types';
import type { EventRouter, PlatformEvent } from '../services/event-router';

const log = createLogger('slack-integration');

export class SlackIntegration extends BasePlatformIntegration {
  private socketClient: SocketModeClient | null = null;
  private webClient: WebClient | null = null;
  private eventRouter: EventRouter;

  constructor(config: IntegrationConfig, eventRouter: EventRouter) {
    super(config);
    this.eventRouter = eventRouter;
  }

  async connect(): Promise<void> {
    if (!this.config.slackAppToken) {
      throw new Error('Slack App Token (xapp-...) is required for Socket Mode');
    }

    if (!this.config.slackBotToken) {
      throw new Error('Slack Bot Token (xoxb-...) is required');
    }

    this.updateState({ status: 'connecting' });

    log.info({ integrationId: this.config.id }, 'Connecting to Slack');

    // Initialize clients
    this.socketClient = new SocketModeClient({
      appToken: this.config.slackAppToken,
      // Auto-reconnect is handled by the library
    });

    this.webClient = new WebClient(this.config.slackBotToken);

    // Set up event handlers
    this.setupEventHandlers();

    // Connect
    try {
      await this.socketClient.start();

      this.updateState({
        status: 'connected',
        connectedAt: new Date(),
        retryCount: 0,
      });

      this.emit('connected');
      log.info({ integrationId: this.config.id }, 'Connected to Slack');

    } catch (error) {
      this.updateState({
        status: 'error',
        statusMessage: error instanceof Error ? error.message : 'Connection failed',
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    log.info({ integrationId: this.config.id }, 'Disconnecting from Slack');

    if (this.socketClient) {
      await this.socketClient.disconnect();
      this.socketClient = null;
    }

    this.webClient = null;

    this.updateState({
      status: 'disconnected',
    });

    this.emit('disconnected', 'Manual disconnect');
  }

  /**
   * Send a message back to Slack
   */
  async sendMessage(channel: string, text: string, threadTs?: string): Promise<void> {
    if (!this.webClient) {
      throw new Error('Not connected to Slack');
    }

    await this.webClient.chat.postMessage({
      channel,
      text,
      thread_ts: threadTs,
    });
  }

  private setupEventHandlers(): void {
    if (!this.socketClient) return;

    // Handle all message events
    this.socketClient.on('message', async ({ event, ack }) => {
      await ack();
      await this.handleSlackEvent('message', event);
    });

    // Handle app mentions
    this.socketClient.on('app_mention', async ({ event, ack }) => {
      await ack();
      await this.handleSlackEvent('app_mention', event);
    });

    // Handle app home opened
    this.socketClient.on('app_home_opened', async ({ event, ack }) => {
      await ack();
      await this.handleSlackEvent('app_home_opened', event);
    });

    // Handle reactions
    this.socketClient.on('reaction_added', async ({ event, ack }) => {
      await ack();
      await this.handleSlackEvent('reaction_added', event);
    });

    this.socketClient.on('reaction_removed', async ({ event, ack }) => {
      await ack();
      await this.handleSlackEvent('reaction_removed', event);
    });

    // Handle slash commands
    this.socketClient.on('slash_commands', async ({ command, ack }) => {
      // Acknowledge immediately
      await ack();
      await this.handleSlackEvent('slash_command', command);
    });

    // Handle interactive elements (buttons, modals, etc.)
    this.socketClient.on('interactive', async ({ payload, ack }) => {
      await ack();
      await this.handleSlackEvent('interactive', payload);
    });

    // Handle connection events
    this.socketClient.on('connected', () => {
      log.debug({ integrationId: this.config.id }, 'Socket connected');
    });

    this.socketClient.on('disconnected', () => {
      log.warn({ integrationId: this.config.id }, 'Socket disconnected');
      this.updateState({ status: 'disconnected' });
      this.emit('disconnected', 'Socket disconnected');
    });

    this.socketClient.on('error', (error) => {
      log.error({ integrationId: this.config.id, error }, 'Socket error');
      this.emit('error', error);
    });

    this.socketClient.on('reconnecting', () => {
      log.info({ integrationId: this.config.id }, 'Socket reconnecting');
      this.updateState({
        status: 'connecting',
        retryCount: this.state.retryCount + 1,
      });
    });
  }

  private async handleSlackEvent(type: string, event: any): Promise<void> {
    // Check event filter
    if (this.config.eventFilter && !this.config.eventFilter.includes(type)) {
      log.debug({ type }, 'Event filtered out');
      return;
    }

    // Skip bot's own messages
    if (event.bot_id) {
      return;
    }

    this.updateState({
      eventsReceived: this.state.eventsReceived + 1,
      lastEventAt: new Date(),
    });

    this.emit('event', { type, event });

    // Build platform event
    const platformEvent: PlatformEvent = {
      integrationId: this.config.id,
      agentId: this.config.agentId,
      platform: 'slack',
      type,
      timestamp: new Date(parseFloat(event.ts || event.event_ts) * 1000 || Date.now()),
      payload: event,
      respondTo: event.channel,
      replyToken: event.thread_ts || event.ts,
    };

    // Route to agent
    try {
      const result = await this.eventRouter.routeEvent(platformEvent);

      if (result.success) {
        this.updateState({
          eventsDelivered: this.state.eventsDelivered + 1,
        });

        // If agent returned a response, send it back
        if (result.response?.text) {
          await this.sendMessage(
            event.channel,
            result.response.text,
            event.thread_ts || event.ts
          );
        }
      } else {
        this.updateState({
          eventsFailed: this.state.eventsFailed + 1,
        });
      }
    } catch (error) {
      log.error({ error, type }, 'Failed to route Slack event');
      this.updateState({
        eventsFailed: this.state.eventsFailed + 1,
      });
    }
  }
}
