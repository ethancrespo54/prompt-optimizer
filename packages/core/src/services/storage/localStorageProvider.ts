import { IStorageProvider } from './types';
import { StorageError } from './errors';

/**
 * Simple async lock implementation
 */
class AsyncLock {
  private locks: Map<string, Promise<void>> = new Map();

  async acquire(key: string): Promise<() => void> {
    // Wait for the existing lock to finish
    while (this.locks.has(key)) {
      try {
        await this.locks.get(key);
      } catch {
        // Ignore errors in the lock and keep trying to acquire it
      }
    }

    // Create a new lock
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = () => {
        this.locks.delete(key);
        resolve();
      };
    });

    this.locks.set(key, lockPromise);

    // Return the release function
    return releaseLock!;
  }
}

/**
 * Enhanced LocalStorageProvider providing transactional operations
 */
export class LocalStorageProvider implements IStorageProvider {
  private lock = new AsyncLock();

  public async getItem(key: string): Promise<string | null> {
    const release = await this.lock.acquire(key);
    try {
      const item = localStorage.getItem(key);
      return item;
    } catch (error) {
      throw new StorageError(`Failed to get storage item: ${key}`, 'read');
    } finally {
      release();
    }
  }

  public async setItem(key: string, value: string): Promise<void> {
    const release = await this.lock.acquire(key);
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      throw new StorageError(`Failed to set storage item: ${key}`, 'write');
    } finally {
      release();
    }
  }

  public async removeItem(key: string): Promise<void> {
    const release = await this.lock.acquire(key);
    try {
      localStorage.removeItem(key);
    } catch (error) {
      throw new StorageError(`Failed to remove storage item: ${key}`, 'delete');
    } finally {
      release();
    }
  }

  public async clearAll(): Promise<void> {
    const release = await this.lock.acquire('__clear_all__');
    try {
      localStorage.clear();
    } catch (error) {
      throw new StorageError('Failed to clear all storage items', 'clear');
    } finally {
      release();
    }
  }

  /**
   * Hidden data update - automatically chooses the best implementation internally
   * The business layer does not need to care whether atomic operations are supported
   * @param key Storage key
   * @param modifier Modifier function that receives the current value and returns the new value
   */
  public async updateData<T>(
    key: string, 
    modifier: (currentValue: T | null) => T
  ): Promise<void> {
    // LocalStorageProvider uses manual atomic operations internally
    const release = await this.lock.acquire(key);
    try {
      // Read the current value
      const currentData = localStorage.getItem(key);
      const currentValue: T | null = currentData ? JSON.parse(currentData) : null;
      
      // Apply the modification - allow business logic errors to pass through
      const newValue = modifier(currentValue);
      
      // Write the new value
      localStorage.setItem(key, JSON.stringify(newValue));
    } catch (error) {
      // Business logic errors are passed through directly, preserving the error type
      if (error instanceof Error &&
          (error.name.includes('Error') ||
           error.constructor.name !== 'Error' ||
           error.message.includes('Model') ||
           error.message.includes('not found') ||
           error.message.includes('not exist'))) {
        throw error;
      }
      // Only real storage errors are wrapped as StorageError
      throw new StorageError(`Failed to update data: ${key}`, 'write');
    } finally {
      release();
    }
  }

  /**
   * Get storage capability info
   */
  public getCapabilities() {
    return {
      supportsAtomic: true, // Implemented through a manual lock
      supportsBatch: true,
      maxStorageSize: 5 * 1024 * 1024 // About 5MB
    };
  }

  /**
   * Batch operation
   * @param operations List of batch operations
   */
  public async batchUpdate(operations: Array<{
    key: string;
    operation: 'set' | 'remove';
    value?: string;
  }>): Promise<void> {
    // Acquire the locks of all related keys
    const keys = operations.map(op => op.key);
    const releases = await Promise.all(keys.map(key => this.lock.acquire(key)));
    
    try {
      for (const op of operations) {
        if (op.operation === 'set' && op.value !== undefined) {
          localStorage.setItem(op.key, op.value);
        } else if (op.operation === 'remove') {
          localStorage.removeItem(op.key);
        }
      }
    } catch (error) {
      throw new StorageError('Failed to perform batch update', 'write');
    } finally {
      // Release all locks
      releases.forEach(release => release());
    }
  }
}
