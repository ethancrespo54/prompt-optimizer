import * as fs from 'fs/promises';
import * as path from 'path';
import { IStorageProvider } from './types';
import { StorageError } from './errors';

/**
 * File-based storage provider - enhanced version
 * Designed for the Electron desktop environment, using JSON files to persist data
 *
 * Features:
 * - Delayed writes improve performance and reduce I/O operations
 * - An in-memory cache provides fast reads
 * - Atomic writes ensure data integrity
 * - Data backup and smart recovery mechanisms
 * - Atomic updateData operations
 * - Strict initialization control
 */
export class FileStorageProvider implements IStorageProvider {
  private filePath: string;
  private backupPath: string;
  private data: Map<string, string> = new Map();
  private writeTimeout: NodeJS.Timeout | null = null;
  private isDirty: boolean = false;
  private writeLock: Promise<void> = Promise.resolve();
  private updateLock: Promise<void> = Promise.resolve();
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  // Configuration constants
  private readonly WRITE_DELAY = 500; // 500ms write delay
  private readonly TEMP_FILE_SUFFIX = '.tmp';
  private readonly BACKUP_FILE_SUFFIX = '.backup';
  private readonly MAX_FLUSH_TIME = 3000; // Maximum flush time: 3 seconds
  private flushAttempts = 0; // Number of flush attempts
  private readonly MAX_FLUSH_ATTEMPTS = 3; // Maximum number of flush attempts
  
  constructor(userDataPath: string) {
    if (!userDataPath) {
      throw new StorageError('FileStorageProvider requires userDataPath parameter', 'read');
    }

    this.filePath = path.join(userDataPath, 'prompt-optimizer-data.json');
    this.backupPath = path.join(userDataPath, 'prompt-optimizer-data.json' + this.BACKUP_FILE_SUFFIX);
  }
  
  /**
   * Ensure storage is initialized - enhanced version
   * Uses the singleton pattern to ensure initialization runs only once
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    this.initializationPromise = this.initialize();
    await this.initializationPromise;
  }

  /**
   * Initialize storage and load existing data - enhanced version
   * Includes a smart recovery mechanism
   */
  private async initialize(): Promise<void> {
    try {
      console.log('[FileStorage] Initializing storage...');
      await this.loadFromFileWithRecovery();
      this.initialized = true;
      console.log('[FileStorage] Storage initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[FileStorage] Failed to initialize:', errorMessage);
      throw new StorageError(`Failed to initialize file storage: ${errorMessage}`, 'read');
    }
  }
  
  /**
   * Load data from the file into memory - enhanced version, includes a smart recovery mechanism
   */
  private async loadFromFileWithRecovery(): Promise<void> {
    // Try loading from the main file
    const mainFileResult = await this.tryLoadFromFile(this.filePath, 'main');
    if (mainFileResult.success) {
      this.data = mainFileResult.data!;
      // After the main file loads successfully, create a backup
      await this.createBackup();
      return;
    }

    console.warn('[FileStorage] Main file failed, trying backup...');

    // Try loading from the backup file
    const backupFileResult = await this.tryLoadFromFile(this.backupPath, 'backup');
    if (backupFileResult.success) {
      this.data = backupFileResult.data!;
      console.log('[FileStorage] Successfully recovered from backup');

      // After recovering from the backup, recreate the main file (skip backup creation to protect the existing backup)
      await this.saveToFileWithoutBackup();

      // After the main file is recovered, recreate the backup to ensure it is up to date
      try {
        await this.createBackup();
        console.log('[FileStorage] Backup refreshed after recovery');
      } catch (error) {
        console.warn('[FileStorage] Failed to refresh backup after recovery:', error);
        // A backup failure should not affect the recovery flow
      }

      return;
    }

    console.warn('[FileStorage] Both main and backup files failed, checking if files exist...');

    // Check whether this is the first run (the file does not exist)
    const mainExists = await this.fileExists(this.filePath);
    const backupExists = await this.fileExists(this.backupPath);

    if (!mainExists && !backupExists) {
      // First run; create empty storage
      console.log('[FileStorage] First run detected, creating new storage');
      this.data = new Map();
      await this.saveToFile();
      return;
    }

    // The files exist but are all corrupted; this is a serious problem
    console.error('[FileStorage] CRITICAL: Both storage files exist but are corrupted!');
    console.error('[FileStorage] Main file error:', mainFileResult.error);
    console.error('[FileStorage] Backup file error:', backupFileResult.error);

    // In this case we cannot simply reset the data; instead throw an error for the upper layer to handle
    throw new StorageError(
      `Storage corruption detected. Main: ${mainFileResult.error}, Backup: ${backupFileResult.error}`,
      'read'
    );
  }

  /**
   * Try loading data from the specified file
   */
  private async tryLoadFromFile(filePath: string, fileType: string): Promise<{
    success: boolean;
    data?: Map<string, string>;
    error?: string;
  }> {
    try {
      // Check whether the file exists
      await fs.access(filePath);

      // Read the file content
      const content = await fs.readFile(filePath, 'utf8');

      // Validate the JSON format
      if (!this.validateJSON(content)) {
        return {
          success: false,
          error: `Invalid JSON format in ${fileType} file`
        };
      }

      // Parse the data
      const parsed = JSON.parse(content);
      const data = new Map<string, string>();

      // Ensure all values are strings
      for (const [key, value] of Object.entries(parsed || {})) {
        data.set(key, typeof value === 'string' ? value : JSON.stringify(value));
      }

      console.log(`[FileStorage] Successfully loaded ${data.size} items from ${fileType} file`);

      return {
        success: true,
        data
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to load ${fileType} file: ${errorMessage}`
      };
    }
  }

  /**
   * Check whether the file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a backup file
   */
  private async createBackup(): Promise<void> {
    try {
      if (await this.fileExists(this.filePath)) {
        await fs.copyFile(this.filePath, this.backupPath);
        console.log('[FileStorage] Backup created successfully');
      }
    } catch (error) {
      console.warn('[FileStorage] Failed to create backup:', error);
      // A backup failure should not affect the main functionality
    }
  }
  
  /**
   * Save in-memory data to the file - enhanced version
   * Includes backup creation and data validation
   */
  private async saveToFile(): Promise<void> {
    const data = Object.fromEntries(this.data);
    const jsonString = JSON.stringify(data, null, 2);

    // Validate data integrity
    if (!this.validateJSON(jsonString)) {
      throw new StorageError('Generated JSON is invalid', 'write');
    }

    // If the main file exists, create a backup first
    if (await this.fileExists(this.filePath)) {
      await this.createBackup();
    }

    // Atomically write the main file
    await this.atomicWrite(jsonString);

    console.log(`[FileStorage] Saved ${this.data.size} items to storage`);
  }

  /**
   * Save in-memory data to the file - version without creating a backup
   * Used when recovering from a backup, to avoid overwriting an intact backup file
   */
  private async saveToFileWithoutBackup(): Promise<void> {
    const data = Object.fromEntries(this.data);
    const jsonString = JSON.stringify(data, null, 2);

    // Validate data integrity
    if (!this.validateJSON(jsonString)) {
      throw new StorageError('Generated JSON is invalid', 'write');
    }

    console.log('[FileStorage] Saving to main file without creating backup (recovery mode)');

    // Atomically write the main file directly, without creating a backup
    await this.atomicWrite(jsonString);

    console.log(`[FileStorage] Recovered and saved ${this.data.size} items to storage`);
  }
  
  /**
   * Atomically write a file
   */
  private async atomicWrite(data: string): Promise<void> {
    const tempPath = this.filePath + this.TEMP_FILE_SUFFIX;
    
    try {
      // Ensure the directory exists
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      
      // 1. Write the temporary file
      await fs.writeFile(tempPath, data, 'utf8');
      
      // 2. Validate the file format
      if (!this.validateJSON(data)) {
        throw new StorageError('Invalid JSON format', 'write');
      }
      
      // 3. Atomic rename
      await fs.rename(tempPath, this.filePath);
      
    } catch (error) {
      // Clean up the temporary file
      try {
        await fs.unlink(tempPath);
      } catch {}
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new StorageError(`Atomic write failed: ${errorMessage}`, 'write');
    }
  }
  
  /**
   * Validate the JSON format
   */
  private validateJSON(data: string): boolean {
    try {
      JSON.parse(data);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Schedule a delayed write
   */
  private scheduleWrite(): void {
    this.isDirty = true;
    
    // If there is already a pending write task, reset the timer
    if (this.writeTimeout) {
      clearTimeout(this.writeTimeout);
    }
    
    this.writeTimeout = setTimeout(async () => {
      if (this.isDirty) {
        try {
          await this.acquireWriteLock(async () => {
            await this.saveToFile();
            this.isDirty = false;
          });
        } catch (error) {
          console.error('[FileStorage] Scheduled write failed:', error);
          // Reset the isDirty flag to avoid infinite retries
          this.isDirty = false;
        }
      }
      this.writeTimeout = null;
    }, this.WRITE_DELAY);
  }
  
  /**
   * Write immediately (use at critical moments)
   * Has timeout protection and a retry limit to ensure it never loops forever
   */
  async flush(): Promise<void> {
    if (this.writeTimeout) {
      clearTimeout(this.writeTimeout);
      this.writeTimeout = null;
    }

    if (!this.isDirty) {
      return; // No dirty data, return directly
    }

    // Check the retry limit
    if (this.flushAttempts >= this.MAX_FLUSH_ATTEMPTS) {
      console.error('[FileStorage] Max flush attempts reached, forcing isDirty to false');
      this.isDirty = false;
      this.flushAttempts = 0;
      throw new StorageError('Max flush attempts exceeded', 'write');
    }

    this.flushAttempts++;

    try {
      // Use Promise.race to implement timeout protection
      await Promise.race([
        this.acquireWriteLock(async () => {
          await this.saveToFile();
          this.isDirty = false;
          this.flushAttempts = 0; // Reset the counter after success
          console.log('[FileStorage] Data saved successfully');
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new StorageError('Flush timeout', 'write')), this.MAX_FLUSH_TIME)
        )
      ]);
    } catch (error) {
      console.error('[FileStorage] Failed to save data during flush:', error);

      // If the maximum number of retries is reached or it is a timeout error, force a state reset
      if (this.flushAttempts >= this.MAX_FLUSH_ATTEMPTS ||
          (error instanceof StorageError && error.operation === 'write' && error.params?.details === 'Flush timeout')) {
        console.warn('[FileStorage] Forcing isDirty to false to prevent infinite loop');
        this.isDirty = false;
        this.flushAttempts = 0;
      }

      throw error; // Rethrow the error so the upper layer can handle it
    }
  }
  
  /**
   * Acquire the write lock to ensure write operations run serially
   */
  private async acquireWriteLock<T>(operation: () => Promise<T>): Promise<T> {
    const currentLock = this.writeLock;
    let resolveLock: () => void;
    
    this.writeLock = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    
    try {
      await currentLock;
      const result = await operation();
      return result;
    } finally {
      resolveLock!();
    }
  }
  
  // IStorageProvider interface implementation
  
  async getItem(key: string): Promise<string | null> {
    await this.ensureInitialized();
    return this.data.get(key) || null;
  }
  
  async setItem(key: string, value: string): Promise<void> {
    await this.ensureInitialized();
    this.data.set(key, value);
    this.scheduleWrite(); // Delayed write
  }
  
  async removeItem(key: string): Promise<void> {
    await this.ensureInitialized();
    this.data.delete(key);
    this.scheduleWrite(); // Delayed write
  }
  
  async clearAll(): Promise<void> {
    await this.ensureInitialized();
    this.data.clear();
    // Force a write even if there is no dirty data
    await this.acquireWriteLock(async () => {
      await this.saveToFile();
    });
  }
  
  /**
   * Atomic data update - enhanced version
   * Ensures the atomicity of read-modify-write operations to prevent concurrency problems
   */
  async updateData<T>(key: string, modifier: (currentValue: T | null) => T): Promise<void> {
    await this.ensureInitialized();

    // Use the update lock to ensure atomicity
    const currentLock = this.updateLock;
    let resolveLock: () => void;

    this.updateLock = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });

    try {
      await currentLock;

      // Perform the atomic operation under lock protection
      await this.performAtomicUpdate(key, modifier);

    } catch (error) {
      // Business logic errors are passed through directly, preserving the error type
      if (error instanceof Error &&
          (error.name.includes('Error') ||
           error.constructor.name !== 'Error' ||
           error.message.includes('Model') ||
           error.message.includes('not found'))) {
        throw error;
      }
      // Only real storage errors are wrapped as StorageError
      throw new StorageError(`Data update failed: ${key}`, 'write');
    } finally {
      resolveLock!();
    }
  }

  /**
   * Perform the atomic update operation
   */
  private async performAtomicUpdate<T>(key: string, modifier: (currentValue: T | null) => T): Promise<void> {
    // Re-read the latest data from storage to ensure data consistency
    const latestData = await this.getLatestData<T>(key);

    // Apply the modification
    const newValue = modifier(latestData);

    // Validate the new value
    this.validateValue(newValue);

    // Write the new value
    this.data.set(key, JSON.stringify(newValue));
    this.scheduleWrite(); // Delayed write

    console.log(`[FileStorage] Atomic update completed for key: ${key}`);
  }

  /**
   * Get the latest data to ensure data consistency
   */
  private async getLatestData<T>(key: string): Promise<T | null> {
    // If there is pending data, flush it to the file first
    if (this.isDirty) {
      console.log('[FileStorage] Flushing pending changes before read...');
      await this.flush();
    }

    // Read from the in-memory cache
    const currentData = this.data.get(key);
    if (!currentData) {
      return null;
    }

    try {
      return JSON.parse(currentData) as T;
    } catch (error) {
      console.error(`[FileStorage] Failed to parse data for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Validate the validity of a value
   */
  private validateValue<T>(value: T): void {
    try {
      JSON.stringify(value);
    } catch (error) {
      throw new StorageError('Value is not serializable', 'write');
    }
  }
  
  async batchUpdate(operations: Array<{
    key: string;
    operation: 'set' | 'remove';
    value?: string;
  }>): Promise<void> {
    await this.ensureInitialized();
    
    try {
      for (const op of operations) {
        if (op.operation === 'set' && op.value !== undefined) {
          this.data.set(op.key, op.value);
        } else if (op.operation === 'remove') {
          this.data.delete(op.key);
        }
      }
      
      await this.flush(); // Write immediately after the batch operation
      
    } catch (error) {
      throw new StorageError('Batch update failed', 'write');
    }
  }
  
  getCapabilities() {
    return {
      supportsAtomic: true,
      supportsBatch: true,
      maxStorageSize: undefined // File storage has no fixed size limit
    };
  }
}
