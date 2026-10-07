/**
 * Language service adapter
 *
 * English is the only supported built-in template language
 */

import { BuiltinTemplateLanguage, ITemplateLanguageService } from '@prompt-optimizer/core';

export class SimpleLanguageService implements ITemplateLanguageService {
  private currentLanguage: BuiltinTemplateLanguage;
  private initialized = false;

  constructor(_defaultLanguage: string = 'en-US') {
    // English is the only supported language; any requested value resolves to it
    this.currentLanguage = 'en-US';
  }

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async getCurrentLanguage(): Promise<BuiltinTemplateLanguage> {
    return this.currentLanguage;
  }

  async setLanguage(language: BuiltinTemplateLanguage): Promise<void> {
    if (!(await this.isValidLanguage(language))) {
      throw new Error(`Unsupported language: ${language}`);
    }
    this.currentLanguage = language;
  }

  async toggleLanguage(): Promise<BuiltinTemplateLanguage> {
    return this.currentLanguage;
  }

  async isValidLanguage(language: string): Promise<boolean> {
    const supportedLanguages = await this.getSupportedLanguages();
    return supportedLanguages.includes(language as BuiltinTemplateLanguage);
  }

  async getSupportedLanguages(): Promise<BuiltinTemplateLanguage[]> {
    return ['en-US'];
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
    return this.initialized;
  }
}

export function createSimpleLanguageService(defaultLanguage?: string): SimpleLanguageService {
  return new SimpleLanguageService(defaultLanguage || 'en-US');
}
