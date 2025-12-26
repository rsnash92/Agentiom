/**
 * Discord Integration
 *
 * Uses Discord.js to maintain a persistent gateway connection
 * and receive events in real-time.
 *
 * Requirements:
 * - Discord Bot Token
 * - Bot needs appropriate intents enabled in Discord Developer Portal
 *
 * Events supported:
 * - messageCreate: New messages in channels the bot can see
 * - interactionCreate: Slash commands, buttons, modals
 * - guildMemberAdd/Remove: Member join/leave
 * - And many more based on intents
 */

import {
  Client,
  GatewayIntentBits,
  Partials,
  type Message,
  type Interaction,
} from 'discord.js';
import { createLogger } from '@agentiom/shared';
import { BasePlatformIntegration, type IntegrationConfig } from '../services/types';
import type { EventRouter, PlatformEvent } from '../services/event-router';

const log = createLogger('discord-integration');

export class DiscordIntegration extends BasePlatformIntegration {
  private client: Client | null = null;
  private eventRouter: EventRouter;

  constructor(config: IntegrationConfig, eventRouter: EventRouter) {
    super(config);
    this.eventRouter = eventRouter;
  }

  async connect(): Promise<void> {
    if (!this.config.discordBotToken) {
      throw new Error('Discord Bot Token is required');
    }

    this.updateState({ status: 'connecting' });

    log.info({ integrationId: this.config.id }, 'Connecting to Discord');

    // Initialize client with appropriate intents
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.MessageContent, // Requires privileged intent
      ],
      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
      ],
    });

    // Set up event handlers
    this.setupEventHandlers();

    // Connect
    try {
      await this.client.login(this.config.discordBotToken);

      // Wait for ready event
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Discord connection timeout'));
        }, 30000);

        this.client!.once('ready', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.client!.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      this.updateState({
        status: 'connected',
        connectedAt: new Date(),
        retryCount: 0,
      });

      this.emit('connected');
      log.info({
        integrationId: this.config.id,
        username: this.client.user?.tag,
      }, 'Connected to Discord');

    } catch (error) {
      this.updateState({
        status: 'error',
        statusMessage: error instanceof Error ? error.message : 'Connection failed',
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    log.info({ integrationId: this.config.id }, 'Disconnecting from Discord');

    if (this.client) {
      await this.client.destroy();
      this.client = null;
    }

    this.updateState({
      status: 'disconnected',
    });

    this.emit('disconnected', 'Manual disconnect');
  }

  /**
   * Send a message to a Discord channel
   */
  async sendMessage(channelId: string, content: string): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to Discord');
    }

    const channel = await this.client.channels.fetch(channelId);
    if (channel && 'send' in channel) {
      await channel.send(content);
    }
  }

  /**
   * Reply to a message
   */
  async replyToMessage(channelId: string, messageId: string, content: string): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to Discord');
    }

    const channel = await this.client.channels.fetch(channelId);
    if (channel && 'messages' in channel) {
      const message = await channel.messages.fetch(messageId);
      await message.reply(content);
    }
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    // Handle new messages
    this.client.on('messageCreate', async (message: Message) => {
      // Skip bot's own messages
      if (message.author.bot) return;

      // If guild filter is set, only process messages from that guild
      if (this.config.discordGuildId && message.guildId !== this.config.discordGuildId) {
        return;
      }

      await this.handleDiscordEvent('messageCreate', {
        id: message.id,
        content: message.content,
        channelId: message.channelId,
        guildId: message.guildId,
        author: {
          id: message.author.id,
          username: message.author.username,
          discriminator: message.author.discriminator,
        },
        mentions: message.mentions.users.map(u => ({
          id: u.id,
          username: u.username,
        })),
        timestamp: message.createdTimestamp,
      });
    });

    // Handle interactions (slash commands, buttons, etc.)
    this.client.on('interactionCreate', async (interaction: Interaction) => {
      // If guild filter is set, only process interactions from that guild
      if (this.config.discordGuildId && interaction.guildId !== this.config.discordGuildId) {
        return;
      }

      let eventData: any = {
        id: interaction.id,
        type: interaction.type,
        channelId: interaction.channelId,
        guildId: interaction.guildId,
        user: {
          id: interaction.user.id,
          username: interaction.user.username,
        },
      };

      if (interaction.isChatInputCommand()) {
        eventData.commandName = interaction.commandName;
        eventData.options = interaction.options.data;
      } else if (interaction.isButton()) {
        eventData.customId = interaction.customId;
      } else if (interaction.isStringSelectMenu()) {
        eventData.customId = interaction.customId;
        eventData.values = interaction.values;
      }

      await this.handleDiscordEvent('interactionCreate', eventData);
    });

    // Handle member events
    this.client.on('guildMemberAdd', async (member) => {
      if (this.config.discordGuildId && member.guild.id !== this.config.discordGuildId) {
        return;
      }

      await this.handleDiscordEvent('guildMemberAdd', {
        userId: member.user.id,
        username: member.user.username,
        guildId: member.guild.id,
        guildName: member.guild.name,
      });
    });

    this.client.on('guildMemberRemove', async (member) => {
      if (this.config.discordGuildId && member.guild.id !== this.config.discordGuildId) {
        return;
      }

      await this.handleDiscordEvent('guildMemberRemove', {
        userId: member.user.id,
        username: member.user.username,
        guildId: member.guild.id,
        guildName: member.guild.name,
      });
    });

    // Handle reactions
    this.client.on('messageReactionAdd', async (reaction, user) => {
      if (user.bot) return;

      await this.handleDiscordEvent('messageReactionAdd', {
        emoji: reaction.emoji.name,
        messageId: reaction.message.id,
        channelId: reaction.message.channelId,
        userId: user.id,
      });
    });

    // Handle connection events
    this.client.on('ready', () => {
      log.debug({ integrationId: this.config.id }, 'Discord ready');
    });

    this.client.on('disconnect', () => {
      log.warn({ integrationId: this.config.id }, 'Discord disconnected');
      this.updateState({ status: 'disconnected' });
      this.emit('disconnected', 'Gateway disconnected');
    });

    this.client.on('error', (error) => {
      log.error({ integrationId: this.config.id, error }, 'Discord error');
      this.emit('error', error);
    });

    this.client.on('warn', (message) => {
      log.warn({ integrationId: this.config.id, message }, 'Discord warning');
    });

    this.client.on('shardReconnecting', () => {
      log.info({ integrationId: this.config.id }, 'Discord reconnecting');
      this.updateState({
        status: 'connecting',
        retryCount: this.state.retryCount + 1,
      });
    });
  }

  private async handleDiscordEvent(type: string, event: any): Promise<void> {
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
    const platformEvent: PlatformEvent = {
      integrationId: this.config.id,
      agentId: this.config.agentId,
      platform: 'discord',
      type,
      timestamp: new Date(event.timestamp || Date.now()),
      payload: event,
      respondTo: event.channelId,
      replyToken: event.id,
    };

    // Route to agent
    try {
      const result = await this.eventRouter.routeEvent(platformEvent);

      if (result.success) {
        this.updateState({
          eventsDelivered: this.state.eventsDelivered + 1,
        });

        // If agent returned a response, send it back
        if (result.response?.content && event.channelId) {
          if (event.id && type === 'messageCreate') {
            await this.replyToMessage(event.channelId, event.id, result.response.content);
          } else {
            await this.sendMessage(event.channelId, result.response.content);
          }
        }
      } else {
        this.updateState({
          eventsFailed: this.state.eventsFailed + 1,
        });
      }
    } catch (error) {
      log.error({ error, type }, 'Failed to route Discord event');
      this.updateState({
        eventsFailed: this.state.eventsFailed + 1,
      });
    }
  }
}
