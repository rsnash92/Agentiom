/**
 * Event Router
 *
 * Routes incoming platform events to agents:
 * 1. Receives normalized events from platform integrations
 * 2. Wakes the agent if sleeping
 * 3. Delivers the event to the agent's webhook endpoint
 * 4. Handles response routing back to the platform
 */

import { createLogger } from '@agentiom/shared';

const log = createLogger('event-router');

export interface EventRouterConfig {
  apiUrl: string;
  internalToken: string;
}

export interface PlatformEvent {
  integrationId: string;
  agentId: string;
  platform: 'slack' | 'discord' | 'telegram' | 'custom_websocket';
  type: string;           // Platform-specific event type (e.g., "message", "app_mention")
  timestamp: Date;
  payload: any;           // Raw event payload
  respondTo?: string;     // Channel/thread/chat ID to respond to
  replyToken?: string;    // Platform-specific reply token if needed
}

export interface DeliveryResult {
  success: boolean;
  agentWasAsleep: boolean;
  wakeLatencyMs?: number;
  deliveryLatencyMs: number;
  response?: any;         // Response from agent to send back
  error?: string;
}

export class EventRouter {
  private config: EventRouterConfig;

  constructor(config: EventRouterConfig) {
    this.config = config;
  }

  /**
   * Route an event to an agent
   */
  async routeEvent(event: PlatformEvent): Promise<DeliveryResult> {
    const startTime = Date.now();

    log.info({
      integrationId: event.integrationId,
      agentId: event.agentId,
      platform: event.platform,
      eventType: event.type,
    }, 'Routing event to agent');

    try {
      // Step 1: Check agent status and wake if needed
      const wakeResult = await this.ensureAgentAwake(event.agentId, event);

      // Step 2: Deliver event to agent
      const deliveryResult = await this.deliverEvent(event);

      const deliveryLatencyMs = Date.now() - startTime;

      log.info({
        agentId: event.agentId,
        deliveryLatencyMs,
        wakeLatencyMs: wakeResult.latencyMs,
        wasAsleep: wakeResult.wasAsleep,
      }, 'Event delivered successfully');

      return {
        success: true,
        agentWasAsleep: wakeResult.wasAsleep,
        wakeLatencyMs: wakeResult.latencyMs,
        deliveryLatencyMs,
        response: deliveryResult.response,
      };

    } catch (error) {
      const deliveryLatencyMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      log.error({
        agentId: event.agentId,
        error,
        deliveryLatencyMs,
      }, 'Failed to route event');

      return {
        success: false,
        agentWasAsleep: false,
        deliveryLatencyMs,
        error: errorMessage,
      };
    }
  }

  /**
   * Ensure agent is awake, wake if necessary
   */
  private async ensureAgentAwake(
    agentId: string,
    event: PlatformEvent
  ): Promise<{ wasAsleep: boolean; latencyMs?: number }> {
    const startTime = Date.now();

    try {
      // Call the internal trigger endpoint which handles wake logic
      const response = await fetch(
        `${this.config.apiUrl}/internal/trigger/${agentId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.internalToken}`,
          },
          body: JSON.stringify({
            type: 'integration',
            source: event.platform,
            context: {
              integrationId: event.integrationId,
              eventType: event.type,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to trigger agent: ${error}`);
      }

      const result = await response.json();
      const latencyMs = Date.now() - startTime;

      return {
        wasAsleep: result.previousStatus === 'sleeping',
        latencyMs: result.wakeLatencyMs || latencyMs,
      };

    } catch (error) {
      log.error({ agentId, error }, 'Failed to ensure agent awake');
      throw error;
    }
  }

  /**
   * Deliver event to agent's webhook endpoint
   */
  private async deliverEvent(event: PlatformEvent): Promise<{ response?: any }> {
    // Get agent's URL and webhook path
    const agentUrl = await this.getAgentUrl(event.agentId);

    if (!agentUrl) {
      throw new Error(`Agent ${event.agentId} has no URL`);
    }

    // Default webhook path, can be customized per integration
    const webhookPath = '/webhook';
    const url = `${agentUrl}${webhookPath}`;

    log.debug({ url, eventType: event.type }, 'Delivering event');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agentiom-Integration-Id': event.integrationId,
        'X-Agentiom-Platform': event.platform,
        'X-Agentiom-Event-Type': event.type,
      },
      body: JSON.stringify({
        type: event.type,
        platform: event.platform,
        timestamp: event.timestamp.toISOString(),
        payload: event.payload,
        respondTo: event.respondTo,
        replyToken: event.replyToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Agent returned error: ${response.status} ${error}`);
    }

    // Check if agent returned a response to send back
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      try {
        const body = await response.json();
        return { response: body };
      } catch {
        // No response body or invalid JSON
        return {};
      }
    }

    return {};
  }

  /**
   * Get agent's public URL
   */
  private async getAgentUrl(agentId: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.config.apiUrl}/internal/agents/${agentId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.internalToken}`,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const agent = await response.json();
      return agent.url || null;

    } catch (error) {
      log.error({ agentId, error }, 'Failed to get agent URL');
      return null;
    }
  }
}
