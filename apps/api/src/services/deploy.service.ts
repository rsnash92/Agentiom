/**
 * Deploy Service
 *
 * Orchestrates infrastructure providers for agent deployment.
 */

import { eq } from 'drizzle-orm';
import type { DatabaseClient } from '@agentiom/db';
import { deployments, agents } from '@agentiom/db';
import type {
  IComputeProvider,
  IStorageProvider,
  IDNSProvider,
  Machine,
  Volume,
  DNSRecord,
  LogEntry,
  LogOptions,
} from '@agentiom/providers';
import { FlyComputeProvider, FlyStorageProvider } from '@agentiom/providers';
import { ProviderError } from '@agentiom/shared';
import { createLogger } from '@agentiom/logger';
import type { Agent } from './agent.service';

const logger = createLogger('deploy-service');

// Use a simple Python image that exists on Docker Hub for testing
// TODO: Replace with custom agentiom/agent-base image when available
const AGENT_IMAGE = 'python:3.11-slim';
const BASE_DOMAIN = 'agentiom.dev';
const VOLUME_MOUNT_PATH = '/data';

export type Deployment = typeof deployments.$inferSelect;

export interface ProviderSet {
  compute: IComputeProvider;
  storage: IStorageProvider;
  dns: IDNSProvider;
}

export interface ProviderConfig {
  flyApiToken?: string;
  flyAppName?: string;
}

/**
 * Create real Fly.io providers if configured, otherwise mock DNS
 */
function createFlyProviders(config: ProviderConfig): ProviderSet | null {
  if (!config.flyApiToken || !config.flyAppName) {
    return null;
  }

  logger.info({ appName: config.flyAppName }, 'Using real Fly.io providers');

  return {
    compute: new FlyComputeProvider(config.flyApiToken, config.flyAppName),
    storage: new FlyStorageProvider(config.flyApiToken, config.flyAppName),
    // Use mock DNS for now (skip Cloudflare setup)
    dns: createMockDNS(),
  };
}

/**
 * Create mock DNS provider
 */
function createMockDNS(): IDNSProvider {
  return {
    async createRecord(config) {
      logger.info({ config }, '[MOCK DNS] Creating DNS record');
      return {
        id: `mock-dns-${Date.now()}`,
        name: config.name,
        fullName: `${config.name}.${BASE_DOMAIN}`,
        type: config.type,
        value: config.value,
        ttl: config.ttl ?? 300,
        proxied: config.proxied ?? false,
        createdAt: new Date(),
      };
    },
    async getRecord() {
      return null;
    },
    async getRecordById(recordId) {
      return {
        id: recordId,
        name: 'mock-record',
        fullName: `mock-record.${BASE_DOMAIN}`,
        type: 'CNAME' as const,
        value: 'mock.fly.dev',
        ttl: 300,
        proxied: false,
        createdAt: new Date(),
      };
    },
    async updateRecord(recordId, value) {
      return {
        id: recordId,
        name: 'mock-record',
        fullName: `mock-record.${BASE_DOMAIN}`,
        type: 'CNAME' as const,
        value,
        ttl: 300,
        proxied: false,
        createdAt: new Date(),
      };
    },
    async deleteRecord(recordId) {
      logger.info({ recordId }, '[MOCK DNS] Deleting DNS record');
    },
    async listRecords() {
      return [];
    },
    async isAvailable() {
      return true;
    },
  };
}

/**
 * Mock providers for local development without credentials
 */
function createMockProviders(): ProviderSet {
  const mockCompute: IComputeProvider = {
    async createMachine(config) {
      logger.info({ config }, '[MOCK] Creating machine');
      return {
        id: `mock-machine-${Date.now()}`,
        name: config.name,
        state: 'started',
        region: config.region,
        privateIp: '10.0.0.1',
        publicUrl: `https://${config.name}.fly.dev`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    async getMachine(machineId) {
      return {
        id: machineId,
        name: 'mock-machine',
        state: 'started',
        region: 'iad',
        privateIp: '10.0.0.1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    async listMachines() {
      return [];
    },
    async startMachine(machineId) {
      logger.info({ machineId }, '[MOCK] Starting machine');
      return {
        id: machineId,
        name: 'mock-machine',
        state: 'started',
        region: 'iad',
        privateIp: '10.0.0.1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    async stopMachine(machineId) {
      logger.info({ machineId }, '[MOCK] Stopping machine');
      return {
        id: machineId,
        name: 'mock-machine',
        state: 'stopped',
        region: 'iad',
        privateIp: '10.0.0.1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    async destroyMachine(machineId) {
      logger.info({ machineId }, '[MOCK] Destroying machine');
    },
    async execCommand() {
      return { exitCode: 0, stdout: '', stderr: '' };
    },
    async *streamLogs(): AsyncIterable<LogEntry> {
      yield {
        timestamp: new Date(),
        level: 'info',
        message: '[MOCK] Agent logs would appear here',
      };
    },
    async waitForState(machineId, state) {
      return {
        id: machineId,
        name: 'mock-machine',
        state,
        region: 'iad',
        privateIp: '10.0.0.1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
  };

  const mockStorage: IStorageProvider = {
    async createVolume(config) {
      logger.info({ config }, '[MOCK] Creating volume');
      return {
        id: `mock-volume-${Date.now()}`,
        name: config.name,
        region: config.region,
        sizeGb: config.sizeGb,
        state: 'created',
        createdAt: new Date(),
      };
    },
    async getVolume(volumeId) {
      return {
        id: volumeId,
        name: 'mock-volume',
        region: 'iad',
        sizeGb: 1,
        state: 'attached',
        createdAt: new Date(),
      };
    },
    async listVolumes() {
      return [];
    },
    async extendVolume(volumeId, newSizeGb) {
      return {
        id: volumeId,
        name: 'mock-volume',
        region: 'iad',
        sizeGb: newSizeGb,
        state: 'attached',
        createdAt: new Date(),
      };
    },
    async deleteVolume(volumeId) {
      logger.info({ volumeId }, '[MOCK] Deleting volume');
    },
    async snapshotVolume() {
      return `mock-snapshot-${Date.now()}`;
    },
  };

  const mockDNS: IDNSProvider = {
    async createRecord(config) {
      logger.info({ config }, '[MOCK] Creating DNS record');
      return {
        id: `mock-dns-${Date.now()}`,
        name: config.name,
        fullName: `${config.name}.${BASE_DOMAIN}`,
        type: config.type,
        value: config.value,
        ttl: config.ttl ?? 300,
        proxied: config.proxied ?? false,
        createdAt: new Date(),
      };
    },
    async getRecord() {
      return null;
    },
    async getRecordById(recordId) {
      return {
        id: recordId,
        name: 'mock-record',
        fullName: `mock-record.${BASE_DOMAIN}`,
        type: 'CNAME' as const,
        value: 'mock.fly.dev',
        ttl: 300,
        proxied: false,
        createdAt: new Date(),
      };
    },
    async updateRecord(recordId, value) {
      return {
        id: recordId,
        name: 'mock-record',
        fullName: `mock-record.${BASE_DOMAIN}`,
        type: 'CNAME' as const,
        value,
        ttl: 300,
        proxied: false,
        createdAt: new Date(),
      };
    },
    async deleteRecord(recordId) {
      logger.info({ recordId }, '[MOCK] Deleting DNS record');
    },
    async listRecords() {
      return [];
    },
    async isAvailable() {
      return true;
    },
  };

  return {
    compute: mockCompute,
    storage: mockStorage,
    dns: mockDNS,
  };
}

export class DeployService {
  public providers: ProviderSet;
  private isMock: boolean;
  private flyAppName?: string;

  constructor(
    private db: DatabaseClient,
    config?: ProviderConfig
  ) {
    // Try to create real Fly.io providers
    const flyProviders = config ? createFlyProviders(config) : null;

    if (flyProviders) {
      this.providers = flyProviders;
      this.isMock = false;
      this.flyAppName = config?.flyAppName;
    } else {
      // Use mock providers if no real providers configured
      logger.warn('No Fly.io credentials configured, using mock providers');
      this.providers = createMockProviders();
      this.isMock = true;
    }
  }

  /**
   * Deploy an agent
   */
  async deploy(agent: Agent, userId: string): Promise<{ deployment: Deployment; agent: Agent }> {
    logger.info({ agentId: agent.id, userId }, 'Starting deployment');

    // Create deployment record
    const [deployment] = await this.db
      .insert(deployments)
      .values({
        agentId: agent.id,
        userId,
        status: 'pending',
        configSnapshot: agent.config,
      })
      .returning();

    if (!deployment) {
      throw new Error('Failed to create deployment record');
    }

    try {
      // Update agent status
      await this.updateAgentStatus(agent.id, 'deploying');
      await this.updateDeploymentStatus(deployment.id, 'building');

      // Step 1: Create volume if not exists
      let volumeId = agent.volumeId;
      if (!volumeId) {
        const volume = await this.createVolume(agent);
        volumeId = volume.id;
        await this.db
          .update(agents)
          .set({ volumeId, updatedAt: new Date() })
          .where(eq(agents.id, agent.id));
      }

      // Step 2: Create machine
      await this.updateDeploymentStatus(deployment.id, 'deploying');
      const machine = await this.createMachine(agent, volumeId);

      // Step 3: Create DNS record if not exists
      let dnsRecordId = agent.dnsRecordId;
      let url = agent.url;
      if (!dnsRecordId) {
        const dnsRecord = await this.createDNSRecord(agent, machine);
        dnsRecordId = dnsRecord.id;
        url = `https://${dnsRecord.fullName}`;
      }

      // Update agent with infrastructure IDs
      const [updatedAgent] = await this.db
        .update(agents)
        .set({
          machineId: machine.id,
          volumeId,
          dnsRecordId,
          url,
          status: 'running',
          lastDeployedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(agents.id, agent.id))
        .returning();

      // Update deployment status
      await this.db
        .update(deployments)
        .set({
          status: 'success',
          imageTag: AGENT_IMAGE,
          completedAt: new Date(),
        })
        .where(eq(deployments.id, deployment.id));

      const [finalDeployment] = await this.db
        .select()
        .from(deployments)
        .where(eq(deployments.id, deployment.id));

      logger.info(
        { agentId: agent.id, deploymentId: deployment.id, isMock: this.isMock },
        'Deployment completed'
      );

      return {
        deployment: finalDeployment!,
        agent: updatedAgent!,
      };
    } catch (error) {
      logger.error({ agentId: agent.id, error }, 'Deployment failed');

      // Update deployment status
      await this.db
        .update(deployments)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined,
          completedAt: new Date(),
        })
        .where(eq(deployments.id, deployment.id));

      // Update agent status
      await this.updateAgentStatus(agent.id, 'error');

      throw error;
    }
  }

  /**
   * Start a stopped agent
   */
  async start(agent: Agent): Promise<Agent> {
    logger.info({ agentId: agent.id }, 'Starting agent');

    if (!agent.machineId) {
      throw new ProviderError('compute', 'Agent has no machine to start');
    }

    if (agent.status !== 'stopped') {
      throw new ProviderError('compute', `Cannot start agent in ${agent.status} state`);
    }

    try {
      await this.providers.compute.startMachine(agent.machineId);

      const [updated] = await this.db
        .update(agents)
        .set({
          status: 'running',
          updatedAt: new Date(),
        })
        .where(eq(agents.id, agent.id))
        .returning();

      logger.info({ agentId: agent.id }, 'Agent started');

      return updated!;
    } catch (error) {
      logger.error({ agentId: agent.id, error }, 'Failed to start agent');
      throw new ProviderError(
        'compute',
        `Failed to start agent: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Stop a running agent
   */
  async stop(agent: Agent): Promise<Agent> {
    logger.info({ agentId: agent.id }, 'Stopping agent');

    if (!agent.machineId) {
      throw new ProviderError('compute', 'Agent has no machine to stop');
    }

    if (agent.status !== 'running') {
      throw new ProviderError('compute', `Cannot stop agent in ${agent.status} state`);
    }

    try {
      await this.providers.compute.stopMachine(agent.machineId);

      const [updated] = await this.db
        .update(agents)
        .set({
          status: 'stopped',
          updatedAt: new Date(),
        })
        .where(eq(agents.id, agent.id))
        .returning();

      logger.info({ agentId: agent.id }, 'Agent stopped');

      return updated!;
    } catch (error) {
      logger.error({ agentId: agent.id, error }, 'Failed to stop agent');
      throw new ProviderError(
        'compute',
        `Failed to stop agent: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Destroy an agent's infrastructure
   */
  async destroy(agent: Agent): Promise<void> {
    logger.info({ agentId: agent.id }, 'Destroying agent infrastructure');

    const errors: string[] = [];

    // Destroy machine
    if (agent.machineId) {
      try {
        await this.providers.compute.destroyMachine(agent.machineId);
      } catch (error) {
        errors.push(`Machine: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Delete DNS record
    if (agent.dnsRecordId) {
      try {
        await this.providers.dns.deleteRecord(agent.dnsRecordId);
      } catch (error) {
        errors.push(`DNS: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Delete volume
    if (agent.volumeId) {
      try {
        await this.providers.storage.deleteVolume(agent.volumeId);
      } catch (error) {
        errors.push(`Volume: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Update agent status
    await this.db
      .update(agents)
      .set({
        status: 'destroyed',
        machineId: null,
        volumeId: null,
        dnsRecordId: null,
        url: null,
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agent.id));

    if (errors.length > 0) {
      logger.warn({ agentId: agent.id, errors }, 'Some resources failed to destroy');
    }

    logger.info({ agentId: agent.id }, 'Agent infrastructure destroyed');
  }

  /**
   * Get logs from agent
   */
  async *getLogs(agent: Agent, options?: LogOptions): AsyncIterable<LogEntry> {
    if (!agent.machineId) {
      yield {
        timestamp: new Date(),
        level: 'warn',
        message: 'Agent has no machine - no logs available',
      };
      return;
    }

    yield* this.providers.compute.streamLogs(agent.machineId, options);
  }

  private async createVolume(agent: Agent): Promise<Volume> {
    logger.info({ agentId: agent.id }, 'Creating volume');

    // Fly.io volume names only allow lowercase alphanumeric and underscores
    const volumeName = `vol_${agent.slug.replace(/-/g, '_')}`;

    return this.providers.storage.createVolume({
      name: volumeName,
      region: agent.region,
      sizeGb: agent.storageSizeGb,
    });
  }

  private async createMachine(agent: Agent, volumeId: string): Promise<Machine> {
    logger.info({ agentId: agent.id }, 'Creating machine');

    const config = (agent.config as Record<string, unknown>) ?? {};
    const env = (config.env as Record<string, string>) ?? {};

    return this.providers.compute.createMachine({
      name: agent.slug,
      image: AGENT_IMAGE,
      region: agent.region,
      size: {
        cpuKind: agent.cpuKind as 'shared' | 'dedicated',
        cpus: agent.cpus,
        memoryMb: agent.memoryMb,
      },
      env: {
        AGENT_ID: agent.id,
        AGENT_NAME: agent.name,
        AGENT_SLUG: agent.slug,
        AGENTIOM_STATE_PATH: VOLUME_MOUNT_PATH,  // Tell SDK where to persist state
        AGENTIOM_AGENT_NAME: agent.name,
        ...env,
      },
      volumeMounts: [
        {
          volumeId,
          path: VOLUME_MOUNT_PATH,
        },
      ],
    });
  }

  private async createDNSRecord(agent: Agent, machine: Machine): Promise<DNSRecord> {
    logger.info({ agentId: agent.id }, 'Creating DNS record');

    // For real Fly.io, use the app's fly.dev URL
    // Machine doesn't have a direct public URL, the app does
    const targetUrl = this.flyAppName
      ? `${this.flyAppName}.fly.dev`
      : (machine.publicUrl ?? `${agent.slug}.fly.dev`);

    return this.providers.dns.createRecord({
      name: agent.slug,
      type: 'CNAME',
      value: targetUrl,
      proxied: true,
    });
  }

  /**
   * Get the public URL for an agent
   */
  private getAgentUrl(agent: Agent): string {
    // When using real Fly.io, the URL is based on the app name
    if (!this.isMock && this.flyAppName) {
      return `https://${this.flyAppName}.fly.dev`;
    }
    // Mock URL
    return `https://${agent.slug}.${BASE_DOMAIN}`;
  }

  private async updateAgentStatus(agentId: string, status: Agent['status']): Promise<void> {
    await this.db
      .update(agents)
      .set({ status, updatedAt: new Date() })
      .where(eq(agents.id, agentId));
  }

  private async updateDeploymentStatus(
    deploymentId: string,
    status: Deployment['status']
  ): Promise<void> {
    await this.db
      .update(deployments)
      .set({ status })
      .where(eq(deployments.id, deploymentId));
  }
}
