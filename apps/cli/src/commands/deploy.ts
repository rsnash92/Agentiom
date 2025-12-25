/**
 * Deploy Command
 *
 * Deploy an agent to Fly.io using fly deploy.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import YAML from 'yaml';
import ora from 'ora';
import { getApiClient } from '../lib/api-client';
import { isLoggedIn } from '../lib/config';
import { success, error, info, keyValue, header } from '../lib/output';

interface AgentConfig {
  name: string;
  description?: string;
  resources?: {
    cpu?: string;
    memory?: string;
    storage?: string;
  };
  region?: string;
  env?: Record<string, string>;
}

interface Agent {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  url: string | null;
  region: string;
  cpuKind: string;
  cpus: number;
  memoryMb: number;
  storageSizeGb: number;
  lastDeployedAt: string | null;
}

const FLY_APP_NAME = process.env.FLY_APP_NAME ?? 'agentiom-agents';

function parseMemory(memory: string): number {
  const match = memory.match(/^(\d+)(mb|gb)?$/i);
  if (!match) return 256;
  const value = parseInt(match[1]!, 10);
  const unit = (match[2] ?? 'mb').toLowerCase();
  return unit === 'gb' ? value * 1024 : value;
}

function parseStorage(storage: string): number {
  const match = storage.match(/^(\d+)(gb)?$/i);
  if (!match) return 1;
  return parseInt(match[1]!, 10);
}

/**
 * Create volume on Fly.io if it doesn't exist
 */
async function ensureVolume(agentSlug: string, region: string): Promise<void> {
  const volumeName = `vol_${agentSlug.replace(/-/g, '_')}`;

  return new Promise((resolve, reject) => {
    // Check if volume exists
    const checkProc = spawn('fly', ['volumes', 'list', '-a', FLY_APP_NAME, '--json'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    checkProc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    checkProc.on('close', (code) => {
      if (code !== 0) {
        // If app doesn't exist or other error, try to create volume anyway
      }

      try {
        const volumes = JSON.parse(stdout || '[]') as Array<{ name: string }>;
        const exists = volumes.some((v) => v.name === volumeName);

        if (exists) {
          resolve();
          return;
        }
      } catch {
        // Parse error, try creating
      }

      // Create volume
      const createProc = spawn(
        'fly',
        ['volumes', 'create', volumeName, '-a', FLY_APP_NAME, '-r', region, '-s', '1', '-y'],
        { stdio: 'inherit' }
      );

      createProc.on('close', (createCode) => {
        if (createCode === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to create volume (exit code ${createCode})`));
        }
      });
    });
  });
}

/**
 * Run fly deploy to build and deploy the agent
 */
async function flyDeploy(agentDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      'deploy',
      '--app',
      FLY_APP_NAME,
      '--remote-only', // Build in Fly's cloud, no local Docker needed
      '--ha=false', // Single machine
      '-y', // Skip confirmations
    ];

    console.log();
    info(`Deploying to ${FLY_APP_NAME}...`);
    console.log();

    const proc = spawn('fly', args, {
      cwd: agentDir,
      stdio: 'inherit', // Show build output
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`fly deploy failed with exit code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to run fly deploy: ${err.message}`));
    });
  });
}

/**
 * Get the deployed machine info from Fly.io
 */
async function getMachineInfo(): Promise<{ id: string; state: string } | null> {
  return new Promise((resolve) => {
    const proc = spawn('fly', ['machines', 'list', '-a', FLY_APP_NAME, '--json'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }

      try {
        const machines = JSON.parse(stdout) as Array<{ id: string; state: string }>;
        if (machines.length > 0) {
          // Get the most recently updated machine
          resolve(machines[0]!);
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    });
  });
}

export async function deploy(): Promise<void> {
  // Check login
  if (!isLoggedIn()) {
    error('Not logged in');
    info('Run: agentiom login');
    process.exit(1);
  }

  // Read agent.yaml
  const configPath = join(process.cwd(), 'agent.yaml');

  if (!existsSync(configPath)) {
    error('agent.yaml not found in current directory');
    info('Run: agentiom init <name>');
    process.exit(1);
  }

  // Check for fly.toml
  const flyTomlPath = join(process.cwd(), 'fly.toml');
  if (!existsSync(flyTomlPath)) {
    error('fly.toml not found in current directory');
    info('Regenerate with: agentiom init <name>');
    process.exit(1);
  }

  // Check for Dockerfile
  const dockerfilePath = join(process.cwd(), 'Dockerfile');
  if (!existsSync(dockerfilePath)) {
    error('Dockerfile not found in current directory');
    info('Regenerate with: agentiom init <name>');
    process.exit(1);
  }

  let config: AgentConfig;
  try {
    const content = readFileSync(configPath, 'utf-8');
    config = YAML.parse(content) as AgentConfig;
  } catch (err) {
    error(`Failed to parse agent.yaml: ${err instanceof Error ? err.message : 'Unknown error'}`);
    process.exit(1);
  }

  if (!config.name) {
    error('agent.yaml must have a "name" field');
    process.exit(1);
  }

  const client = getApiClient();
  const spinner = ora('Preparing deployment...').start();

  try {
    // Check if agent exists in our API
    const agentsResponse = await client.get<{ agents: Agent[] }>('/agents');
    let agent = agentsResponse.agents.find((a) => a.name === config.name);

    if (!agent) {
      // Create agent record
      spinner.text = 'Creating agent record...';

      const createResponse = await client.post<{ agent: Agent }>('/agents', {
        name: config.name,
        description: config.description,
        config: {
          region: config.region ?? 'iad',
          cpuKind: config.resources?.cpu ?? 'shared',
          memoryMb: parseMemory(config.resources?.memory ?? '256mb'),
          storageSizeGb: parseStorage(config.resources?.storage ?? '1gb'),
          env: config.env,
        },
      });

      agent = createResponse.agent;
    }

    // Create volume if needed
    spinner.text = 'Ensuring volume exists...';
    spinner.stop();

    try {
      await ensureVolume(agent.slug, agent.region);
    } catch (err) {
      error(`Failed to create volume: ${err instanceof Error ? err.message : 'Unknown error'}`);
      process.exit(1);
    }

    // Run fly deploy
    try {
      await flyDeploy(process.cwd());
    } catch (err) {
      error(err instanceof Error ? err.message : 'Deployment failed');
      process.exit(1);
    }

    // Get machine info
    const machineInfo = await getMachineInfo();

    // Update agent record with deployment info
    if (machineInfo) {
      try {
        await client.patch<{ agent: Agent }>(`/agents/${agent.id}`, {
          machineId: machineInfo.id,
          status: machineInfo.state === 'started' ? 'running' : 'stopped',
          url: `https://${FLY_APP_NAME}.fly.dev`,
          lastDeployedAt: new Date().toISOString(),
        });
      } catch {
        // Non-fatal, continue
      }
    }

    // Output success
    console.log();
    success('Agent deployed successfully!');

    header('Agent Details');
    keyValue('Name', agent.name);
    keyValue('App', FLY_APP_NAME);
    keyValue('URL', `https://${FLY_APP_NAME}.fly.dev`);
    keyValue('Region', agent.region);

    console.log();
    info('View logs: fly logs -a ' + FLY_APP_NAME);
    info('View machines: fly machines list -a ' + FLY_APP_NAME);
    console.log();
  } catch (err) {
    spinner.stop();
    error(err instanceof Error ? err.message : 'Deployment failed');
    process.exit(1);
  }
}
