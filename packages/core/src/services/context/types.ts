/**
 * Context-related type definitions
 * 
 * This module defines the core data structures for context persistence and variable management:
 * - ContextPackage: the complete data package for a single context
 * - ContextStoreDoc: the storage structure of the single-document repository (contains all contexts and the current selection)
 * - ContextRepo: the context repository service interface
 * - ContextBundle: the data package format for import/export
 */

import type { IImportExportable } from '../../interfaces/import-export';
import type { ConversationMessage, ToolDefinition } from '../prompt/types';
import { CONTEXT_ERROR_CODES, type ErrorParams } from '../../constants/error-codes';

/**
 * Context mode
 * - system: system mode, keeps full message editing capability
 * - user: user mode, focused on variable and tool management
 */
export type ContextMode = 'system' | 'user';

/**
 * Context data package
 * Contains all information of a complete context: messages, variable overrides, tools, etc.
 */
export interface ContextPackage {
  /** Unique context identifier */
  id: string;
  /** Context title */
  title: string;
  /** Context mode */
  mode: ContextMode;
  /** Data version, for future compatibility */
  version?: string;
  /** Creation time (ISO string) */
  createdAt: string;
  /** Last update time (ISO string) */
  updatedAt: string;
  /** Conversation message list */
  messages: ConversationMessage[];
  /** Variable overrides (context-level overrides only, no global variables) */
  variables: Record<string, string>;
  /** Tool definition list */
  tools: ToolDefinition[];
  /** Tag list, used for categorization and search */
  tags?: string[];
  /** Context description */
  description?: string;
  /** Metadata, for extension */
  meta?: Record<string, any>;
}

/**
 * Context storage document
 * Root data structure of the single-document repository, containing all contexts and the current selection
 */
export interface ContextStoreDoc {
  /** Document format version */
  version: '1.0.0';
  /** Currently selected context ID */
  currentId: string;
  /** Map of all contexts */
  contexts: Record<string, ContextPackage>;
}

/**
 * Context list item
 * Slim information used for list display
 */
export interface ContextListItem {
  /** Context ID */
  id: string;
  /** Context title */
  title: string;
  /** Last update time (ISO string) */
  updatedAt: string;
}

/**
 * Context import/export package
 * Used for migrating and sharing context collections
 */
export interface ContextBundle {
  /** Data package type identifier */
  type: 'context-bundle';
  /** Data package version */
  version: '1.0.0';
  /** Currently selected context ID */
  currentId: string;
  /** Context list */
  contexts: ContextPackage[];
}

/**
 * Import mode
 */
export type ImportMode = 'replace' | 'append' | 'merge';

/**
 * Import result statistics
 */
export interface ImportResult {
  /** Number of contexts imported successfully */
  imported: number;
  /** Number of contexts skipped (malformed, etc.) */
  skipped: number;
  /** Number of predefined-variable overrides stripped */
  predefinedVariablesRemoved: number;
  /** Map of newly generated IDs (used for ID conflict handling in append mode) */
  idMapping?: Record<string, string>;
}

/**
 * Context repository interface
 * Provides create/read/update/delete and import/export for contexts
 */
export interface ContextRepo extends IImportExportable {
  // === Basic queries ===
  /**
   * Get the context list
   * @returns Array of context list items
   */
  list(): Promise<ContextListItem[]>;

  /**
   * Get the currently selected context ID
   * @returns Current context ID
   */
  getCurrentId(): Promise<string>;

  /**
   * Set the currently selected context ID
   * @param id Context ID to set
   * @throws Throws an error if the given ID does not exist
   */
  setCurrentId(id: string): Promise<void>;

  /**
   * Get the complete data of the given context
   * @param id Context ID
   * @returns Context data package
   * @throws Throws an error if the given ID does not exist
   */
  get(id: string): Promise<ContextPackage>;

  // === Content management ===
  /**
   * Create a new context
   * @param meta Optional metadata (title, mode, etc.)
   * @returns ID of the newly created context
   */
  create(meta?: { title?: string; mode?: ContextMode }): Promise<string>;

  /**
   * Duplicate an existing context
   * @param id ID of the context to duplicate
   * @param options Optional config, including mode
   * @returns ID of the newly created context
   * @throws Throws an error if the source ID does not exist
   */
  duplicate(id: string, options?: { mode?: ContextMode }): Promise<string>;

  /**
   * Rename the context
   * @param id Context ID
   * @param title New title
   * @throws Throws an error if the given ID does not exist
   */
  rename(id: string, title: string): Promise<void>;

  /**
   * Save the complete context data (overwrite mode)
   * @param ctx Context data package
   */
  save(ctx: ContextPackage): Promise<void>;

  /**
   * Update part of the context data (merge mode)
   * @param id Context ID
   * @param patch Fields to update
   * @throws Throws an error if the given ID does not exist
   */
  update(id: string, patch: Partial<ContextPackage>): Promise<void>;

  /**
   * Delete the context
   * @param id Context ID
   * @throws Throws an error if the given ID does not exist or it is the last context
   */
  remove(id: string): Promise<void>;

  // === Import/export ===
  /**
   * Export all contexts
   * @returns Context import/export package
   */
  exportAll(): Promise<ContextBundle>;

  /**
   * Import a collection of contexts
   * @param bundle Context import/export package
   * @param mode Import mode
   * @returns Import result statistics
   */
  importAll(bundle: ContextBundle, mode: ImportMode): Promise<ImportResult>;
}

/**
 * Context service error class
 */
export class ContextError extends Error {
  public readonly code: string
  public readonly params?: ErrorParams

  constructor(code: string, message?: string, params?: ErrorParams) {
    super(message ? `[${code}] ${message}` : `[${code}]`)
    this.name = 'ContextError'
    this.code = code
    this.params = params ?? (message ? { details: message } : undefined)
  }
}

export { CONTEXT_ERROR_CODES }
