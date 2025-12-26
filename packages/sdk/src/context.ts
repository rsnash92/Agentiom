/**
 * Agentiom SDK - Context
 *
 * Request context with utilities for handlers.
 */

import type { StateManager } from './state';
import type { AgentConfig, AgentContext, Logger, TimeInfo } from './types';

export class AgentContextImpl implements AgentContext {
  state: StateManager;
  config: AgentConfig;
  log: Logger;
  fetch: typeof fetch = globalThis.fetch;

  constructor(state: StateManager, config: AgentConfig) {
    this.state = state;
    this.config = config;
    this.log = this.createLogger();
  }

  private createLogger(): Logger {
    const level = this.config.logLevel;
    const levels = ['debug', 'info', 'warn', 'error', 'silent'];
    const levelIndex = levels.indexOf(level);

    const shouldLog = (msgLevel: string) => {
      if (level === 'silent') return false;
      return levels.indexOf(msgLevel) >= levelIndex;
    };

    const format = (msgLevel: string, message: string, args: any[]) => {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${msgLevel.toUpperCase()}]`;
      if (args.length > 0) {
        console.log(prefix, message, ...args);
      } else {
        console.log(prefix, message);
      }
    };

    return {
      debug: (message: string, ...args: any[]) => {
        if (shouldLog('debug')) format('debug', message, args);
      },
      info: (message: string, ...args: any[]) => {
        if (shouldLog('info')) format('info', message, args);
      },
      warn: (message: string, ...args: any[]) => {
        if (shouldLog('warn')) format('warn', message, args);
      },
      error: (message: string, ...args: any[]) => {
        if (shouldLog('error')) format('error', message, args);
      },
    };
  }

  requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  }

  getEnv(key: string, fallback?: string): string | undefined {
    return process.env[key] ?? fallback;
  }

  randomId(length: number = 16): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  now(): TimeInfo {
    const date = new Date();
    return {
      date,
      iso: date.toISOString(),
      unix: Math.floor(date.getTime() / 1000),
      unixMs: date.getTime(),
    };
  }

  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Re-export for convenience
export { AgentContextImpl as AgentContext };
