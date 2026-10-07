/**
 * Context repository implementation
 * 
 * A single-document repository based on IStorageProvider that manages persistence of multiple contexts:
 * - Stores all contexts and the current selection under a single key 'ctx:store'
 * - Uses updateData to guarantee atomic updates and concurrency safety
 * - Supports import/export, including multiple import modes
 * - Strips predefined-variable overrides as a protection
 */

import type { IStorageProvider } from '../storage/types';
import type {
  ContextPackage,
  ContextStoreDoc,
  ContextListItem,
  ContextBundle,
  ContextRepo,
  ImportMode,
  ImportResult
} from './types';
import { ContextError, CONTEXT_ERROR_CODES } from './types';
import {
  CONTEXT_STORE_KEY,
  PREDEFINED_VARIABLES,
  DEFAULT_CONTEXT_CONFIG,
  CONTEXT_STORE_VERSION,
  CONTEXT_UI_LABELS,
  DEFAULT_CONTEXT_MODE
} from './constants';

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get the current time as an ISO string
 */
function getCurrentISOTime(): string {
  return new Date().toISOString();
}

/**
 * Generate a strictly monotonically increasing ISO time based on the previous timestamp
 */
function getMonotonicISO(previous?: string): string {
  const nowIso = new Date().toISOString();
  if (!previous) return nowIso;
  // Direct string comparison works for ISO8601 ordering
  if (nowIso > previous) return nowIso;
  const nextMs = new Date(previous).getTime() + 1;
  return new Date(nextMs).toISOString();
}

/**
 * Check whether a name is a predefined variable name
 */
function isPredefinedVariable(name: string): boolean {
  return (PREDEFINED_VARIABLES as readonly string[]).includes(name);
}

/**
 * Strip predefined-variable overrides from the variables object
 * @param variables Original variables object
 * @returns [Cleaned variables object, number of entries stripped]
 */
function sanitizeVariables(variables: Record<string, string>): [Record<string, string>, number] {
  const sanitized: Record<string, string> = {};
  let removedCount = 0;

  for (const [name, value] of Object.entries(variables)) {
    if (isPredefinedVariable(name)) {
      removedCount++;
      // Only record a warning; do not output to console (as required)
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[ContextRepo] Removed predefined variable override: ${name}`);
      }
    } else {
      sanitized[name] = value;
    }
  }

  return [sanitized, removedCount];
}

/**
 * Context repository implementation class
 */
export class ContextRepoImpl implements ContextRepo {
  private storage: IStorageProvider;

  constructor(storage: IStorageProvider) {
    this.storage = storage;
  }

  // === Private helper methods ===

  /**
   * Get the storage document, initializing it if it does not exist
   */
  private async getStoreDoc(): Promise<ContextStoreDoc> {
    const data = await this.storage.getItem(CONTEXT_STORE_KEY);
    
    if (!data) {
      // Initialize the default document
      const now = getCurrentISOTime();
      const defaultContext: ContextPackage = {
        id: DEFAULT_CONTEXT_CONFIG.id,
        title: DEFAULT_CONTEXT_CONFIG.title,
        mode: DEFAULT_CONTEXT_MODE,
        version: DEFAULT_CONTEXT_CONFIG.version,
        createdAt: now,
        updatedAt: now,
        messages: [],
        variables: {},
        tools: [],
        tags: [],
        description: '',
        meta: {}
      };

      const doc: ContextStoreDoc = {
        version: CONTEXT_STORE_VERSION,
        currentId: DEFAULT_CONTEXT_CONFIG.id,
        contexts: {
          [DEFAULT_CONTEXT_CONFIG.id]: defaultContext
        }
      };

      // Save the initial document immediately
      await this.storage.setItem(CONTEXT_STORE_KEY, JSON.stringify(doc));
      return doc;
    }

    try {
      const doc = JSON.parse(data) as ContextStoreDoc;

      // Basic validation
      if (!doc.currentId || !doc.contexts || typeof doc.contexts !== 'object') {
        throw new ContextError(CONTEXT_ERROR_CODES.INVALID_STORE, 'Invalid document structure');
      }

      // Migration logic: backfill the mode field for contexts in old documents
      let migrated = false;
      for (const ctx of Object.values(doc.contexts)) {
        if (!ctx.mode) {
          ctx.mode = DEFAULT_CONTEXT_MODE;
          migrated = true;
        }
      }

      // If anything was migrated, save it back to storage
      if (migrated) {
        await this.storage.setItem(CONTEXT_STORE_KEY, JSON.stringify(doc));
        if (process.env.NODE_ENV === 'development') {
          console.log('[ContextRepo] Migrated contexts to add mode field');
        }
      }

      // Ensure the context for currentId exists
      if (!doc.contexts[doc.currentId]) {
        // Fix: select the first available context
        const availableIds = Object.keys(doc.contexts);
        if (availableIds.length > 0) {
          doc.currentId = availableIds[0];
        } else {
          throw new ContextError(CONTEXT_ERROR_CODES.INVALID_STORE, 'No contexts available');
        }
      }

      return doc;
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error)
      throw new ContextError(
        CONTEXT_ERROR_CODES.STORAGE_ERROR,
        `Failed to parse context store: ${details}`,
        { details },
      );
    }
  }

  /**
   * Update the storage document
   */
  private async updateStoreDoc(
    updater: (doc: ContextStoreDoc) => ContextStoreDoc
  ): Promise<ContextStoreDoc> {
    let updatedDoc: ContextStoreDoc;

    await this.storage.updateData<ContextStoreDoc>(
      CONTEXT_STORE_KEY,
      (currentDoc: ContextStoreDoc | null) => {
        // If the current data is empty, create a complete default document
        let baseDoc: ContextStoreDoc;
        if (!currentDoc) {
          const now = getCurrentISOTime();
          const defaultContext: ContextPackage = {
            id: DEFAULT_CONTEXT_CONFIG.id,
            title: DEFAULT_CONTEXT_CONFIG.title,
            mode: DEFAULT_CONTEXT_MODE,
            version: DEFAULT_CONTEXT_CONFIG.version,
            createdAt: now,
            updatedAt: now,
            messages: [],
            variables: {},
            tools: [],
            tags: [],
            description: '',
            meta: {}
          };
          baseDoc = {
            version: CONTEXT_STORE_VERSION,
            currentId: DEFAULT_CONTEXT_CONFIG.id,
            contexts: {
              [DEFAULT_CONTEXT_CONFIG.id]: defaultContext
            }
          };
        } else {
          baseDoc = currentDoc;
        }

        updatedDoc = updater(baseDoc);
        return updatedDoc;
      }
    );

    return updatedDoc!;
  }

  // === Public API methods ===

  async list(): Promise<ContextListItem[]> {
    const doc = await this.getStoreDoc();
    
    return Object.values(doc.contexts).map(ctx => ({
      id: ctx.id,
      title: ctx.title,
      updatedAt: ctx.updatedAt
    })).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getCurrentId(): Promise<string> {
    const doc = await this.getStoreDoc();
    return doc.currentId;
  }

  async setCurrentId(id: string): Promise<void> {
    await this.updateStoreDoc(doc => {
      if (!doc.contexts[id]) {
        throw new ContextError(CONTEXT_ERROR_CODES.NOT_FOUND, undefined, { context: id });
      }
      doc.currentId = id;
      return doc;
    });
  }

  async get(id: string): Promise<ContextPackage> {
    const doc = await this.getStoreDoc();
    const context = doc.contexts[id];
    
    if (!context) {
      throw new ContextError(CONTEXT_ERROR_CODES.NOT_FOUND, undefined, { context: id });
    }

    return { ...context };
  }

  async create(meta?: { title?: string; mode?: import('./types').ContextMode }): Promise<string> {
    const id = generateId();
    const now = getCurrentISOTime();

    const newContext: ContextPackage = {
      id,
      title: meta?.title || `${CONTEXT_UI_LABELS.DEFAULT_TITLE_TEMPLATE} ${new Date().toLocaleDateString()}`,
      mode: meta?.mode || DEFAULT_CONTEXT_MODE,
      version: DEFAULT_CONTEXT_CONFIG.version,
      createdAt: now,
      updatedAt: now,
      messages: [],
      variables: {},
      tools: [],
      tags: [],
      description: '',
      meta: {}
    };

    await this.updateStoreDoc(doc => {
      doc.contexts[id] = newContext;
      return doc;
    });

    return id;
  }

  async duplicate(id: string, options?: { mode?: import('./types').ContextMode }): Promise<string> {
    const originalCtx = await this.get(id); // Throws an error if it does not exist
    const newId = generateId();
    const now = getCurrentISOTime();

    // Variables also need to be cleaned when duplicating
    const [sanitizedVariables] = sanitizeVariables(originalCtx.variables);

    const newContext: ContextPackage = {
      ...originalCtx,
      id: newId,
      title: `${originalCtx.title} ${CONTEXT_UI_LABELS.DUPLICATE_SUFFIX}`,
      mode: options?.mode || originalCtx.mode || DEFAULT_CONTEXT_MODE,
      variables: sanitizedVariables,
      createdAt: now,
      updatedAt: now
    };

    await this.updateStoreDoc(doc => {
      doc.contexts[newId] = newContext;
      return doc;
    });

    return newId;
  }

  async rename(id: string, title: string): Promise<void> {
    await this.updateStoreDoc(doc => {
      const context = doc.contexts[id];
      if (!context) {
        throw new ContextError(CONTEXT_ERROR_CODES.NOT_FOUND, undefined, { context: id });
      }

      context.title = title;
      context.updatedAt = getMonotonicISO(context.updatedAt);
      return doc;
    });
  }

  async save(ctx: ContextPackage): Promise<void> {
    // Strip predefined-variable overrides
    const [sanitizedVariables, removedCount] = sanitizeVariables(ctx.variables);
    
    const contextToSave: ContextPackage = {
      ...ctx,
      mode: ctx.mode || DEFAULT_CONTEXT_MODE,
      variables: sanitizedVariables,
      updatedAt: getCurrentISOTime()
    };

    await this.updateStoreDoc(doc => {
      doc.contexts[ctx.id] = contextToSave;
      return doc;
    });

    if (removedCount > 0 && process.env.NODE_ENV === 'development') {
      console.warn(`[ContextRepo] Removed ${removedCount} predefined variable overrides during save`);
    }
  }

  async update(id: string, patch: Partial<ContextPackage>): Promise<void> {
    await this.updateStoreDoc(doc => {
      const context = doc.contexts[id];
      if (!context) {
        throw new ContextError(CONTEXT_ERROR_CODES.NOT_FOUND, undefined, { context: id });
      }

      // Handle stripping of predefined variables on variable updates
      let sanitizedVariables = patch.variables;
      let removedCount = 0;
      
      if (patch.variables) {
        [sanitizedVariables, removedCount] = sanitizeVariables(patch.variables);
      }

      // Read-only field protection: strip immutable fields and only allow specific fields to be updated
      const allowedFields = ['title', 'messages', 'tools', 'tags', 'description', 'meta'] as const;
      const safeUpdate: Partial<ContextPackage> = {};
      
      for (const field of allowedFields) {
        if (field in patch && patch[field] !== undefined) {
          (safeUpdate as any)[field] = patch[field];
        }
      }
      
      // Merge the safe update fields
      Object.assign(context, safeUpdate, {
        mode: patch.mode ?? context.mode ?? DEFAULT_CONTEXT_MODE,
        variables: sanitizedVariables || context.variables,
        updatedAt: getMonotonicISO(context.updatedAt)
      });

      if (removedCount > 0 && process.env.NODE_ENV === 'development') {
        console.warn(`[ContextRepo] Removed ${removedCount} predefined variable overrides during update`);
      }

      return doc;
    });
  }

  async remove(id: string): Promise<void> {
    await this.updateStoreDoc(doc => {
      // First check that the context exists
      if (!doc.contexts[id]) {
        throw new ContextError(CONTEXT_ERROR_CODES.NOT_FOUND, undefined, { context: id });
      }

      const contextIds = Object.keys(doc.contexts);
      
      // Then check whether it is the last context
      if (contextIds.length <= 1) {
        throw new ContextError(CONTEXT_ERROR_CODES.MINIMUM_VIOLATION);
      }

      // Delete the context
      delete doc.contexts[id];

      // If the deleted one is the current context, switch to another
      if (doc.currentId === id) {
        const remainingIds = Object.keys(doc.contexts);
        // Prefer default, otherwise choose the first available
        doc.currentId = remainingIds.includes(DEFAULT_CONTEXT_CONFIG.id) 
          ? DEFAULT_CONTEXT_CONFIG.id 
          : remainingIds[0];
      }

      return doc;
    });
  }

  async exportAll(): Promise<ContextBundle> {
    const doc = await this.getStoreDoc();
    
    return {
      type: 'context-bundle',
      version: CONTEXT_STORE_VERSION,
      currentId: doc.currentId,
      contexts: Object.values(doc.contexts)
    };
  }

  async importAll(bundle: ContextBundle, mode: ImportMode): Promise<ImportResult> {
    // Validate the bundle format
    if (!bundle || bundle.type !== 'context-bundle' || !Array.isArray(bundle.contexts)) {
      throw new ContextError(CONTEXT_ERROR_CODES.IMPORT_FORMAT_ERROR, 'Invalid context bundle format');
    }

    if (bundle.contexts.length === 0) {
      throw new ContextError(CONTEXT_ERROR_CODES.IMPORT_FORMAT_ERROR, 'Context bundle must contain at least one context');
    }

    let imported = 0;
    let skipped = 0;
    let predefinedVariablesRemoved = 0;
    const idMapping: Record<string, string> = {};

    await this.updateStoreDoc(doc => {
      const now = getCurrentISOTime();

      switch (mode) {
        case 'replace':
          // Replace mode: clear existing data
          doc.contexts = {};
          doc.currentId = bundle.currentId;
          
          // Import all contexts
          for (const ctx of bundle.contexts) {
            try {
              const [sanitizedVariables, removedCount] = sanitizeVariables(ctx.variables);
              predefinedVariablesRemoved += removedCount;

              const contextToImport: ContextPackage = {
                ...ctx,
                mode: ctx.mode || DEFAULT_CONTEXT_MODE,
                variables: sanitizedVariables,
                updatedAt: now
              };

              doc.contexts[ctx.id] = contextToImport;
              imported++;
            } catch (error) {
              skipped++;
            }
          }

          // Validate that currentId is valid
          if (!doc.contexts[doc.currentId] && Object.keys(doc.contexts).length > 0) {
            doc.currentId = Object.keys(doc.contexts)[0];
          }
          break;

        case 'append':
          // Append mode: handle ID conflicts
          for (const ctx of bundle.contexts) {
            try {
              const [sanitizedVariables, removedCount] = sanitizeVariables(ctx.variables);
              predefinedVariablesRemoved += removedCount;

              let finalId = ctx.id;
              
              // If the ID conflicts, generate a new ID
              if (doc.contexts[ctx.id]) {
                finalId = generateId();
                idMapping[ctx.id] = finalId;
              }

              const contextToImport: ContextPackage = {
                ...ctx,
                id: finalId,
                mode: ctx.mode || DEFAULT_CONTEXT_MODE,
                variables: sanitizedVariables,
                updatedAt: now
              };

              doc.contexts[finalId] = contextToImport;
              imported++;
            } catch (error) {
              skipped++;
            }
          }
          break;

        case 'merge':
          // Merge mode: same ID overwrites, variables are merged
          for (const ctx of bundle.contexts) {
            try {
              const [sanitizedVariables, removedCount] = sanitizeVariables(ctx.variables);
              predefinedVariablesRemoved += removedCount;

              if (doc.contexts[ctx.id]) {
                // Same ID exists: merge variables; other fields follow the import
                const existingCtx = doc.contexts[ctx.id];
                const mergedVariables = {
                  ...existingCtx.variables,
                  ...sanitizedVariables
                };

                doc.contexts[ctx.id] = {
                  ...ctx,
                  mode: ctx.mode || existingCtx.mode || DEFAULT_CONTEXT_MODE,
                  variables: mergedVariables,
                  updatedAt: now
                };
              } else {
                // New ID: add directly
                doc.contexts[ctx.id] = {
                  ...ctx,
                  mode: ctx.mode || DEFAULT_CONTEXT_MODE,
                  variables: sanitizedVariables,
                  updatedAt: now
                };
              }
              imported++;
            } catch (error) {
              skipped++;
            }
          }
          break;
      }

      // Ensure at least one context exists
      if (Object.keys(doc.contexts).length === 0) {
        throw new ContextError(CONTEXT_ERROR_CODES.IMPORT_FORMAT_ERROR, 'Import failed: No valid contexts found');
      }

      // Ensure currentId is valid
      if (!doc.contexts[doc.currentId]) {
        doc.currentId = Object.keys(doc.contexts)[0];
      }

      return doc;
    });

    const result: ImportResult = {
      imported,
      skipped,
      predefinedVariablesRemoved
    };

    if (Object.keys(idMapping).length > 0) {
      result.idMapping = idMapping;
    }

    return result;
  }

  // === IImportExportable implementation ===

  async exportData(): Promise<ContextBundle> {
    return this.exportAll();
  }

  async importData(data: any): Promise<void> {
    if (!(await this.validateData(data))) {
      throw new ContextError(CONTEXT_ERROR_CODES.IMPORT_FORMAT_ERROR, 'Invalid import data format');
    }
    
    await this.importAll(data as ContextBundle, 'replace');
  }

  async getDataType(): Promise<string> {
    return 'context-bundle';
  }

  async validateData(data: any): Promise<boolean> {
    return !!(
      data &&
      data.type === 'context-bundle' &&
      typeof data.version === 'string' &&
      typeof data.currentId === 'string' &&
      Array.isArray(data.contexts) &&
      data.contexts.length > 0
    );
  }
}

/**
 * Factory function for creating a ContextRepo instance
 */
export function createContextRepo(storage: IStorageProvider): ContextRepo {
  return new ContextRepoImpl(storage);
}
