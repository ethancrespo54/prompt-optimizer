import { Template } from './types';
import { ALL_TEMPLATES } from './default-templates';
import { TemplateLoadError, TemplateValidationError } from './errors';

/**
 * Static template loader - simplified version
 *
 * 🎯 Minimal design: templates carry their own complete info (id, name, language, type, etc.)
 * 🔄 Used directly: no complex metadata derivation or mapping needed
 */

// Type definitions (supports 9 categories: basic + context + image + evaluation)
export type TemplateType =
  | 'optimize'
  | 'user-optimize'
  | 'text2imageOptimize'
  | 'image2imageOptimize'
  | 'imageIterate'
  | 'iterate'
  | 'conversation-message-optimize'
  | 'context-user-optimize'
  | 'context-iterate'
  | 'evaluation';
export type Language = 'en';

export interface StaticTemplateCollection {
  all: Record<string, Template>;
  byLanguage: Record<Language, Record<string, Template>>;
  byType: Record<TemplateType, Record<Language, Record<string, Template>>>;
}

export class StaticLoader {
  private static templateCache: StaticTemplateCollection | null = null;

  /**
   * The static loader is always supported (since static imports are used)
   */
  public isSupported(): boolean {
    return true;
  }

  /**
   * Language mapping: map the TemplateManager language identifier to the standard language identifier
   */
  private mapLanguage(language: string): Language {
    switch (language) {
      case 'en-US':
      case 'en':
        return 'en';
      default:
        console.warn(`Unknown language: ${language}, defaulting to en`);
        return 'en';
    }
  }

  /**
   * Load all templates (using each template's own complete info)
   */
  public loadTemplates(): StaticTemplateCollection {
    if (StaticLoader.templateCache) {
      return StaticLoader.templateCache;
    }

    try {
      console.log(`🔄 Static import started loading templates...`);
      
      const all: Record<string, Template> = {};
      const byLanguage: Record<Language, Record<string, Template>> = { en: {} };
      const byType: Record<TemplateType, Record<Language, Record<string, Template>>> = {
        'optimize': { en: {} },
        'user-optimize': { en: {} },
        'text2imageOptimize': { en: {} },
        'image2imageOptimize': { en: {} },
        'imageIterate': { en: {} },
        'iterate': { en: {} },
        'conversation-message-optimize': { en: {} },
        'context-user-optimize': { en: {} },
        'context-iterate': { en: {} },
        'evaluation': { en: {} }
      };

      // Process each template
      Object.values(ALL_TEMPLATES).forEach(template => {
        const { id, metadata } = template;
        const { language, templateType } = metadata;
        
        // Validate that built-in templates must contain the language field
        if (template.isBuiltin && !language) {
          console.error(`❌ Built-in template is missing the language field: ${id}`);
          throw new TemplateValidationError(
            `Built-in template '${id}' is missing required 'language' field in metadata`,
          );
        }
        
        // Normalize the template type (use metadata.templateType directly)
        let normalizedType: TemplateType;
        switch (templateType) {
          case 'userOptimize':
            normalizedType = 'user-optimize';
            break;
          case 'text2imageOptimize':
            normalizedType = 'text2imageOptimize';
            break;
          case 'image2imageOptimize':
            normalizedType = 'image2imageOptimize';
            break;
          case 'imageIterate':
            normalizedType = 'imageIterate';
            break;
          case 'conversationMessageOptimize':
            normalizedType = 'conversation-message-optimize';
            break;
          case 'contextUserOptimize':
            normalizedType = 'context-user-optimize';
            break;
          case 'contextIterate':
            normalizedType = 'context-iterate';
            break;
          case 'evaluation':
            normalizedType = 'evaluation';
            break;
          case 'iterate':
          case 'optimize':
          default:
            normalizedType = (templateType as any) === 'iterate' ? 'iterate' : (templateType as any) === 'optimize' ? 'optimize' : 'optimize';
            break;
        }
        
        // Store into each category
        all[id] = template;
        
        // Only categorize by language when the template is built-in and has a language field
        if (template.isBuiltin && language) {
          const lang = language as Language;  // Type assertion to ensure language is of type Language
          byLanguage[lang][id] = template;
          byType[normalizedType][lang][id] = template;
        }
      });

      const result = { all, byLanguage, byType };
      
      console.log(`✅ Successfully loaded ${Object.keys(all).length} templates`, {
        'total': Object.keys(all).length,
        'English': Object.keys(byLanguage.en).length,
        optimize: Object.keys(byType.optimize.en).length,
        'user-optimize': Object.keys(byType['user-optimize'].en).length,
        text2imageOptimize: Object.keys(byType.text2imageOptimize.en).length,
        image2imageOptimize: Object.keys(byType.image2imageOptimize.en).length,
        imageIterate: Object.keys(byType.imageIterate.en).length,
        iterate: Object.keys(byType.iterate.en).length,
        'conversation-message-optimize': Object.keys(byType['conversation-message-optimize'].en).length,
        'context-user-optimize': Object.keys(byType['context-user-optimize'].en).length,
        'context-iterate': Object.keys(byType['context-iterate'].en).length,
        evaluation: Object.keys(byType.evaluation.en).length
      });

      StaticLoader.templateCache = result;
      return result;

    } catch (error) {
      console.error('❌ Failed to load templates via static import:', error);
      throw new TemplateLoadError(
        'static-loader',
        `Failed to load static templates: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Load templates by language
   */
  public loadTemplatesByLanguage(language: string): Record<string, Template> {
    const mappedLanguage = this.mapLanguage(language);
    const collection = this.loadTemplates();
    return collection.byLanguage[mappedLanguage];
  }

  /**
   * Get templates by type and language
   */
  public getTemplatesByType(type: TemplateType, language: string = 'en'): Record<string, Template> {
    const mappedLanguage = this.mapLanguage(language);
    const collection = this.loadTemplates();
    return collection.byType[type][mappedLanguage];
  }

  /**
   * Get all template IDs
   */
  public getAllTemplateIds(): string[] {
    const collection = this.loadTemplates();
    return Object.keys(collection.all);
  }

  /**
   * Get the default template set (English)
   */
  public getDefaultTemplates(): Record<string, Template> {
    return this.loadTemplatesByLanguage('en');
  }

  /**
   * Get the default English template set
   */
  public getDefaultTemplatesEn(): Record<string, Template> {
    return this.loadTemplatesByLanguage('en');
  }

  /**
   * Get the loader status info
   */
  public getLoaderStatus() {
    const collection = this.loadTemplates();
    return {
      isSupported: this.isSupported(),
      totalTemplates: Object.keys(collection.all).length,
      byLanguage: {
        en: Object.keys(collection.byLanguage.en).length
      }
    };
  }

  /**
   * Reload templates (clear the cache)
   */
  public reloadTemplates(): Record<string, Template> {
    StaticLoader.templateCache = null;
    return this.getDefaultTemplates();
  }
}

// Create the singleton instance
const staticLoader = new StaticLoader();

// Export the singleton instance for external use
export { staticLoader }; 
