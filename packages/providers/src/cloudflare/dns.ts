/**
 * Cloudflare DNS Provider
 *
 * Implementation of IDNSProvider for Cloudflare DNS API.
 * https://developers.cloudflare.com/api/operations/dns-records-list-dns-records
 */

import type {
  IDNSProvider,
  DNSRecord,
  DNSRecordConfig,
} from '../interfaces/dns';

interface CloudflareResponse<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: T;
}

interface CloudflareRecord {
  id: string;
  name: string;
  type: string;
  content: string;
  ttl: number;
  proxied: boolean;
  created_on: string;
}

export class CloudflareDNSProvider implements IDNSProvider {
  private apiToken: string;
  private zoneId: string;
  private baseDomain: string;
  private baseUrl = 'https://api.cloudflare.com/client/v4';

  constructor(apiToken: string, zoneId: string, baseDomain: string) {
    this.apiToken = apiToken;
    this.zoneId = zoneId;
    this.baseDomain = baseDomain;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = (await response.json()) as CloudflareResponse<T>;

    if (!data.success) {
      const errorMessage = data.errors
        .map((e) => `${e.code}: ${e.message}`)
        .join(', ');
      throw new Error(`Cloudflare API error: ${errorMessage}`);
    }

    return data.result;
  }

  async createRecord(config: DNSRecordConfig): Promise<DNSRecord> {
    const fullName = `${config.name}.${this.baseDomain}`;

    const result = await this.request<CloudflareRecord>(
      'POST',
      `/zones/${this.zoneId}/dns_records`,
      {
        type: config.type,
        name: fullName,
        content: config.value,
        ttl: config.ttl ?? 1, // 1 = auto
        proxied: config.proxied ?? true,
      }
    );

    return this.mapRecord(result);
  }

  async getRecord(name: string): Promise<DNSRecord | null> {
    const fullName = `${name}.${this.baseDomain}`;

    const records = await this.request<CloudflareRecord[]>(
      'GET',
      `/zones/${this.zoneId}/dns_records?name=${encodeURIComponent(fullName)}`
    );

    if (records.length === 0) {
      return null;
    }

    return this.mapRecord(records[0]!);
  }

  async getRecordById(recordId: string): Promise<DNSRecord | null> {
    try {
      const record = await this.request<CloudflareRecord>(
        'GET',
        `/zones/${this.zoneId}/dns_records/${recordId}`
      );
      return this.mapRecord(record);
    } catch {
      return null;
    }
  }

  async updateRecord(recordId: string, value: string): Promise<DNSRecord> {
    const existing = await this.getRecordById(recordId);
    if (!existing) {
      throw new Error(`Record ${recordId} not found`);
    }

    const result = await this.request<CloudflareRecord>(
      'PATCH',
      `/zones/${this.zoneId}/dns_records/${recordId}`,
      { content: value }
    );

    return this.mapRecord(result);
  }

  async deleteRecord(recordId: string): Promise<void> {
    await this.request<{ id: string }>(
      'DELETE',
      `/zones/${this.zoneId}/dns_records/${recordId}`
    );
  }

  async listRecords(): Promise<DNSRecord[]> {
    const records = await this.request<CloudflareRecord[]>(
      'GET',
      `/zones/${this.zoneId}/dns_records?per_page=100`
    );

    return records.map((r) => this.mapRecord(r));
  }

  async isAvailable(name: string): Promise<boolean> {
    const record = await this.getRecord(name);
    return record === null;
  }

  private mapRecord(record: CloudflareRecord): DNSRecord {
    // Extract subdomain from full name
    const name = record.name.replace(`.${this.baseDomain}`, '');

    return {
      id: record.id,
      name,
      fullName: record.name,
      type: record.type as 'A' | 'AAAA' | 'CNAME',
      value: record.content,
      ttl: record.ttl,
      proxied: record.proxied,
      createdAt: new Date(record.created_on),
    };
  }
}
