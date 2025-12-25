/**
 * @agentiom/providers
 *
 * Infrastructure provider abstraction layer.
 * This package allows swapping infrastructure providers without changing application code.
 *
 * @example
 * ```typescript
 * import { createProviders } from '@agentiom/providers';
 *
 * const providers = createProviders({
 *   compute: { provider: 'fly', apiToken: '...', appName: 'agentiom-agents' },
 *   storage: { provider: 'fly', apiToken: '...', appName: 'agentiom-agents' },
 *   dns: { provider: 'cloudflare', apiToken: '...', zoneId: '...', baseDomain: 'agentiom.dev' },
 * });
 *
 * // Create a machine
 * const machine = await providers.compute.createMachine({
 *   name: 'my-agent',
 *   image: 'agentiom/agent-base:latest',
 *   region: 'iad',
 *   size: { cpuKind: 'shared', cpus: 1, memoryMb: 256 },
 *   env: { AGENT_NAME: 'my-agent' },
 * });
 * ```
 */

// Re-export interfaces
export * from './interfaces';

// Re-export manager
export { ProviderManager, createProviders } from './manager';
export type {
  ProviderConfig,
  ComputeProviderConfig,
  StorageProviderConfig,
  DNSProviderConfig,
} from './manager';

// Re-export provider implementations (for direct use if needed)
export { FlyComputeProvider } from './fly/compute';
export { FlyStorageProvider } from './fly/storage';
// export { CloudflareDNSProvider } from './cloudflare/dns';
