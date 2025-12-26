/**
 * Telegram Integration
 *
 * Uses grammY library for Telegram Bot API.
 * Supports both long-polling and webhook modes.
 *
 * For agents that sleep, webhook mode is preferred as the socket proxy
 * will receive webhooks and wake the agent as needed.
 *
 * Requirements:
 * - Telegram Bot Token from @BotFather
 *
 * Events supported:
 * - message: Text messages, photos, documents, etc.
 * - callback_query: Inline button presses
 * - inline_query: Inline mode queries
 * - And more based on Telegram Bot API
 */

import { Bot, webhookCallback } from 'grammy';
import { createLogger } from '@agentiom/shared';
import { BasePlatformIntegration, type IntegrationConfig } from '../services/types';
import type { EventRouter, PlatformEvent } from '../services/event-router';

const log = createLogger('telegram-integration');

export class TelegramIntegration extends BasePlatformIntegration {
  private bot: Bot | null = null;
  private eventRouter: EventRouter;
  private isPolling: boolean = false;

  constructor(config: IntegrationConfig, eventRouter: EventRouter) {
    super(config);
    this.eventRouter = eventRouter;
  }

  async connect(): Promise<void> {
    if (!this.config.telegramBotToken) {
      throw new Error('Telegram Bot Token is required');
    }

    this.updateState({ status: 'connecting' });

    log.info({ integrationId: this.config.id }, 'Connecting to Telegram');

    // Initialize bot
    this.bot = new Bot(this.config.telegramBotToken);

    // Set up event handlers
    this.setupEventHandlers();

    try {
      // Get bot info to verify token
      const me = await this.bot.api.getMe();

      log.info({
        integrationId: this.config.id,
        botUsername: me.username,
      }, 'Bot authenticated');

      // Start long-polling mode
      // In production, you'd use webhook mode with handleWebhook()
      this.isPolling = true;
      this.bot.start({
        onStart: () => {
          log.info({ integrationId: this.config.id }, 'Polling started');
        },
      });

      this.updateState({
        status: 'connected',
        connectedAt: new Date(),
        retryCount: 0,
      });

      this.emit('connected');

    } catch (error) {
      this.updateState({
        status: 'error',
        statusMessage: error instanceof Error ? error.message : 'Connection failed',
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    log.info({ integrationId: this.config.id }, 'Disconnecting from Telegram');

    if (this.bot && this.isPolling) {
      await this.bot.stop();
      this.isPolling = false;
    }

    this.bot = null;

    this.updateState({
      status: 'disconnected',
    });

    this.emit('disconnected', 'Manual disconnect');
  }

  /**
   * Handle incoming webhook update from Telegram
   * Used when running in webhook mode instead of polling
   */
  async handleWebhook(update: any): Promise<void> {
    if (!this.bot) {
      throw new Error('Bot not initialized');
    }

    // Process the update through grammY
    const handler = webhookCallback(this.bot, 'std/http');

    // Create a mock request/response for the webhook handler
    const mockRequest = new Request('http://localhost/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });

    await handler(mockRequest);
  }

  /**
   * Send a message to a Telegram chat
   */
  async sendMessage(chatId: number | string, text: string, replyToMessageId?: number): Promise<void> {
    if (!this.bot) {
      throw new Error('Not connected to Telegram');
    }

    await this.bot.api.sendMessage(chatId, text, {
      reply_to_message_id: replyToMessageId,
    });
  }

  private setupEventHandlers(): void {
    if (!this.bot) return;

    // Handle all messages
    this.bot.on('message', async (ctx) => {
      await this.handleTelegramEvent('message', {
        message_id: ctx.message.message_id,
        chat: ctx.message.chat,
        from: ctx.message.from,
        text: ctx.message.text,
        photo: ctx.message.photo,
        document: ctx.message.document,
        date: ctx.message.date,
      });
    });

    // Handle callback queries (inline button presses)
    this.bot.on('callback_query', async (ctx) => {
      await this.handleTelegramEvent('callback_query', {
        id: ctx.callbackQuery.id,
        from: ctx.callbackQuery.from,
        data: ctx.callbackQuery.data,
        message: ctx.callbackQuery.message,
      });

      // Acknowledge the callback
      await ctx.answerCallbackQuery();
    });

    // Handle inline queries
    this.bot.on('inline_query', async (ctx) => {
      await this.handleTelegramEvent('inline_query', {
        id: ctx.inlineQuery.id,
        from: ctx.inlineQuery.from,
        query: ctx.inlineQuery.query,
      });
    });

    // Handle edited messages
    this.bot.on('edited_message', async (ctx) => {
      await this.handleTelegramEvent('edited_message', {
        message_id: ctx.editedMessage.message_id,
        chat: ctx.editedMessage.chat,
        from: ctx.editedMessage.from,
        text: ctx.editedMessage.text,
        edit_date: ctx.editedMessage.edit_date,
      });
    });

    // Handle channel posts
    this.bot.on('channel_post', async (ctx) => {
      await this.handleTelegramEvent('channel_post', {
        message_id: ctx.channelPost.message_id,
        chat: ctx.channelPost.chat,
        text: ctx.channelPost.text,
        date: ctx.channelPost.date,
      });
    });

    // Handle new chat members
    this.bot.on('message:new_chat_members', async (ctx) => {
      await this.handleTelegramEvent('new_chat_members', {
        chat: ctx.message.chat,
        new_members: ctx.message.new_chat_members,
      });
    });

    // Handle left chat member
    this.bot.on('message:left_chat_member', async (ctx) => {
      await this.handleTelegramEvent('left_chat_member', {
        chat: ctx.message.chat,
        left_member: ctx.message.left_chat_member,
      });
    });

    // Handle errors
    this.bot.catch((error) => {
      log.error({ integrationId: this.config.id, error }, 'Telegram bot error');
      this.emit('error', error.error);
    });
  }

  private async handleTelegramEvent(type: string, event: any): Promise<void> {
    // Check event filter
    if (this.config.eventFilter && !this.config.eventFilter.includes(type)) {
      log.debug({ type }, 'Event filtered out');
      return;
    }

    this.updateState({
      eventsReceived: this.state.eventsReceived + 1,
      lastEventAt: new Date(),
    });

    this.emit('event', { type, event });

    // Build platform event
    const chatId = event.chat?.id || event.from?.id;

    const platformEvent: PlatformEvent = {
      integrationId: this.config.id,
      agentId: this.config.agentId,
      platform: 'telegram',
      type,
      timestamp: new Date((event.date || event.edit_date || Math.floor(Date.now() / 1000)) * 1000),
      payload: event,
      respondTo: String(chatId),
      replyToken: String(event.message_id),
    };

    // Route to agent
    try {
      const result = await this.eventRouter.routeEvent(platformEvent);

      if (result.success) {
        this.updateState({
          eventsDelivered: this.state.eventsDelivered + 1,
        });

        // If agent returned a response, send it back
        if (result.response?.text && chatId) {
          await this.sendMessage(
            chatId,
            result.response.text,
            event.message_id
          );
        }
      } else {
        this.updateState({
          eventsFailed: this.state.eventsFailed + 1,
        });
      }
    } catch (error) {
      log.error({ error, type }, 'Failed to route Telegram event');
      this.updateState({
        eventsFailed: this.state.eventsFailed + 1,
      });
    }
  }
}
