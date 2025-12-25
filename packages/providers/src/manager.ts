/**
 * Provider Manager
 *
 * Central class for managing all infrastructure providers.
 * This is the main entry point for accessing providers.
 */

import type { IComputeProvider } from './interfaces/compute';
import type { IStorageProvider } from './interfaces/storage';
import type { IDNSProvider } from './interfaces/dns';

export interface ProviderConfig {
  compute: ComputeProviderConfig;
  storage: StorageProviderConfig;
  dns: DNSProviderConfig;
}

export interface ComputeProviderConfig {
  provider: 'fly';
  apiToken: string;
  appName: string;
}

export interface StorageProviderConfig {
  provider: 'fly';
  apiToken: string;
  appName: string;
}

export interface DNSProviderConfig {
  provider: 'cloudflare';
  apiToken: string;
  zoneId: string;
  baseDomain: string;
}

/**
 * Provider Manager
 *
 * Manages compute, storage, and DNS providers.
 * Add new providers by implementing the interfaces and updating this class.
 */
export class ProviderManager {
  public readonly compute: IComputeProvider;
  public readonly storage: IStorageProvider;
  public readonly dns: IDNSProvider;

  constructor(config: ProviderConfig) {
    // Initialize compute provider
    this.compute = this.initComputeProvider(config.compute);

    // Initialize storage provider
    this.storage = this.initStorageProvider(config.storage);

    // Initialize DNS provider
    this.dns = this.initDNSProvider(config.dns);
  }

  private initComputeProvider(config: ComputeProviderConfig): IComputeProvider {
    switch (config.provider) {
      case 'fly':
        // Lazy import to avoid circular dependencies
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { FlyComputeProvider } = require('./fly/compute');
        return new FlyComputeProvider(config.apiToken, config.appName);
      default:
        throw new Error(`Unknown compute provider: ${config.provider}`);
    }
  }

  private initStorageProvider(config: StorageProviderConfig): IStorageProvider {
    switch (config.provider) {
      case 'fly':
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { FlyStorageProvider } = require('./fly/storage');
        return new FlyStorageProvider(config.apiToken, config.appName);
      default:
        throw new Error(`Unknown storage provider: ${config.provider}`);
    }
  }

  private initDNSProvider(config: DNSProviderConfig): IDNSProvider {
    switch (config.provider) {
      case 'cloudflare':
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { CloudflareDNSProvider } = require('./cloudflare/dns');
        return new CloudflareDNSProvider(
          config.apiToken,
          config.zoneId,
          config.baseDomain
        );
      default:
        throw new Error(`Unknown DNS provider: ${config.provider}`);
    }
  }
}

/**
 * Create a provider manager with the given configuration
 */
export function createProviders(config: ProviderConfig): ProviderManager {
  return new ProviderManager(config);
}
