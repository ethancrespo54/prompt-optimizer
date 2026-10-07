import type { Template, ITemplateManager, TemplateType } from './types';
import type { BuiltinTemplateLanguage } from './languageService';
import { safeSerializeForIPC } from '../../utils/ipc-serialization';
import { TemplateStorageError } from './errors';

// Provide complete type definitions for window.electronAPI to ensure type safety
interface ElectronAPI {
  template: {
    getTemplate: (id: string) => Promise<Template>;
    createTemplate: (template: Template) => Promise<void>;
    deleteTemplate: (id: string) => Promise<void>;
    getTemplates: () => Promise<Template[]>;
    exportTemplate: (id: string) => Promise<string>;
    importTemplate: (jsonString: string) => Promise<void>;
    listTemplatesByType: (type: TemplateType) => Promise<Template[]>;
    changeBuiltinTemplateLanguage: (language: BuiltinTemplateLanguage) => Promise<void>;
    getCurrentBuiltinTemplateLanguage: () => Promise<BuiltinTemplateLanguage>;
    getSupportedBuiltinTemplateLanguages: () => Promise<BuiltinTemplateLanguage[]>;
    // Import/Export Data methods
    exportData: () => Promise<Template[]>;
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


/**
 * TemplateManager proxy for the Electron environment
 * Calls the real TemplateManager instance in the main process over IPC
 */
export class ElectronTemplateManagerProxy implements ITemplateManager {
  private electronAPI: ElectronAPI['template'];

  constructor() {
    if (!window.electronAPI?.template) {
      throw new TemplateStorageError(
        'Electron API for TemplateManager not available. Please ensure preload script is loaded.',
      );
    }
    this.electronAPI = window.electronAPI.template;
  }

  async getTemplate(id: string): Promise<Template> {
    return this.electronAPI.getTemplate(id);
  }

  async saveTemplate(template: Template): Promise<void> {
    // Serialize automatically to prevent errors when Vue reactive objects are passed over IPC
    const safeTemplate = safeSerializeForIPC(template);
    return this.electronAPI.createTemplate(safeTemplate);
  }

  async deleteTemplate(id: string): Promise<void> {
    return this.electronAPI.deleteTemplate(id);
  }

  async listTemplates(): Promise<Template[]> {
    return this.electronAPI.getTemplates();
  }

  async exportTemplate(id: string): Promise<string> {
    return this.electronAPI.exportTemplate(id);
  }

  async importTemplate(jsonString: string): Promise<void> {
    // jsonString is a primitive type and needs no serialization, but the comment is kept for consistency
    return this.electronAPI.importTemplate(jsonString);
  }

  async listTemplatesByType(type: TemplateType): Promise<Template[]> {
    return this.electronAPI.listTemplatesByType(type);
  }

  async changeBuiltinTemplateLanguage(language: BuiltinTemplateLanguage): Promise<void> {
    return this.electronAPI.changeBuiltinTemplateLanguage(language);
  }

  async getCurrentBuiltinTemplateLanguage(): Promise<BuiltinTemplateLanguage> {
    return await this.electronAPI.getCurrentBuiltinTemplateLanguage();
  }

  async getSupportedBuiltinTemplateLanguages(): Promise<BuiltinTemplateLanguage[]> {
    return await this.electronAPI.getSupportedBuiltinTemplateLanguages();
  }

  // Implement the IImportExportable interface

  /**
   * Export all user templates
   */
  async exportData(): Promise<Template[]> {
    return this.electronAPI.exportData();
  }

  /**
   * Import user templates
   */
  async importData(data: any): Promise<void> {
    // Serialize automatically to prevent errors when Vue reactive objects are passed over IPC
    const safeData = safeSerializeForIPC(data);
    return this.electronAPI.importData(safeData);
  }

  /**
   * Get the data type identifier
   */
  async getDataType(): Promise<string> {
    return this.electronAPI.getDataType();
  }

  /**
   * Validate the template data format
   */
  async validateData(data: any): Promise<boolean> {
    // Serialize automatically to prevent errors when Vue reactive objects are passed over IPC
    const safeData = safeSerializeForIPC(data);
    return this.electronAPI.validateData(safeData);
  }
}
