import type { IPreferenceService } from './types';
import { safeSerializeForIPC } from '../../utils/ipc-serialization';
import { StorageError } from '../storage/errors';

declare const window: {
  electronAPI: {
    preference: IPreferenceService;
  }
};

export class ElectronPreferenceServiceProxy implements IPreferenceService {
  private ensureApiAvailable() {
    const windowAny = window as any;
    if (!windowAny?.electronAPI?.preference) {
      throw new StorageError(
        'Electron API not available. Please ensure preload script is loaded and window.electronAPI.preference is accessible.',
        'read',
      );
    }
  }

  async get<T>(key: string, defaultValue: T): Promise<T> {
    this.ensureApiAvailable();
    return window.electronAPI.preference.get(key, defaultValue);
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.ensureApiAvailable();
    // Serialize automatically to prevent errors when Vue reactive objects are passed over IPC
    const safeValue = safeSerializeForIPC(value);
    return window.electronAPI.preference.set(key, safeValue);
  }

  async delete(key: string): Promise<void> {
    this.ensureApiAvailable();
    return window.electronAPI.preference.delete(key);
  }

  async keys(): Promise<string[]> {
    this.ensureApiAvailable();
    return window.electronAPI.preference.keys();
  }

  async clear(): Promise<void> {
    this.ensureApiAvailable();
    return window.electronAPI.preference.clear();
  }

  async getAll(): Promise<Record<string, string>> {
    this.ensureApiAvailable();
    return (window.electronAPI as any).preference.getAll();
  }

  // Implement the IImportExportable interface

  /**
   * Export all preferences
   */
  async exportData(): Promise<Record<string, string>> {
    this.ensureApiAvailable();
    return (window.electronAPI as any).preference.exportData();
  }

  /**
   * Import preferences
   */
  async importData(data: any): Promise<void> {
    this.ensureApiAvailable();
    // Serialize automatically to prevent errors when Vue reactive objects are passed over IPC
    const safeData = safeSerializeForIPC(data);
    return (window.electronAPI as any).preference.importData(safeData);
  }

  /**
   * Get the data type identifier
   */
  async getDataType(): Promise<string> {
    this.ensureApiAvailable();
    return (window.electronAPI as any).preference.getDataType();
  }

  /**
   * Validate the preferences data format
   */
  async validateData(data: any): Promise<boolean> {
    this.ensureApiAvailable();
    // Serialize automatically to prevent errors when Vue reactive objects are passed over IPC
    const safeData = safeSerializeForIPC(data);
    return (window.electronAPI as any).preference.validateData(safeData);
  }
}
