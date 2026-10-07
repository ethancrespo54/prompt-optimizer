import type { IStorageProvider } from './types';

/**
 * In-memory storage provider
 * Used in Node.js environments (such as the Electron main process) and test environments
 * Data is only kept in memory and is lost when the app restarts
 */
export class MemoryStorageProvider implements IStorageProvider {
  private storage = new Map<string, string>();

  /**
   * Get a storage item
   * @param key Storage key
   * @returns The stored value or null
   */
  async getItem(key: string): Promise<string | null> {
    const value = this.storage.get(key);
    return value !== undefined ? value : null;
  }

  /**
   * Set a storage item
   * @param key Storage key
   * @param value Stored value
   */
  async setItem(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }

  /**
   * Delete a storage item
   * @param key Storage key
   */
  async removeItem(key: string): Promise<void> {
    this.storage.delete(key);
  }

  /**
   * Clear all storage items
   */
  async clearAll(): Promise<void> {
    this.storage.clear();
  }

  /**
   * Update data
   * @param key Storage key
   * @param modifier Modifier function
   */
  async updateData<T>(key: string, modifier: (currentValue: T | null) => T): Promise<void> {
    const currentValue = await this.getItem(key);
    const parsedValue = currentValue ? JSON.parse(currentValue) : null;
    const newValue = modifier(parsedValue);
    await this.setItem(key, JSON.stringify(newValue));
  }

  /**
   * Batch update
   * @param operations Array of operations
   */
  async batchUpdate(operations: Array<{
    key: string;
    operation: 'set' | 'remove';
    value?: string;
  }>): Promise<void> {
    for (const op of operations) {
      if (op.operation === 'set' && op.value !== undefined) {
        await this.setItem(op.key, op.value);
      } else if (op.operation === 'remove') {
        await this.removeItem(op.key);
      }
    }
  }

  /**
   * Get storage capabilities
   * @returns Storage capability info
   */
  getCapabilities() {
    return {
      supportsAtomic: true,
      supportsBatch: true,
      maxStorageSize: undefined // In-memory storage has no fixed limit
    };
  }

  /**
   * Get the number of storage items
   * @returns Number of storage items
   */
  get size(): number {
    return this.storage.size;
  }

  /**
   * Check whether the specified key is contained
   * @param key Storage key
   * @returns Whether the key is contained
   */
  has(key: string): boolean {
    return this.storage.has(key);
  }

  /**
   * Get all storage keys
   * @returns Array of all keys
   */
  getAllKeys(): string[] {
    return Array.from(this.storage.keys());
  }
} 