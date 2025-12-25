/**
 * Storage Provider Interface
 *
 * This interface abstracts persistent storage (volumes).
 * Current implementation: Fly.io Volumes
 * Future: AWS EBS, GCP Persistent Disks, own storage
 */

export interface VolumeConfig {
  /** Unique name for the volume */
  name: string;
  /** Region to create in (must match machine region) */
  region: string;
  /** Size in GB */
  sizeGb: number;
}

export interface Volume {
  /** Unique volume ID */
  id: string;
  /** Volume name */
  name: string;
  /** Region */
  region: string;
  /** Size in GB */
  sizeGb: number;
  /** Current state */
  state: VolumeState;
  /** Machine ID if attached */
  attachedMachineId?: string;
  /** Created timestamp */
  createdAt: Date;
}

export type VolumeState =
  | 'created'
  | 'attached'
  | 'detached'
  | 'destroying'
  | 'destroyed';

/**
 * Storage Provider Interface
 *
 * Implement this interface to add a new storage provider.
 */
export interface IStorageProvider {
  /**
   * Create a new persistent volume
   */
  createVolume(config: VolumeConfig): Promise<Volume>;

  /**
   * Get volume by ID
   * @returns null if not found
   */
  getVolume(volumeId: string): Promise<Volume | null>;

  /**
   * List all volumes for the current app/project
   */
  listVolumes(): Promise<Volume[]>;

  /**
   * Extend volume size
   * Note: Most providers only support increasing size, not decreasing
   */
  extendVolume(volumeId: string, newSizeGb: number): Promise<Volume>;

  /**
   * Delete a volume permanently
   * Note: Volume must be detached first
   */
  deleteVolume(volumeId: string): Promise<void>;

  /**
   * Create a snapshot of a volume
   * @returns Snapshot ID
   */
  snapshotVolume(volumeId: string): Promise<string>;
}
