/**
 * Connection Manager
 *
 * Manages all platform connections:
 * - Loading integrations from database
 * - Establishing/maintaining connections
 * - Reconnection with exponential backoff
 * - Health monitoring
 */

import { createLogger } from '@agentiom/shared';
import type { EventRouter } from './event-router';
import type { PlatformIntegration, IntegrationConfig, ConnectionState } from './types';

const log = createLogger('connection-manager');

export interface ConnectionManagerConfig {
  eventRouter: EventRouter;
  maxRetries: number;
  baseRetryDelayMs: number;
  maxRetryDelayMs: number;
}

type PlatformConstructor = new (
  config: IntegrationConfig,
  eventRouter: EventRouter
) => PlatformIntegration;

export class ConnectionManager {
  private connections: Map<string, PlatformIntegration> = new Map();
  private platforms: Map<string, PlatformConstructor> = new Map();
  private config: ConnectionManagerConfig;
  private retryTimeouts: Map<string, Timer> = new Map();

  constructor(config: ConnectionManagerConfig) {
    this.config = config;
  }

  /**
   * Register a platform integration handler
   */
  registerPlatform(platform: string, handler: PlatformConstructor): void {
    this.platforms.set(platform, handler);
    log.info({ platform }, 'Registered platform handler');
  }

  /**
   * Load all active integrations from database and connect
   */
  async loadAndConnectAll(): Promise<void> {
    // TODO: Load from database
    // For now, this will be called via API when integrations are created
    log.info('Ready to accept integration connections');
  }

  /**
   * Connect a specific integration
   */
  async connect(integrationId: string, config?: IntegrationConfig): Promise<void> {
    // If already connected, skip
    if (this.connections.has(integrationId)) {
      const existing = this.connections.get(integrationId)!;
      if (existing.getState().status === 'connected') {
        log.debug({ integrationId }, 'Already connected');
        return;
      }
    }

    if (!config) {
      // Load from database
      config = await this.loadIntegrationConfig(integrationId);
    }

    if (!config) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    const PlatformHandler = this.platforms.get(config.platform);
    if (!PlatformHandler) {
      throw new Error(`Unknown platform: ${config.platform}`);
    }

    log.info({ integrationId, platform: config.platform }, 'Connecting integration');

    const integration = new PlatformHandler(config, this.config.eventRouter);

    // Set up event handlers
    integration.on('connected', () => {
      log.info({ integrationId }, 'Integration connected');
      this.clearRetryTimeout(integrationId);
    });

    integration.on('disconnected', (reason: string) => {
      log.warn({ integrationId, reason }, 'Integration disconnected');
      this.scheduleReconnect(integrationId, config!);
    });

    integration.on('error', (error: Error) => {
      log.error({ integrationId, error }, 'Integration error');
    });

    integration.on('event', (event: any) => {
      log.debug({ integrationId, eventType: event.type }, 'Received event');
    });

    this.connections.set(integrationId, integration);

    try {
      await integration.connect();
    } catch (error) {
      log.error({ integrationId, error }, 'Failed to connect integration');
      this.scheduleReconnect(integrationId, config);
      throw error;
    }
  }

  /**
   * Disconnect a specific integration
   */
  async disconnect(integrationId: string): Promise<void> {
    this.clearRetryTimeout(integrationId);

    const integration = this.connections.get(integrationId);
    if (!integration) {
      return;
    }

    log.info({ integrationId }, 'Disconnecting integration');
    await integration.disconnect();
    this.connections.delete(integrationId);
  }

  /**
   * Reconnect a specific integration
   */
  async reconnect(integrationId: string): Promise<void> {
    await this.disconnect(integrationId);
    await this.connect(integrationId);
  }

  /**
   * Disconnect all integrations
   */
  async disconnectAll(): Promise<void> {
    log.info({ count: this.connections.size }, 'Disconnecting all integrations');

    const promises = Array.from(this.connections.keys()).map(id =>
      this.disconnect(id).catch(error =>
        log.error({ integrationId: id, error }, 'Failed to disconnect')
      )
    );

    await Promise.all(promises);
  }

  /**
   * Get connection state for an integration
   */
  getConnection(integrationId: string): ConnectionState | null {
    const integration = this.connections.get(integrationId);
    return integration?.getState() || null;
  }

  /**
   * Get all connection states
   */
  getAllConnections(): ConnectionState[] {
    return Array.from(this.connections.values()).map(i => i.getState());
  }

  /**
   * Get aggregate stats
   */
  getStats(): {
    total: number;
    connected: number;
    disconnected: number;
    error: number;
    byPlatform: Record<string, number>;
  } {
    const states = this.getAllConnections();

    const byPlatform: Record<string, number> = {};
    let connected = 0;
    let disconnected = 0;
    let error = 0;

    for (const state of states) {
      byPlatform[state.platform] = (byPlatform[state.platform] || 0) + 1;

      switch (state.status) {
        case 'connected':
          connected++;
          break;
        case 'disconnected':
          disconnected++;
          break;
        case 'error':
          error++;
          break;
      }
    }

    return {
      total: states.length,
      connected,
      disconnected,
      error,
      byPlatform,
    };
  }

  /**
   * Check health of all connections
   */
  checkHealth(): void {
    for (const [integrationId, integration] of this.connections) {
      const state = integration.getState();

      // Check for stale connections
      if (state.status === 'connected' && state.lastEventAt) {
        const staleThresholdMs = 5 * 60 * 1000; // 5 minutes
        if (Date.now() - state.lastEventAt.getTime() > staleThresholdMs) {
          log.warn({ integrationId }, 'Connection appears stale, reconnecting');
          this.reconnect(integrationId).catch(error =>
            log.error({ integrationId, error }, 'Failed to reconnect stale connection')
          );
        }
      }
    }
  }

  /**
   * Handle Telegram webhook (Telegram uses HTTP, not sockets)
   */
  async handleTelegramWebhook(integrationId: string, update: any): Promise<void> {
    const integration = this.connections.get(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    if (integration.handleWebhook) {
      await integration.handleWebhook(update);
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private async loadIntegrationConfig(integrationId: string): Promise<IntegrationConfig | null> {
    // TODO: Load from database via API call
    // For now, configs are passed directly via API
    log.warn({ integrationId }, 'Database loading not implemented, use API with config');
    return null;
  }

  private scheduleReconnect(integrationId: string, config: IntegrationConfig): void {
    const integration = this.connections.get(integrationId);
    const retryCount = integration?.getState().retryCount || 0;

    if (retryCount >= this.config.maxRetries) {
      log.error({ integrationId, retryCount }, 'Max retries reached, giving up');
      return;
    }

    // Exponential backoff with jitter
    const delay = Math.min(
      this.config.baseRetryDelayMs * Math.pow(2, retryCount) + Math.random() * 1000,
      this.config.maxRetryDelayMs
    );

    log.info({ integrationId, retryCount, delayMs: delay }, 'Scheduling reconnect');

    this.clearRetryTimeout(integrationId);

    const timeout = setTimeout(async () => {
      try {
        await this.connect(integrationId, config);
      } catch (error) {
        log.error({ integrationId, error }, 'Reconnection failed');
      }
    }, delay);

    this.retryTimeouts.set(integrationId, timeout);
  }

  private clearRetryTimeout(integrationId: string): void {
    const timeout = this.retryTimeouts.get(integrationId);
    if (timeout) {
      clearTimeout(timeout);
      this.retryTimeouts.delete(integrationId);
    }
  }
}
