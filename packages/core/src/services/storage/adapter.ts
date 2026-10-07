import { IStorageProvider } from './types';
import { StorageError } from './errors';

/**
 * Storage adapter - provides compatibility for storage providers that do not support the advanced methods
 * Hides the atomic operation implementation details so the business layer does not need to care
 */
export class StorageAdapter implements IStorageProvider {
  private locks: Map<string, Promise<void>> = new Map();

  constructor(private readonly baseProvider: IStorageProvider) {}

  // Basic methods are proxied directly
  async getItem(key: string): Promise<string | null> {
    return this.baseProvider.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    return this.baseProvider.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    return this.baseProvider.removeItem(key);
  }

  async clearAll(): Promise<void> {
    return this.baseProvider.clearAll();
  }

  /**
   * Hidden data update - atomicity is implemented internally
   */
  async updateData<T>(
    key: string, 
    modifier: (currentValue: T | null) => T
  ): Promise<void> {
    // If the base provider has an updateData method, use it directly
    if ('updateData' in this.baseProvider && typeof this.baseProvider.updateData === 'function') {
      return (this.baseProvider as any).updateData(key, modifier);
    }

    // Otherwise use the manually implemented atomic operation
    const release = await this.acquireLock(key);
    try {
      // Read the current value
      const currentData = await this.baseProvider.getItem(key);
      const currentValue: T | null = currentData ? JSON.parse(currentData) : null;
      
      // Apply the modification - business logic errors are passed through directly
      const newValue = modifier(currentValue);
      
      // Write the new value
      await this.baseProvider.setItem(key, JSON.stringify(newValue));
    } finally {
      release();
    }
  }

  /**
   * Batch update operation
   */
  async batchUpdate(operations: Array<{
    key: string;
    operation: 'set' | 'remove';
    value?: string;
  }>): Promise<void> {
    // If the base provider has a batchUpdate method, use it directly
    if ('batchUpdate' in this.baseProvider && typeof this.baseProvider.batchUpdate === 'function') {
      return (this.baseProvider as any).batchUpdate(operations);
    }

    // Otherwise execute the operations sequentially (simplified implementation)
    for (const op of operations) {
      if (op.operation === 'set' && op.value !== undefined) {
        await this.baseProvider.setItem(op.key, op.value);
      } else if (op.operation === 'remove') {
        await this.baseProvider.removeItem(op.key);
      }
    }
  }

  /**
   * Get storage capability info
   */
  getCapabilities() {
    // Capabilities of the base provider
    if ('getCapabilities' in this.baseProvider && typeof this.baseProvider.getCapabilities === 'function') {
      return (this.baseProvider as any).getCapabilities();
    }
    
    // Default capabilities
    return {
      supportsAtomic: true, // Implemented through the adapter
      supportsBatch: false,
      maxStorageSize: undefined
    };
  }

  /**
   * Improved async lock implementation
   * Uses a queue mechanism to avoid deadlocks and lock leaks
   */
  private async acquireLock(key: string): Promise<() => void> {
    // If a lock already exists, wait for it to finish
    const existingLock = this.locks.get(key);
    if (existingLock) {
      try {
        await existingLock;
      } catch (error) {
        // Ignore errors from the previous operation and continue acquiring the lock
      }
    }

    // Create a new lock
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve, reject) => {
      let released = false;
      
      releaseLock = () => {
        if (!released) {
          released = true;
          this.locks.delete(key);
          resolve();
        }
      };
      
      // Set a timeout to prevent deadlocks
      setTimeout(() => {
        if (!released) {
          released = true;
          this.locks.delete(key);
          reject(new StorageError(`Lock timeout for key: ${key}`, 'write'));
        }
      }, 30000); // 30-second timeout
    });
    
    this.locks.set(key, lockPromise);
    return releaseLock!;
  }
} 
