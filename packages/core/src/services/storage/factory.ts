import { IStorageProvider } from './types';
import { LocalStorageProvider } from './localStorageProvider';
import { DexieStorageProvider } from './dexieStorageProvider';
import { MemoryStorageProvider } from './memoryStorageProvider';
import { StorageError } from './errors';

export type StorageType = 'localStorage' | 'dexie' | 'memory' | 'file';

/**
 * Storage factory class
 */
export class StorageFactory {
  // Singleton instance cache
  private static instances: Map<StorageType, IStorageProvider> = new Map();

  /**
   * Create a storage provider
   * @param type Storage type
   * @returns Storage provider instance
   */
  static create(type: StorageType): IStorageProvider {
    // Check whether there is already a cached instance
    if (StorageFactory.instances.has(type)) {
      return StorageFactory.instances.get(type)!;
    }

    let instance: IStorageProvider;
    switch (type) {
      case 'localStorage':
        instance = new LocalStorageProvider();
        break;
      case 'dexie':
        instance = new DexieStorageProvider();
        break;
      case 'memory':
        instance = new MemoryStorageProvider();
        break;
      case 'file':
        throw new StorageError(
          'File storage must be created directly with FileStorageProvider constructor',
          'config',
        );
        break;
      default:
        throw new StorageError(`Unsupported storage type: ${type}`, 'config', {
          details: `Unsupported storage type: ${type}`,
          storageType: type
        });
    }

    // Cache the instance
    StorageFactory.instances.set(type, instance);
    return instance;
  }



  /**
   * Reset all instances (mainly for testing)
   */
  static reset(): void {
    StorageFactory.instances.clear();

    // Reset the migration state of DexieStorageProvider
    DexieStorageProvider.resetMigrationState();
  }



  /**
   * Get all supported storage types
   */
  static getSupportedTypes(): StorageType[] {
    const types: StorageType[] = [];

    // memory storage is always supported
    types.push('memory');

    // Check localStorage support
    if (typeof window !== 'undefined' && window.localStorage) {
      types.push('localStorage');
    }

    // Check IndexedDB support
    if (typeof window !== 'undefined' && window.indexedDB) {
      types.push('dexie');
    }

    // Check whether the Electron environment supports file storage
    if (typeof process !== 'undefined' && process.versions?.electron) {
      types.push('file');
    }

    return types;
  }

  /**
   * Check whether a specific storage type is supported
   */
  static isSupported(type: StorageType): boolean {
    return StorageFactory.getSupportedTypes().includes(type);
  }
} 
