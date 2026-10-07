/**
 * Renderer-process proxy for ContextRepo in the Electron environment
 *
 * Communicates with the main-process ContextRepo instance over IPC,
 * following the project's existing three-layer architecture: Renderer proxy → Preload bridge → Main-process IPC handler
 */

import { ContextError, CONTEXT_ERROR_CODES, type ContextRepo, type ContextPackage, type ContextBundle, type ImportMode, type ContextListItem, type ImportResult, type ContextMode } from './types';
import { safeSerializeForIPC } from '../../utils/ipc-serialization';

// Provide complete type definitions for window.electronAPI to ensure type safety
interface ElectronAPI {
  context: {
    list: () => Promise<ContextListItem[]>;
    getCurrentId: () => Promise<string>;
    setCurrentId: (id: string) => Promise<void>;
    get: (id: string) => Promise<ContextPackage>;
    create: (meta?: { title?: string; mode?: ContextMode }) => Promise<string>;
    duplicate: (id: string, options?: { mode?: ContextMode }) => Promise<string>;
    rename: (id: string, title: string) => Promise<void>;
    save: (ctx: ContextPackage) => Promise<void>;
    update: (id: string, patch: Partial<ContextPackage>) => Promise<void>;
    remove: (id: string) => Promise<void>;
    exportAll: () => Promise<ContextBundle>;
    importAll: (bundle: ContextBundle, mode: ImportMode) => Promise<ImportResult>;
    exportData: () => Promise<ContextBundle>;
    importData: (data: any) => Promise<void>;
    getDataType: () => Promise<string>;
    validateData: (data: any) => Promise<boolean>;
  };
  // Add definitions for other services to avoid compile errors
  [key: string]: any;
}

declare const window: {
  electronAPI: ElectronAPI;
};

export class ElectronContextRepoProxy implements ContextRepo {
  private get api() {
    if (!window.electronAPI?.context) {
      throw new ContextError(CONTEXT_ERROR_CODES.ELECTRON_API_UNAVAILABLE);
    }
    return window.electronAPI.context;
  }

  // === Basic queries ===
  async list(): Promise<ContextListItem[]> {
    return this.api.list();
  }

  async getCurrentId(): Promise<string> {
    return this.api.getCurrentId();
  }

  async setCurrentId(id: string): Promise<void> {
    return this.api.setCurrentId(id);
  }

  async get(id: string): Promise<ContextPackage> {
    return this.api.get(id);
  }

  // === Content management ===
  async create(meta?: { title?: string; mode?: import('./types').ContextMode }): Promise<string> {
    return this.api.create(meta);
  }

  async duplicate(id: string, options?: { mode?: import('./types').ContextMode }): Promise<string> {
    return this.api.duplicate(id, options);
  }

  async rename(id: string, title: string): Promise<void> {
    return this.api.rename(id, title);
  }

  async save(ctx: ContextPackage): Promise<void> {
    return this.api.save(safeSerializeForIPC(ctx));
  }

  async update(id: string, patch: Partial<ContextPackage>): Promise<void> {
    return this.api.update(id, safeSerializeForIPC(patch));
  }

  async remove(id: string): Promise<void> {
    return this.api.remove(id);
  }

  // === Import/export ===
  async exportAll(): Promise<ContextBundle> {
    return this.api.exportAll();
  }

  async importAll(bundle: ContextBundle, mode: ImportMode): Promise<ImportResult> {
    return this.api.importAll(safeSerializeForIPC(bundle), mode);
  }

  // === IImportExportable implementation ===
  async exportData(): Promise<ContextBundle> {
    return this.exportAll();
  }

  async importData(data: any): Promise<void> {
    if (!(await this.validateData(data))) {
      throw new ContextError(CONTEXT_ERROR_CODES.IMPORT_FORMAT_ERROR, 'Invalid context bundle data');
    }
    await this.importAll(data as ContextBundle, 'replace');
  }

  async getDataType(): Promise<string> {
    return this.api.getDataType ? this.api.getDataType() : Promise.resolve('context-bundle');
  }

  async validateData(data: any): Promise<boolean> {
    return this.api.validateData 
      ? this.api.validateData(safeSerializeForIPC(data))
      : Promise.resolve(!!(data?.type && data?.type === 'context-bundle'));
  }
}
