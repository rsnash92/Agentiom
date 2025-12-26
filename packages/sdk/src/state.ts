/**
 * Agentiom SDK - State Manager
 *
 * Handles persistent state that survives agent sleep/wake cycles.
 * State is stored on the persistent volume and loaded on startup.
 *
 * @example
 * ```ts
 * // In your handler
 * const count = ctx.state.get('count') || 0;
 * ctx.state.set('count', count + 1);
 *
 * // Nested state
 * ctx.state.set('user.preferences.theme', 'dark');
 * const theme = ctx.state.get('user.preferences.theme');
 *
 * // Collections
 * ctx.state.push('messages', { text: 'Hello', time: Date.now() });
 * const messages = ctx.state.get('messages') || [];
 * ```
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';

export class StateManager {
  private data: Map<string, any> = new Map();
  private dirty: boolean = false;
  private statePath: string;
  private stateFile: string;
  private autoSaveInterval?: Timer;

  constructor(statePath: string = './state') {
    this.statePath = statePath;
    this.stateFile = `${statePath}/agent-state.json`;
  }

  /**
   * Load state from disk
   */
  async load(): Promise<void> {
    try {
      if (existsSync(this.stateFile)) {
        const content = await readFile(this.stateFile, 'utf-8');
        const parsed = JSON.parse(content);

        this.data = new Map(Object.entries(parsed));
        console.log(`📂 Loaded state (${this.data.size} keys)`);
      } else {
        console.log('📂 No existing state, starting fresh');
      }
    } catch (error) {
      console.error('Failed to load state:', error);
      this.data = new Map();
    }

    // Auto-save every 30 seconds if dirty
    this.autoSaveInterval = setInterval(() => {
      if (this.dirty) {
        this.save().catch(console.error);
      }
    }, 30000);
  }

  /**
   * Save state to disk
   */
  async save(): Promise<void> {
    if (!this.dirty && existsSync(this.stateFile)) {
      return; // No changes to save
    }

    try {
      // Ensure directory exists
      const dir = dirname(this.stateFile);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      // Convert Map to object for JSON serialization
      const obj: Record<string, any> = {};
      for (const [key, value] of this.data) {
        obj[key] = value;
      }

      await writeFile(this.stateFile, JSON.stringify(obj, null, 2), 'utf-8');
      this.dirty = false;

    } catch (error) {
      console.error('Failed to save state:', error);
      throw error;
    }
  }

  /**
   * Get a value from state
   * Supports dot notation for nested access: 'user.profile.name'
   */
  get<T = any>(key: string): T | undefined {
    // Handle dot notation
    if (key.includes('.')) {
      const parts = key.split('.');
      let current: any = this.data.get(parts[0]);

      for (let i = 1; i < parts.length; i++) {
        if (current === undefined || current === null) {
          return undefined;
        }
        current = current[parts[i]];
      }

      return current as T;
    }

    return this.data.get(key) as T;
  }

  /**
   * Set a value in state
   * Supports dot notation for nested access: 'user.profile.name'
   */
  set<T = any>(key: string, value: T): void {
    // Handle dot notation
    if (key.includes('.')) {
      const parts = key.split('.');
      const rootKey = parts[0];

      let root = this.data.get(rootKey) || {};
      let current = root;

      for (let i = 1; i < parts.length - 1; i++) {
        if (!(parts[i] in current)) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }

      current[parts[parts.length - 1]] = value;
      this.data.set(rootKey, root);
    } else {
      this.data.set(key, value);
    }

    this.dirty = true;
  }

  /**
   * Delete a value from state
   */
  delete(key: string): boolean {
    // Handle dot notation
    if (key.includes('.')) {
      const parts = key.split('.');
      const rootKey = parts[0];

      let root = this.data.get(rootKey);
      if (!root) return false;

      let current = root;
      for (let i = 1; i < parts.length - 1; i++) {
        if (!(parts[i] in current)) {
          return false;
        }
        current = current[parts[i]];
      }

      const deleted = delete current[parts[parts.length - 1]];
      this.data.set(rootKey, root);
      this.dirty = true;
      return deleted;
    }

    const deleted = this.data.delete(key);
    if (deleted) {
      this.dirty = true;
    }
    return deleted;
  }

  /**
   * Check if a key exists
   */
  has(key: string): boolean {
    if (key.includes('.')) {
      return this.get(key) !== undefined;
    }
    return this.data.has(key);
  }

  /**
   * Push a value to an array
   */
  push<T = any>(key: string, value: T): void {
    const arr = this.get<T[]>(key) || [];
    arr.push(value);
    this.set(key, arr);
  }

  /**
   * Remove and return the last element of an array
   */
  pop<T = any>(key: string): T | undefined {
    const arr = this.get<T[]>(key);
    if (!Array.isArray(arr) || arr.length === 0) {
      return undefined;
    }
    const value = arr.pop();
    this.set(key, arr);
    return value;
  }

  /**
   * Increment a numeric value
   */
  increment(key: string, by: number = 1): number {
    const current = this.get<number>(key) || 0;
    const newValue = current + by;
    this.set(key, newValue);
    return newValue;
  }

  /**
   * Decrement a numeric value
   */
  decrement(key: string, by: number = 1): number {
    return this.increment(key, -by);
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.data.keys());
  }

  /**
   * Get all entries
   */
  entries(): [string, any][] {
    return Array.from(this.data.entries());
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.data.clear();
    this.dirty = true;
  }

  /**
   * Get the size of the state
   */
  get size(): number {
    return this.data.size;
  }

  /**
   * Export state as a plain object
   */
  toJSON(): Record<string, any> {
    const obj: Record<string, any> = {};
    for (const [key, value] of this.data) {
      obj[key] = value;
    }
    return obj;
  }

  /**
   * Import state from a plain object
   */
  fromJSON(obj: Record<string, any>): void {
    this.data = new Map(Object.entries(obj));
    this.dirty = true;
  }

  /**
   * Create a scoped view of state (useful for namespacing)
   */
  scope(prefix: string): ScopedState {
    return new ScopedState(this, prefix);
  }

  /**
   * Stop auto-save interval
   */
  destroy(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
  }
}

/**
 * A scoped view of state with a prefix
 */
class ScopedState {
  constructor(
    private parent: StateManager,
    private prefix: string
  ) {}

  private prefixKey(key: string): string {
    return `${this.prefix}.${key}`;
  }

  get<T = any>(key: string): T | undefined {
    return this.parent.get(this.prefixKey(key));
  }

  set<T = any>(key: string, value: T): void {
    this.parent.set(this.prefixKey(key), value);
  }

  delete(key: string): boolean {
    return this.parent.delete(this.prefixKey(key));
  }

  has(key: string): boolean {
    return this.parent.has(this.prefixKey(key));
  }

  push<T = any>(key: string, value: T): void {
    this.parent.push(this.prefixKey(key), value);
  }

  increment(key: string, by: number = 1): number {
    return this.parent.increment(this.prefixKey(key), by);
  }
}
