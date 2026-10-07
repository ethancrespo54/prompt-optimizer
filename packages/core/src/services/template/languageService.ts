
import { IPreferenceService } from '../preference/types';
import { UI_SETTINGS_KEYS } from '../../constants/storage-keys';
import { TemplateValidationError } from './errors';

/**
 * Supported built-in template languages
 */
export type BuiltinTemplateLanguage = 'en-US';

/**
 * Template language service interface
 */
export interface ITemplateLanguageService {
  initialize(): Promise<void>;
  getCurrentLanguage(): Promise<BuiltinTemplateLanguage>;
  setLanguage(language: BuiltinTemplateLanguage): Promise<void>;
  toggleLanguage(): Promise<BuiltinTemplateLanguage>;
  isValidLanguage(language: string): Promise<boolean>;
  getSupportedLanguages(): Promise<BuiltinTemplateLanguage[]>;
  getLanguageDisplayName(language: BuiltinTemplateLanguage): string;
  isInitialized(): boolean;
}

/**
 * Simplified built-in template language service
 */
export class TemplateLanguageService implements ITemplateLanguageService {
  private readonly SUPPORTED_LANGUAGES: BuiltinTemplateLanguage[] = ['en-US'];
  private readonly DEFAULT_LANGUAGE: BuiltinTemplateLanguage = 'en-US';

  private currentLanguage: BuiltinTemplateLanguage = this.DEFAULT_LANGUAGE;
  private preferenceService: IPreferenceService;
  private initialized = false;

  constructor(preferenceService: IPreferenceService) {
    this.preferenceService = preferenceService;
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const savedLanguage = await this.preferenceService.get(UI_SETTINGS_KEYS.BUILTIN_TEMPLATE_LANGUAGE, null);

      if (savedLanguage && await this.isValidLanguage(savedLanguage)) {
        this.currentLanguage = savedLanguage as BuiltinTemplateLanguage;
      } else {
        this.currentLanguage = this.DEFAULT_LANGUAGE;
        await this.preferenceService.set(UI_SETTINGS_KEYS.BUILTIN_TEMPLATE_LANGUAGE, this.currentLanguage);
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize template language service:', error);
      this.currentLanguage = this.DEFAULT_LANGUAGE;
      this.initialized = true;
    }
  }

  /**
   * Get current language
   */
  async getCurrentLanguage(): Promise<BuiltinTemplateLanguage> {
    return this.currentLanguage;
  }

  /**
   * Set language
   */
  async setLanguage(language: BuiltinTemplateLanguage): Promise<void> {
    if (!(await this.isValidLanguage(language))) {
      throw new TemplateValidationError(`Unsupported language: ${language}`);
    }

    this.currentLanguage = language;
    await this.preferenceService.set(UI_SETTINGS_KEYS.BUILTIN_TEMPLATE_LANGUAGE, language);
  }

  /**
   * Only English is supported, so toggling is a no-op that returns the current language
   */
  async toggleLanguage(): Promise<BuiltinTemplateLanguage> {
    return this.currentLanguage;
  }

  /**
   * Check if language is valid
   */
  async isValidLanguage(language: string): Promise<boolean> {
    return this.SUPPORTED_LANGUAGES.includes(language as BuiltinTemplateLanguage);
  }

  /**
   * Get supported languages list
   */
  async getSupportedLanguages(): Promise<BuiltinTemplateLanguage[]> {
    return [...this.SUPPORTED_LANGUAGES];
  }

  /**
   * Get display name for a language
   */
  getLanguageDisplayName(language: BuiltinTemplateLanguage): string {
    switch (language) {
      case 'en-US':
        return 'English';
      default:
        return language;
    }
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Factory for the template language service
 * @param preferenceService Preference service instance
 * @returns Template language service instance
 */
export function createTemplateLanguageService(
  preferenceService: IPreferenceService
): TemplateLanguageService {
  return new TemplateLanguageService(preferenceService);
}
