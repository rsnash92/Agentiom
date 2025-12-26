/**
 * Socket Proxy Types
 *
 * Shared types for platform integrations and connection management.
 */

import { EventEmitter } from 'events';

// =============================================================================
// Integration Configuration
// =============================================================================

export interface IntegrationConfig {
  id: string;
  agentId: string;
  platform: 'slack' | 'discord' | 'telegram' | 'custom_websocket';
  name: string;

  // Event filtering
  eventFilter?: string[];

  // Slack
  slackAppToken?: string;
  slackBotToken?: string;
  slackTeamId?: string;

  // Discord
  discordBotToken?: string;
  discordGuildId?: string;
  discordApplicationId?: string;

  // Telegram
  telegramBotToken?: string;
  telegramWebhookSecret?: string;

  // Custom WebSocket
  customWsUrl?: string;
  customWsHeaders?: Record<string, string>;
}

// =============================================================================
// Connection State
// =============================================================================

export type ConnectionStatus =
  | 'pending'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface ConnectionState {
  integrationId: string;
  platform: string;
  status: ConnectionStatus;
  statusMessage?: string;
  connectedAt?: Date;
  lastEventAt?: Date;
  eventsReceived: number;
  eventsDelivered: number;
  eventsFailed: number;
  retryCount: number;
}

// =============================================================================
// Platform Integration Interface
// =============================================================================

export interface PlatformIntegration extends EventEmitter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getState(): ConnectionState;
  handleWebhook?(update: any): Promise<void>;
}

// =============================================================================
// Base Platform Integration
// =============================================================================

export abstract class BasePlatformIntegration extends EventEmitter implements PlatformIntegration {
  protected config: IntegrationConfig;
  protected state: ConnectionState;

  constructor(config: IntegrationConfig) {
    super();
    this.config = config;
    this.state = {
      integrationId: config.id,
      platform: config.platform,
      status: 'pending',
      eventsReceived: 0,
      eventsDelivered: 0,
      eventsFailed: 0,
      retryCount: 0,
    };
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  getState(): ConnectionState {
    return { ...this.state };
  }

  protected updateState(updates: Partial<ConnectionState>): void {
    this.state = { ...this.state, ...updates };
  }
}
