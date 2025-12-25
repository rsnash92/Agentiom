/**
 * Fly.io Storage Provider
 *
 * Implementation of IStorageProvider for Fly.io Volumes.
 * https://fly.io/docs/volumes/
 */

import type {
  IStorageProvider,
  Volume,
  VolumeConfig,
  VolumeState,
} from '../interfaces/storage';
import { FlyClient, FlyApiError } from './client';

export class FlyStorageProvider implements IStorageProvider {
  private client: FlyClient;
  private appName: string;

  constructor(apiToken: string, appName: string) {
    this.client = new FlyClient(apiToken);
    this.appName = appName;
  }

  async createVolume(config: VolumeConfig): Promise<Volume> {
    const response = await this.client.post(`/apps/${this.appName}/volumes`, {
      name: config.name,
      region: config.region,
      size_gb: config.sizeGb,
    });

    return this.mapVolume(response);
  }

  async getVolume(volumeId: string): Promise<Volume | null> {
    try {
      const response = await this.client.get(
        `/apps/${this.appName}/volumes/${volumeId}`
      );
      return this.mapVolume(response);
    } catch (error) {
      if (error instanceof FlyApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async listVolumes(): Promise<Volume[]> {
    const response = await this.client.get(`/apps/${this.appName}/volumes`);
    return (response as unknown[]).map((v) => this.mapVolume(v));
  }

  async extendVolume(volumeId: string, newSizeGb: number): Promise<Volume> {
    const response = await this.client.put(
      `/apps/${this.appName}/volumes/${volumeId}/extend`,
      { size_gb: newSizeGb }
    );
    return this.mapVolume(response);
  }

  async deleteVolume(volumeId: string): Promise<void> {
    await this.client.delete(`/apps/${this.appName}/volumes/${volumeId}`);
  }

  async snapshotVolume(volumeId: string): Promise<string> {
    const response = await this.client.post(
      `/apps/${this.appName}/volumes/${volumeId}/snapshots`
    );
    return (response as { id: string }).id;
  }

  private mapVolume(data: unknown): Volume {
    const d = data as Record<string, unknown>;
    return {
      id: d.id as string,
      name: d.name as string,
      region: d.region as string,
      sizeGb: d.size_gb as number,
      state: this.mapState(d.state as string),
      attachedMachineId: d.attached_machine_id as string | undefined,
      createdAt: new Date(d.created_at as string),
    };
  }

  private mapState(state: string): VolumeState {
    switch (state) {
      case 'created':
      case 'attached':
      case 'detached':
      case 'destroying':
      case 'destroyed':
        return state;
      default:
        return 'created';
    }
  }
}
