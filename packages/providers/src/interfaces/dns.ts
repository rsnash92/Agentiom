/**
 * DNS Provider Interface
 *
 * This interface abstracts DNS management.
 * Current implementation: Cloudflare
 * Future: Route53, own DNS
 */

export interface DNSRecordConfig {
  /** Subdomain name (e.g., "my-agent" for my-agent.agentiom.dev) */
  name: string;
  /** Record type */
  type: 'A' | 'AAAA' | 'CNAME';
  /** Target value (IP or hostname) */
  value: string;
  /** TTL in seconds (optional, defaults to auto) */
  ttl?: number;
  /** Whether to proxy through CDN (Cloudflare specific) */
  proxied?: boolean;
}

export interface DNSRecord {
  /** Record ID */
  id: string;
  /** Subdomain name */
  name: string;
  /** Full domain name */
  fullName: string;
  /** Record type */
  type: 'A' | 'AAAA' | 'CNAME';
  /** Target value */
  value: string;
  /** TTL in seconds */
  ttl: number;
  /** Whether proxied */
  proxied: boolean;
  /** Created timestamp */
  createdAt: Date;
}

/**
 * DNS Provider Interface
 *
 * Implement this interface to add a new DNS provider.
 */
export interface IDNSProvider {
  /**
   * Create a DNS record
   */
  createRecord(config: DNSRecordConfig): Promise<DNSRecord>;

  /**
   * Get record by subdomain name
   * @returns null if not found
   */
  getRecord(name: string): Promise<DNSRecord | null>;

  /**
   * Get record by ID
   * @returns null if not found
   */
  getRecordById(recordId: string): Promise<DNSRecord | null>;

  /**
   * Update a DNS record
   */
  updateRecord(recordId: string, value: string): Promise<DNSRecord>;

  /**
   * Delete a DNS record
   */
  deleteRecord(recordId: string): Promise<void>;

  /**
   * List all DNS records
   */
  listRecords(): Promise<DNSRecord[]>;

  /**
   * Check if a subdomain is available
   */
  isAvailable(name: string): Promise<boolean>;
}
