/**
 * Lifecycle CLI Commands - Phase 2
 * 
 * Commands for controlling agent sleep/wake state:
 * - agentiom wake <agent> - Wake a sleeping agent
 * - agentiom sleep <agent> - Put an agent to sleep
 * - agentiom status <agent> - Get agent runtime status
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

// Placeholder for API client - will be properly imported
async function apiRequest(
  method: string,
  path: string,
  body?: any
): Promise<any> {
  const baseUrl = process.env.AGENTIOM_API_URL || 'https://api.agentiom.dev';
  const token = process.env.AGENTIOM_TOKEN;

  if (!token) {
    throw new Error(
      'No API token found. Set AGENTIOM_TOKEN or run: agentiom login'
    );
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

// =============================================================================
// Wake Command
// =============================================================================

export const wakeCommand = new Command('wake')
  .description('Wake a sleeping agent')
  .argument('<agent>', 'Agent ID or slug')
  .option('--context <json>', 'JSON context to pass to the agent')
  .action(async (agent: string, options: { context?: string }) => {
    const spinner = ora('Waking agent...').start();

    try {
      const body: any = { triggerType: 'api' };
      if (options.context) {
        body.context = JSON.parse(options.context);
      }

      const result = await apiRequest('POST', `/agents/${agent}/wake`, body);

      spinner.succeed(chalk.green('Agent is now awake!'));
      console.log();
      console.log(`  Status: ${chalk.cyan(result.status)}`);
      console.log(`  Previous: ${chalk.dim(result.previousStatus)}`);
      console.log(`  Wake latency: ${chalk.yellow(result.latencyMs + 'ms')}`);
    } catch (error) {
      spinner.fail(chalk.red('Failed to wake agent'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// =============================================================================
// Sleep Command
// =============================================================================

export const sleepCommand = new Command('sleep')
  .description('Put an agent to sleep (stop but preserve state)')
  .argument('<agent>', 'Agent ID or slug')
  .action(async (agent: string) => {
    const spinner = ora('Putting agent to sleep...').start();

    try {
      const result = await apiRequest('POST', `/agents/${agent}/sleep`);

      spinner.succeed(chalk.green('Agent is now sleeping'));
      console.log();
      console.log(`  Status: ${chalk.cyan(result.status)}`);
      console.log(`  Previous: ${chalk.dim(result.previousStatus)}`);
      console.log();
      console.log(chalk.dim('  The agent will wake on:'));
      console.log(chalk.dim('  • API request'));
      console.log(chalk.dim('  • Webhook trigger'));
      console.log(chalk.dim('  • Cron schedule'));
    } catch (error) {
      spinner.fail(chalk.red('Failed to put agent to sleep'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// =============================================================================
// Status Command
// =============================================================================

export const statusCommand = new Command('status')
  .description('Get agent runtime status')
  .argument('<agent>', 'Agent ID or slug')
  .option('--json', 'Output as JSON')
  .action(async (agent: string, options: { json?: boolean }) => {
    try {
      const result = await apiRequest('GET', `/agents/${agent}/status`);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      const statusColors: Record<string, (s: string) => string> = {
        running: chalk.green,
        sleeping: chalk.yellow,
        stopped: chalk.red,
        unknown: chalk.gray,
      };

      const colorFn = statusColors[result.status] || chalk.white;

      console.log();
      console.log(`  Agent: ${chalk.bold(agent)}`);
      console.log(`  Status: ${colorFn(result.status.toUpperCase())}`);

      if (result.machineState) {
        console.log(`  Machine: ${chalk.dim(result.machineState)}`);
      }

      if (result.uptime !== undefined) {
        const hours = Math.floor(result.uptime / 3600);
        const mins = Math.floor((result.uptime % 3600) / 60);
        const secs = result.uptime % 60;
        const uptimeStr =
          hours > 0
            ? `${hours}h ${mins}m ${secs}s`
            : mins > 0
              ? `${mins}m ${secs}s`
              : `${secs}s`;
        console.log(`  Uptime: ${chalk.cyan(uptimeStr)}`);
      }

      if (result.lastActivityAt) {
        const lastActive = new Date(result.lastActivityAt);
        const ago = Math.floor((Date.now() - lastActive.getTime()) / 1000);
        const agoStr =
          ago < 60
            ? `${ago}s ago`
            : ago < 3600
              ? `${Math.floor(ago / 60)}m ago`
              : `${Math.floor(ago / 3600)}h ago`;
        console.log(`  Last activity: ${chalk.dim(agoStr)}`);
      }

      console.log();
    } catch (error) {
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// =============================================================================
// Auto-Sleep Config Command
// =============================================================================

export const autoSleepCommand = new Command('auto-sleep')
  .description('Configure auto-sleep settings')
  .argument('<agent>', 'Agent ID or slug')
  .option('--enable', 'Enable auto-sleep')
  .option('--disable', 'Disable auto-sleep')
  .option('--timeout <minutes>', 'Idle timeout in minutes (1-60)')
  .action(
    async (
      agent: string,
      options: { enable?: boolean; disable?: boolean; timeout?: string }
    ) => {
      if (!options.enable && !options.disable && !options.timeout) {
        // Just show current config
        const result = await apiRequest('GET', `/agents/${agent}/status`);
        console.log();
        console.log(`  Auto-sleep for ${chalk.bold(agent)}:`);
        console.log(`  Currently: ${result.autoSleep ? 'Enabled' : 'Disabled'}`);
        console.log(`  Timeout: ${result.idleTimeoutMins || 5} minutes`);
        console.log();
        return;
      }

      const body: any = {};

      if (options.enable) {
        body.enabled = true;
      } else if (options.disable) {
        body.enabled = false;
      }

      if (options.timeout) {
        body.idleTimeoutMins = parseInt(options.timeout, 10);
      }

      const result = await apiRequest(
        'PATCH',
        `/agents/${agent}/auto-sleep`,
        body
      );

      console.log();
      console.log(chalk.green('✓ Auto-sleep settings updated'));
      console.log(`  Enabled: ${result.autoSleep ? 'Yes' : 'No'}`);
      console.log(`  Timeout: ${result.idleTimeoutMins} minutes`);
      console.log();
    }
  );

// =============================================================================
// Triggers Command
// =============================================================================

export const triggersCommand = new Command('triggers')
  .description('Manage agent triggers')
  .argument('<agent>', 'Agent ID or slug');

// List triggers
triggersCommand
  .command('list')
  .description('List all triggers for an agent')
  .action(async () => {
    const agent = triggersCommand.args[0];

    try {
      const result = await apiRequest('GET', `/agents/${agent}/triggers`);

      if (result.triggers.length === 0) {
        console.log(chalk.dim('  No triggers configured'));
        return;
      }

      console.log();
      console.log(`  Triggers for ${chalk.bold(agent)}:`);
      console.log();

      for (const trigger of result.triggers) {
        const status = trigger.enabled
          ? chalk.green('●')
          : chalk.dim('○');
        const type = chalk.cyan(trigger.type.padEnd(8));
        console.log(`  ${status} ${type} ${trigger.id}`);

        if (trigger.type === 'cron' && trigger.cronExpression) {
          console.log(chalk.dim(`           Schedule: ${trigger.cronExpression}`));
        }
        if (trigger.type === 'webhook' && trigger.webhookPath) {
          console.log(chalk.dim(`           Path: ${trigger.webhookPath}`));
        }
      }
      console.log();
    } catch (error) {
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// Show webhook URL
triggersCommand
  .command('webhook-url')
  .description('Show the webhook URL for an agent')
  .action(async () => {
    const agent = triggersCommand.args[0];

    try {
      const result = await apiRequest(
        'POST',
        `/webhooks/${agent}/generate-secret`
      );

      console.log();
      console.log(chalk.green('✓ Webhook URL generated'));
      console.log();
      console.log(`  ${chalk.bold('URL:')} ${result.webhookUrl}`);
      console.log();
      console.log(chalk.dim('  Use this URL to trigger wake events via HTTP POST'));
      console.log();
    } catch (error) {
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// Show wake history
triggersCommand
  .command('history')
  .description('Show wake event history')
  .option('-n, --limit <count>', 'Number of events to show', '10')
  .action(async (options: { limit: string }) => {
    const agent = triggersCommand.args[0];

    try {
      const result = await apiRequest(
        'GET',
        `/agents/${agent}/wake-events?limit=${options.limit}`
      );

      console.log();
      console.log(`  Wake history for ${chalk.bold(agent)}:`);
      console.log();
      console.log(`  Total: ${result.stats.total}`);
      console.log(`  Success: ${chalk.green(result.stats.successful)}`);
      console.log(`  Failed: ${chalk.red(result.stats.failed)}`);
      console.log(`  Avg latency: ${chalk.yellow(result.stats.avgLatencyMs + 'ms')}`);
      console.log();

      if (result.events.length > 0) {
        console.log('  Recent events:');
        for (const event of result.events.slice(0, 10)) {
          const time = new Date(event.createdAt).toLocaleString();
          const status = event.success ? chalk.green('✓') : chalk.red('✗');
          const type = chalk.cyan(event.triggerType.padEnd(8));
          const latency = chalk.dim(`${event.wakeLatencyMs}ms`);
          console.log(`  ${status} ${time} ${type} ${latency}`);
        }
      }
      console.log();
    } catch (error) {
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// =============================================================================
// Export All Commands
// =============================================================================

export const lifecycleCommands = [
  wakeCommand,
  sleepCommand,
  statusCommand,
  autoSleepCommand,
  triggersCommand,
];
