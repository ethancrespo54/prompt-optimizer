import { z } from 'zod';
import { IImportExportable } from '../../interfaces/import-export';
import type { BuiltinTemplateLanguage } from './languageService';
import type { ToolCall } from '../prompt/types';

/**
 * Prompt metadata
 */
export interface TemplateMetadata {
  version: string;          // Prompt version
  lastModified: number;     // Last modified time
  author?: string;          // Author (optional)
  description?: string;     // Description (optional)
  templateType: 'optimize' | 'userOptimize' | 'text2imageOptimize' | 'image2imageOptimize' | 'imageIterate' | 'iterate' | 'conversationMessageOptimize' | 'contextUserOptimize' | 'contextIterate' | 'contextSystemOptimize' | 'evaluation'; // Template type identifier (includes legacy values for backward compatibility)
  language?: 'zh' | 'en';   // Template language (optional, mainly used for switching the built-in template language)
  [key: string]: any;       // Allow arbitrary extra fields
}

/**
 * Message template definition
 */
export interface MessageTemplate {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/**
 * Prompt definition
 */
export interface Template {
  id: string;              // Unique prompt identifier
  name: string;            // Prompt name
  content: string | MessageTemplate[];         // Prompt content - supports a string or a message array
  metadata: TemplateMetadata;
  isBuiltin?: boolean;     // Whether it is a built-in prompt
}

/**
 * Prompt source type
 */
export type TemplateSourceType = 'builtin' | 'localStorage';

export type TemplateType = TemplateMetadata['templateType'];

// TemplateManagerConfig was removed - the config parameters were never used

/**
 * Prompt manager interface
 */
export interface ITemplateManager extends IImportExportable {
  /**
   * Get a template by ID
   */
  getTemplate(id: string): Promise<Template>;

  /**
   * Save a template
   */
  saveTemplate(template: Template): Promise<void>;

  /**
   * Delete a template
   */
  deleteTemplate(id: string): Promise<void>;

  /**
   * List all templates
   */
  listTemplates(): Promise<Template[]>;

  /**
   * Export a template as JSON string
   */
  exportTemplate(id: string): Promise<string>;

  /**
   * Import a template from JSON string
   */
  importTemplate(jsonString: string): Promise<void>;

  /**
   * List templates by type
   */
  listTemplatesByType(type: TemplateType): Promise<Template[]>;

  /**
   * Change built-in template language
   */
  changeBuiltinTemplateLanguage(language: BuiltinTemplateLanguage): Promise<void>;

  /**
   * Get current built-in template language
   */
  getCurrentBuiltinTemplateLanguage(): Promise<BuiltinTemplateLanguage>;

  /**
   * Get supported built-in template languages
   */
  getSupportedBuiltinTemplateLanguages(): Promise<BuiltinTemplateLanguage[]>;
}

/**
 * Message template validation schema
 */
export const messageTemplateSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string().min(1)
});

/**
 * Prompt validation schema
 */
export const templateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  content: z.union([
    z.string().min(1),
    z.array(messageTemplateSchema).min(1)
  ]),
  metadata: z.object({
    version: z.string(),
    lastModified: z.number(),
    author: z.string().optional(),
    description: z.string().optional(),
    templateType: z.enum(['optimize', 'userOptimize', 'text2imageOptimize', 'image2imageOptimize', 'imageIterate', 'iterate', 'conversationMessageOptimize', 'contextUserOptimize', 'contextIterate', 'contextSystemOptimize', 'evaluation']),  // 🔧 Backward compatibility: keep the old enum values
    language: z.enum(['zh', 'en']).optional()
  }).passthrough(), // Allow extra fields to pass validation
  isBuiltin: z.boolean().optional()
});
