import { TextModelConfig } from './types';
import { getAllModels } from './defaults';
import { ModelError } from './errors';
import { MODEL_ERROR_CODES } from '../../constants/error-codes';

/**
 * Config manager for the Electron environment
 * Ensures the config state of the UI process and the main process is fully consistent
 */
export class ElectronConfigManager {
  private static instance: ElectronConfigManager;
  private envVars: Record<string, string> = {};
  private initialized = false;

  private constructor() {}

  static getInstance(): ElectronConfigManager {
    if (!ElectronConfigManager.instance) {
      ElectronConfigManager.instance = new ElectronConfigManager();
    }
    return ElectronConfigManager.instance;
  }

  /**
   * Sync environment variables from the main process
   */
  async syncFromMainProcess(): Promise<void> {
    if (typeof window === 'undefined' || !window.electronAPI) {
      throw new ModelError(
        MODEL_ERROR_CODES.CONFIG_ERROR,
        'ElectronConfigManager can only be used in Electron renderer process',
      );
    }

    try {
      console.log('[ElectronConfigManager] Syncing environment variables from main process...');
      this.envVars = await window.electronAPI.config.getEnvironmentVariables();
      this.initialized = true;
      console.log('[ElectronConfigManager] Environment variables synced successfully');

      // Debug output
      Object.keys(this.envVars).forEach(key => {
        const value = this.envVars[key];
        if (value) {
          console.log(`[ElectronConfigManager] ${key}: ${value.substring(0, 10)}...`);
        }
      });
    } catch (error) {
      console.error('[ElectronConfigManager] Failed to sync environment variables:', error);
      throw error;
    }
  }

  /**
   * Get an environment variable
   */
  getEnvVar(key: string): string {
    if (!this.initialized) {
      console.warn(`[ElectronConfigManager] Environment variables not synced yet, returning empty for ${key}`);
      return '';
    }
    return this.envVars[key] || '';
  }

  /**
   * Check whether it has been initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Generate the default model configs (based on the synced environment variables)
   *
   * Note: this method now calls getAllModels() directly, since getEnvVar already supports multiple environments
   * (including process.env, import.meta.env, window.runtime_config)
   *
   * @returns Model configs in TextModelConfig format
   */
  generateDefaultModels(): Record<string, TextModelConfig> {
    return getAllModels();
  }
}

/**
 * Check whether running in the Electron renderer process
 */
export function isElectronRenderer(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI;
}
