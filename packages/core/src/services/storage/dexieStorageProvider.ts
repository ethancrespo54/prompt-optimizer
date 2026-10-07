import Dexie, { type Table } from 'dexie';
import { IStorageProvider } from './types';
import { StorageError } from './errors';

/**
 * Table interface definition
 */
interface StorageRecord {
  key: string;
  value: string;
  timestamp?: number;
}

/**
 * Get the database name
 *
 * Priority:
 * 1. Test environment: use the injected unique database name (window.__TEST_DB_NAME__)
 * 2. Production environment: use the fixed name 'PromptOptimizerDB'
 */
function getDatabaseName(): string {
  // Test environment: read the test database name from the window object
  if (typeof window !== 'undefined') {
    const testDbName = (window as any).__TEST_DB_NAME__;
    if (testDbName) {
      return testDbName;
    }
  }

  // Production environment: use the fixed name
  return 'PromptOptimizerDB';
}

/**
 * Dexie database class
 */
class PromptOptimizerDB extends Dexie {
  storage!: Table<StorageRecord, string>;

  constructor() {
    super(getDatabaseName());

    // Define the database structure
    this.version(1).stores({
      storage: 'key, value, timestamp'
    });
  }
}

/**
 * Storage provider implementation based on Dexie
 * 
 * Advantages over LocalStorageProvider:
 * - Larger storage capacity (several GB vs 5MB)
 * - Native transaction support, better concurrency safety
 * - Async operations that do not block the UI
 * - Better query performance
 */
export class DexieStorageProvider implements IStorageProvider {
  private db: PromptOptimizerDB;
  private dbOpened: Promise<void>;
  
  // Lock mechanism for atomic operations
  private keyLocks = new Map<string, Promise<void>>();

  constructor() {
    this.db = new PromptOptimizerDB();
    this.dbOpened = this.db.open().then(() => undefined).catch((error) => {
      console.error('Failed to open Dexie database:', error);
      // Throw an error so that all subsequent operations fail
      throw error;
    });
  }

  /**
   * Ensure the database is open
   */
  private async initialize(): Promise<void> {
    await this.dbOpened;
  }

  /**
   * Reset the migration state (mainly for testing)
   */
  static resetMigrationState(): void {
    // The migration logic has been removed, so this function is no longer needed
    // Kept as an empty function to avoid breaking the test API
  }

  /**
   * Get a storage item
   */
  async getItem(key: string): Promise<string | null> {
    await this.initialize();
    
    try {
      const record = await this.db.storage.get(key);
      return record?.value ?? null;
    } catch (error) {
      console.error(`Failed to get storage item (${key}):`, error);
      throw new StorageError(`Failed to get item: ${key}`, 'read');
    }
  }

  /**
   * Set a storage item
   */
  async setItem(key: string, value: string): Promise<void> {
    await this.initialize();
    
    try {
      await this.db.storage.put({
        key,
        value,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`Failed to set storage item (${key}):`, error);
      throw new StorageError(`Failed to set item: ${key}`, 'write');
    }
  }

  /**
   * Delete a storage item
   */
  async removeItem(key: string): Promise<void> {
    await this.initialize();
    
    try {
      await this.db.storage.delete(key);
    } catch (error) {
      console.error(`Failed to delete storage item (${key}):`, error);
      throw new StorageError(`Failed to remove item: ${key}`, 'delete');
    }
  }

  /**
   * Clear all storage
   */
  async clearAll(): Promise<void> {
    await this.initialize();
    
    try {
      await this.db.storage.clear();
    } catch (error) {
      console.error('Failed to clear storage:', error);
      throw new StorageError('Failed to clear storage', 'clear');
    }
  }

  /**
   * Atomic update operation
   * Uses Dexie's transaction mechanism to ensure atomicity, with retry and fallback mechanisms
   */
  async atomicUpdate<T>(
    key: string,
    updateFn: (currentValue: T | null) => T
  ): Promise<void> {
    await this.initialize();

    // Get the key-level lock
    const lockKey = `atomic_${key}`;
    if (this.keyLocks.has(lockKey)) {
      await this.keyLocks.get(lockKey);
    }

    const lockPromise = this._performAtomicUpdateWithRetry(key, updateFn);
    this.keyLocks.set(lockKey, lockPromise);

    try {
      await lockPromise;
    } finally {
      this.keyLocks.delete(lockKey);
    }
  }

  /**
   * Hidden data update - uses atomic update internally
   * Required by the IStorageProvider interface
   */
  async updateData<T>(
    key: string,
    modifier: (currentValue: T | null) => T
  ): Promise<void> {
    // Use the internal atomic update implementation directly
    await this.atomicUpdate(key, modifier);
  }

  /**
   * Type guard: check whether the value is an Error object
   */
  private isError(error: unknown): error is Error {
    return error instanceof Error || (typeof error === 'object' && error !== null && 'name' in error && 'message' in error);
  }

  /**
   * Atomic update with a retry mechanism
   */
  private async _performAtomicUpdateWithRetry<T>(
    key: string,
    updateFn: (currentValue: T | null) => T,
    maxRetries: number = 3
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this._performAtomicUpdate(key, updateFn);
        return; // Succeeded, return directly
      } catch (error) {
        lastError = error as Error;
        console.warn(`Atomic update attempt ${attempt}/${maxRetries} failed (${key}):`, error);

        // If it is a transaction error and there are retries left, wait a while and retry
        if (this.isError(error) && error.name === 'PrematureCommitError' && attempt < maxRetries) {
          const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000); // Exponential backoff, at most 1 second
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // If this is the last attempt or not a transaction error, try falling back to a simple update
        if (attempt === maxRetries) {
          console.warn(`All retries failed, trying to fall back to a simple update (${key})`);
          try {
            await this._performSimpleUpdate(key, updateFn);
            console.log(`Fallback update succeeded (${key})`);
            return;
          } catch (fallbackError) {
            console.error(`Fallback update also failed (${key}):`, fallbackError);
            throw lastError; // Throw the original error
          }
        }
      }
    }

    if (lastError) {
      throw lastError
    }
    throw new StorageError(`Failed to perform atomic update after ${maxRetries} attempts`, 'write')
  }

  /**
   * Simple update (fallback)
   */
  private async _performSimpleUpdate<T>(
    key: string,
    updateFn: (currentValue: T | null) => T
  ): Promise<void> {
    try {
      // Read the current value
      const currentRecord = await this.db.storage.get(key);
      const currentValue = currentRecord?.value
        ? JSON.parse(currentRecord.value) as T
        : null;

      // Apply the update function
      const newValue = updateFn(currentValue);

      // Write the new value directly (no transaction)
      await this.db.storage.put({
        key,
        value: JSON.stringify(newValue),
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`Simple update failed (${key}):`, error);
      throw new StorageError(`Failed to perform simple update: ${key}`, 'write');
    }
  }

  /**
   * Perform the atomic update
   */
  private async _performAtomicUpdate<T>(
    key: string,
    updateFn: (currentValue: T | null) => T
  ): Promise<void> {
    try {
      // Use a safer transaction handling approach
      await this.db.transaction('rw', this.db.storage, async (tx) => {
        try {
          // Read the current value
          const currentRecord = await tx.table('storage').get(key);
          const currentValue = currentRecord?.value
            ? JSON.parse(currentRecord.value) as T
            : null;

          // Apply the update function - make sure it runs synchronously
          const newValue = updateFn(currentValue);

          // Write the new value
          await tx.table('storage').put({
            key,
            value: JSON.stringify(newValue),
            timestamp: Date.now()
          });
        } catch (innerError) {
          // Error inside the transaction; let the transaction roll back
          console.error(`Operation inside the transaction failed (${key}):`, innerError);
          throw innerError;
        }
      });
    } catch (error) {
      console.error(`Atomic update failed (${key}):`, error);

      // If it is a Dexie transaction error, provide more detailed error info
      if (this.isError(error) && error.name === 'PrematureCommitError') {
        throw new StorageError(
          `Database transaction error for key ${key}: ${error.message}. Please try again.`,
          'write',
        );
      }

      throw new StorageError(`Failed to perform atomic update: ${key}`, 'write');
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
    await this.initialize();

    try {
      await this.db.transaction('rw', this.db.storage, async () => {
        const updates: Array<StorageRecord> = [];
        const deletions: string[] = [];

        for (const { key, operation, value } of operations) {
          if (operation === 'set' && value !== undefined) {
            updates.push({
              key,
              value,
              timestamp: Date.now()
            });
          } else if (operation === 'remove') {
            deletions.push(key);
          }
        }

        // Batch write
        if (updates.length > 0) {
          await this.db.storage.bulkPut(updates);
        }

        // Batch delete
        if (deletions.length > 0) {
          await this.db.storage.bulkDelete(deletions);
        }
      });
    } catch (error) {
      console.error('Batch update failed:', error);
      throw new StorageError('Failed to perform batch update', 'write');
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageInfo(): Promise<{
    itemCount: number;
    estimatedSize: number;
    lastUpdated: number | null;
  }> {
    await this.initialize();

    try {
      const itemCount = await this.db.storage.count();
      const lastRecord = await this.db.storage
        .orderBy('timestamp')
        .last();

      // Estimate the storage size (rough calculation)
      const allRecords = await this.db.storage.toArray();
      const estimatedSize = allRecords.reduce(
        (total, record) => total + record.value.length,
        0
      );

      return {
        itemCount,
        estimatedSize,
        lastUpdated: lastRecord?.timestamp ?? null
      };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return {
        itemCount: 0,
        estimatedSize: 0,
        lastUpdated: null
      };
    }
  }

  /**
   * Export all data (for backup)
   */
  async exportAll(): Promise<Record<string, string>> {
    await this.initialize();

    try {
      const allRecords = await this.db.storage.toArray();
      const result: Record<string, string> = {};

      allRecords.forEach(record => {
        result[record.key] = record.value;
      });

      return result;
    } catch (error) {
      console.error('Failed to export data:', error);
      throw new StorageError('Failed to export data', 'read');
    }
  }

  /**
   * Import data (for restore)
   */
  async importAll(data: Record<string, string>): Promise<void> {
    await this.initialize();

    try {
      const records: StorageRecord[] = Object.entries(data).map(([key, value]) => ({
        key,
        value,
        timestamp: Date.now()
      }));

      await this.db.storage.bulkPut(records);
    } catch (error) {
      console.error('Failed to import data:', error);
      throw new StorageError('Failed to import data', 'write');
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    try {
      await this.db.close();
    } catch (error) {
      console.error('Failed to close the database:', error);
    }
  }
} 
