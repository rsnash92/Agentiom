/**
 * Compute Provider Interface
 *
 * This interface abstracts the compute layer (containers/VMs).
 * Current implementation: Fly.io Machines
 * Future: AWS ECS, GCP Cloud Run, own infrastructure
 */

export interface MachineConfig {
  /** Unique name for the machine */
  name: string;
  /** Docker image to run */
  image: string;
  /** Region to deploy to */
  region: string;
  /** Resource allocation */
  size: MachineSize;
  /** Environment variables */
  env: Record<string, string>;
  /** Volumes to mount */
  volumeMounts?: VolumeMount[];
}

export interface MachineSize {
  /** CPU type */
  cpuKind: 'shared' | 'dedicated';
  /** Number of CPUs */
  cpus: number;
  /** Memory in MB */
  memoryMb: number;
}

export interface VolumeMount {
  /** Volume ID to mount */
  volumeId: string;
  /** Path to mount at */
  path: string;
}

export interface Machine {
  /** Unique machine ID */
  id: string;
  /** Machine name */
  name: string;
  /** Current state */
  state: MachineState;
  /** Region deployed to */
  region: string;
  /** Private IP address */
  privateIp: string;
  /** Public URL (if exposed) */
  publicUrl?: string;
  /** Created timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
}

export type MachineState =
  | 'created'
  | 'starting'
  | 'started'
  | 'stopping'
  | 'stopped'
  | 'destroying'
  | 'destroyed';

export interface ExecResult {
  /** Exit code of the command */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
}

export interface LogOptions {
  /** Only return logs after this timestamp */
  since?: Date;
  /** Follow logs (stream) */
  follow?: boolean;
}

export interface LogEntry {
  /** Log timestamp */
  timestamp: Date;
  /** Log level */
  level: string;
  /** Log message */
  message: string;
}

/**
 * Compute Provider Interface
 *
 * Implement this interface to add a new compute provider.
 * All methods should be idempotent where possible.
 */
export interface IComputeProvider {
  /**
   * Create a new machine (container/VM)
   */
  createMachine(config: MachineConfig): Promise<Machine>;

  /**
   * Get machine by ID
   * @returns null if not found
   */
  getMachine(machineId: string): Promise<Machine | null>;

  /**
   * List all machines for the current app/project
   */
  listMachines(): Promise<Machine[]>;

  /**
   * Start a stopped machine
   */
  startMachine(machineId: string): Promise<Machine>;

  /**
   * Stop a running machine (preserves state)
   */
  stopMachine(machineId: string): Promise<Machine>;

  /**
   * Destroy a machine permanently
   */
  destroyMachine(machineId: string): Promise<void>;

  /**
   * Execute a command in a running machine
   */
  execCommand(machineId: string, command: string[]): Promise<ExecResult>;

  /**
   * Stream logs from a machine
   */
  streamLogs(machineId: string, options?: LogOptions): AsyncIterable<LogEntry>;

  /**
   * Wait for machine to reach a specific state
   * @throws if timeout is reached
   */
  waitForState(
    machineId: string,
    state: MachineState,
    timeoutMs?: number
  ): Promise<Machine>;
}
