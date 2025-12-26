/**
 * Agentiom SDK - Types
 *
 * TypeScript types for the SDK.
 */

import type { StateManager } from './state';

// =============================================================================
// Configuration
// =============================================================================

export interface AgentConfig {
  /** Agent name */
  name: string;
  /** Port to listen on (default: 3000) */
  port: number;
  /** Path to state directory (default: ./state) */
  statePath: string;
  /** Log level (default: info) */
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'silent';
}

// =============================================================================
// Events
// =============================================================================

export interface BaseEvent {
  type: string;
  timestamp: Date;
}

export interface WebhookEvent extends BaseEvent {
  type: 'webhook';
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: any;
}

export interface CronEvent extends BaseEvent {
  type: 'cron';
  schedule: string;
  scheduledTime: Date;
}

export interface SlackEvent extends BaseEvent {
  type: 'slack';
  eventType: string;
  channel?: string;
  user?: string;
  text?: string;
  threadTs?: string;
  ts?: string;
  raw: any;
}

export interface DiscordEvent extends BaseEvent {
  type: 'discord';
  eventType: string;
  channelId?: string;
  guildId?: string;
  author?: {
    id: string;
    username: string;
    discriminator?: string;
  };
  content?: string;
  messageId?: string;
  raw: any;
}

export interface TelegramEvent extends BaseEvent {
  type: 'telegram';
  eventType: string;
  chatId?: number;
  from?: {
    id: number;
    username?: string;
    first_name?: string;
  };
  text?: string;
  messageId?: number;
  raw: any;
}

export interface EmailEvent extends BaseEvent {
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
    content?: string;
  }>;
  raw: any;
}

// =============================================================================
// Handlers
// =============================================================================

export type EventHandler<E extends BaseEvent> = (
  event: E,
  ctx: AgentContext
) => Promise<any>;

export type StartupHandler = (ctx: AgentContext) => Promise<void>;
export type ShutdownHandler = (ctx: AgentContext) => Promise<void>;

// =============================================================================
// Context
// =============================================================================

export interface AgentContext {
  /** Persistent state manager */
  state: StateManager;

  /** Agent configuration */
  config: AgentConfig;

  /** Logger */
  log: Logger;

  /** Get environment variable or throw */
  requireEnv(key: string): string;

  /** Get environment variable with fallback */
  getEnv(key: string, fallback?: string): string | undefined;

  /** Generate random ID */
  randomId(length?: number): string;

  /** Get current time info */
  now(): TimeInfo;

  /** Sleep for ms */
  sleep(ms: number): Promise<void>;

  /** Fetch wrapper */
  fetch: typeof fetch;
}

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export interface TimeInfo {
  date: Date;
  iso: string;
  unix: number;
  unixMs: number;
}
