/**
 * @agentiom/sdk
 *
 * Build stateful AI agents that sleep between tasks.
 *
 * @example
 * ```ts
 * import { Agent } from '@agentiom/sdk';
 *
 * const agent = new Agent({ name: 'my-agent' });
 *
 * agent.on('webhook', async (event, ctx) => {
 *   const count = ctx.state.increment('count');
 *   return { message: `Request #${count}` };
 * });
 *
 * agent.start();
 * ```
 */

export { Agent } from './agent';
export { StateManager } from './state';
export { AgentContext } from './context';

// Re-export types
export type {
  AgentConfig,
  WebhookEvent,
  CronEvent,
  SlackEvent,
  DiscordEvent,
  TelegramEvent,
  EmailEvent,
  EventHandler,
  StartupHandler,
  ShutdownHandler,
  Logger,
  TimeInfo,
} from './types';
