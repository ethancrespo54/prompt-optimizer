import type { BuiltinTemplateLanguage, ITemplateLanguageService } from './languageService';
import { TemplateStorageError } from './errors';

/**
 * TemplateLanguageService proxy for the Electron environment
 * Calls language-related features in the main process over the template namespace IPC
 */
export class ElectronTemplateLanguageServiceProxy implements ITemplateLanguageService {
  private electronAPI: any;

  constructor() {
    const windowAny = window as any;
    if (!windowAny?.electronAPI?.template) {
      throw new TemplateStorageError('Electron API not available. Please ensure preload script is loaded.');
    }
    this.electronAPI = windowAny.electronAPI;
  }

  async initialize(): Promise<void> {
    // In the Electron environment the language service is managed by the main process; the renderer process does not need to initialize it separately
    return Promise.resolve();
  }

  async getCurrentLanguage(): Promise<BuiltinTemplateLanguage> {
    return this.electronAPI.template.getCurrentBuiltinTemplateLanguage();
  }

  async setLanguage(language: BuiltinTemplateLanguage): Promise<void> {
    return this.electronAPI.template.changeBuiltinTemplateLanguage(language);
  }

  async toggleLanguage(): Promise<BuiltinTemplateLanguage> {
    // Only English is supported, so toggling is a no-op
    return this.getCurrentLanguage();
  }

  async isValidLanguage(language: string): Promise<boolean> {
    const supportedLanguages = await this.getSupportedLanguages();
    return supportedLanguages.includes(language as BuiltinTemplateLanguage);
  }

  async getSupportedLanguages(): Promise<BuiltinTemplateLanguage[]> {
    return this.electronAPI.template.getSupportedBuiltinTemplateLanguages();
  }

  getLanguageDisplayName(language: BuiltinTemplateLanguage): string {
    switch (language) {
      case 'en-US':
        return 'English';
      default:
        return language;
    }
  }

  isInitialized(): boolean {
    return true; // In the Electron environment the main process manages the initialization state
  }
} 
