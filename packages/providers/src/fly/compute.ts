/**
 * Fly.io Compute Provider
 *
 * Implementation of IComputeProvider for Fly.io Machines API.
 * https://fly.io/docs/machines/api/
 */

import type {
  IComputeProvider,
  Machine,
  MachineConfig,
  MachineState,
  ExecResult,
  LogEntry,
  LogOptions,
} from '../interfaces/compute';
import { FlyClient, FlyApiError } from './client';

export class FlyComputeProvider implements IComputeProvider {
  private client: FlyClient;
  private appName: string;

  constructor(apiToken: string, appName: string) {
    this.client = new FlyClient(apiToken);
    this.appName = appName;
  }

  async createMachine(config: MachineConfig): Promise<Machine> {
    const response = await this.client.post(`/apps/${this.appName}/machines`, {
      name: config.name,
      region: config.region,
      config: {
        image: config.image,
        env: config.env,
        guest: {
          cpu_kind: config.size.cpuKind,
          cpus: config.size.cpus,
          memory_mb: config.size.memoryMb,
        },
        mounts: config.volumeMounts?.map((m) => ({
          volume: m.volumeId,
          path: m.path,
        })),
        services: [
          {
            ports: [
              { port: 443, handlers: ['tls', 'http'] },
              { port: 80, handlers: ['http'] },
            ],
            protocol: 'tcp',
            internal_port: 8080,
          },
        ],
      },
    });

    return this.mapMachine(response);
  }

  async getMachine(machineId: string): Promise<Machine | null> {
    try {
      const response = await this.client.get(
        `/apps/${this.appName}/machines/${machineId}`
      );
      return this.mapMachine(response);
    } catch (error) {
      if (error instanceof FlyApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async listMachines(): Promise<Machine[]> {
    const response = await this.client.get(`/apps/${this.appName}/machines`);
    return (response as unknown[]).map((m: unknown) => this.mapMachine(m));
  }

  async startMachine(machineId: string): Promise<Machine> {
    await this.client.post(
      `/apps/${this.appName}/machines/${machineId}/start`
    );
    return this.waitForState(machineId, 'started');
  }

  async stopMachine(machineId: string): Promise<Machine> {
    await this.client.post(
      `/apps/${this.appName}/machines/${machineId}/stop`
    );
    return this.waitForState(machineId, 'stopped');
  }

  async destroyMachine(machineId: string): Promise<void> {
    await this.client.delete(
      `/apps/${this.appName}/machines/${machineId}`,
      { force: true }
    );
  }

  async execCommand(machineId: string, command: string[]): Promise<ExecResult> {
    const response = await this.client.post(
      `/apps/${this.appName}/machines/${machineId}/exec`,
      { command }
    ) as { exit_code: number; stdout?: string; stderr?: string };

    return {
      exitCode: response.exit_code,
      stdout: response.stdout ?? '',
      stderr: response.stderr ?? '',
    };
  }

  async *streamLogs(
    machineId: string,
    options?: LogOptions
  ): AsyncIterable<LogEntry> {
    // For non-streaming requests, use the GraphQL API for recent logs
    if (!options?.follow) {
      const logs = await this.fetchRecentLogs(machineId);
      for (const log of logs) {
        yield log;
      }
      return;
    }

    // For streaming/follow mode, use the NATS-based machine logs endpoint
    const params = new URLSearchParams();
    if (options?.since) {
      params.set('since', options.since.toISOString());
    }

    const stream = await this.client.stream(
      `/apps/${this.appName}/machines/${machineId}/logs?${params}`
    );

    for await (const line of stream) {
      if (line.trim()) {
        yield this.parseLogEntry(line);
      }
    }
  }

  /**
   * Fetch recent logs via Fly.io GraphQL API
   */
  private async fetchRecentLogs(machineId: string): Promise<LogEntry[]> {
    const query = `
      query GetAppLogs($appName: String!, $instanceId: String) {
        app(name: $appName) {
          logs(instance: $instanceId, limit: 50) {
            nodes {
              timestamp
              level
              message
              instance
            }
          }
        }
      }
    `;

    try {
      const response = await fetch('https://api.fly.io/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.client['token']}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: {
            appName: this.appName,
            instanceId: machineId,
          },
        }),
      });

      if (!response.ok) {
        console.error(`GraphQL logs request failed: ${response.status}`);
        return this.getFallbackLogs(machineId);
      }

      const data = await response.json() as {
        data?: {
          app?: {
            logs?: {
              nodes?: Array<{
                timestamp: string;
                level: string;
                message: string;
                instance: string;
              }>;
            };
          };
        };
        errors?: Array<{ message: string }>;
      };

      if (data.errors) {
        console.error('GraphQL errors:', data.errors);
        return this.getFallbackLogs(machineId);
      }

      const nodes = data.data?.app?.logs?.nodes ?? [];

      return nodes.map((node) => ({
        timestamp: new Date(node.timestamp),
        level: node.level?.toLowerCase() || 'info',
        message: node.message,
      }));
    } catch (error) {
      console.error('Error fetching logs via GraphQL:', error);
      return this.getFallbackLogs(machineId);
    }
  }

  /**
   * Fallback logs when API fails
   */
  private async getFallbackLogs(machineId: string): Promise<LogEntry[]> {
    // Get machine status to provide some context
    const machine = await this.getMachine(machineId);
    const status = machine?.state || 'unknown';

    return [
      {
        timestamp: new Date(),
        level: 'info',
        message: `Machine ${machineId} is ${status}. Logs will appear when the agent outputs to stdout/stderr.`,
      },
    ];
  }

  async waitForState(
    machineId: string,
    targetState: MachineState,
    timeoutMs = 60000
  ): Promise<Machine> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const machine = await this.getMachine(machineId);
      if (!machine) {
        throw new Error(`Machine ${machineId} not found`);
      }
      if (machine.state === targetState) {
        return machine;
      }

      // Wait 1 second before polling again
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(
      `Timeout waiting for machine ${machineId} to reach state ${targetState}`
    );
  }

  private mapMachine(data: unknown): Machine {
    const d = data as Record<string, unknown>;
    return {
      id: d.id as string,
      name: d.name as string,
      state: d.state as MachineState,
      region: d.region as string,
      privateIp: d.private_ip as string,
      createdAt: new Date(d.created_at as string),
      updatedAt: new Date(d.updated_at as string),
    };
  }

  private parseLogEntry(line: string): LogEntry {
    try {
      const data = JSON.parse(line);
      return {
        timestamp: new Date(data.timestamp),
        level: data.level || 'info',
        message: data.message,
      };
    } catch {
      // If not JSON, return as plain message
      return {
        timestamp: new Date(),
        level: 'info',
        message: line,
      };
    }
  }
}
