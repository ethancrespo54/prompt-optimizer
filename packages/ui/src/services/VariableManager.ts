/**
 * UI layer variable manager
 * Responsible for managing, storing, and resolving custom variables
 */

import type { IPreferenceService } from '@prompt-optimizer/core';
import { 
  PREDEFINED_VARIABLES, 
  VARIABLE_VALIDATION,
  isValidVariableName,
  getVariableNameValidationError,
  VariableError,
  type IVariableManager, 
  type VariableStorage, 
  type ConversationMessage, 
  type VariableSource,
  type PredefinedVariable
} from '../types/variable';

// Storage keys
const STORAGE_KEYS = {
  VARIABLES: 'variableManager.storage',
  ADVANCED_MODE: 'variableManager.advancedMode'
} as const;

/**
 * Variable scan cache entry
 */
interface ScanCacheEntry {
  content: string;
  variables: string[];
  timestamp: number;
}

/**
 * 🆕 Factory function: create and initialize a VariableManager (recommended)
 * @param preferenceService - Preference service
 * @returns An initialized VariableManager instance
 *
 * @example
 * const manager = await createVariableManager(preferenceService);
 * // The data has finished loading at this point, so it is safe to use
 * const vars = manager.listVariables();
 */
export async function createVariableManager(
  preferenceService: IPreferenceService
): Promise<VariableManager> {
  const manager = new VariableManager(preferenceService);
  await manager.waitForInitialization();
  return manager;
}

/**
 * Variable manager implementation
 *
 * ⚠️ Note: when creating an instance directly with new VariableManager(), waitForInitialization() must be called manually
 * The createVariableManager() factory function is recommended, as it handles initialization automatically.
 */
export class VariableManager implements IVariableManager {
  private customVariables: Record<string, string> = {};
  private advancedModeEnabled: boolean = false;
  private lastConversationMessages: ConversationMessage[] = [];

  // 🆕 Initialization Promise, used to wait for the async load to complete
  private _initPromise: Promise<void>;

  // 🆕 Optional callback after the data finishes loading
  private _onDataLoaded?: () => void;

  // Variable scan cache
  private scanCache: Map<string, ScanCacheEntry> = new Map();
  private readonly CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5-minute cache
  private readonly MAX_CACHE_SIZE = 100; // Maximum number of cache entries

  constructor(private preferenceService: IPreferenceService) {
    // Save the Promise so that external code can wait for initialization to complete
    this._initPromise = this.loadFromStorage();
  }

  // Wait for initialization to complete
  async waitForInitialization(): Promise<void> {
    await this._initPromise;
  }

  // Set the callback after the data finishes loading (optional, used to notify outside code to refresh)
  setOnDataLoaded(callback: () => void): void {
    this._onDataLoaded = callback;
  }

  // Variable CRUD operations
  setVariable(name: string, value: string): void {
    if (!this.validateVariableName(name)) {
      const reason = getVariableNameValidationError(name)
      const reasonText = (() => {
        switch (reason) {
          case 'required':
            return 'Name is required.'
          case 'tooLong':
            return `Name must be at most ${VARIABLE_VALIDATION.MAX_NAME_LENGTH} characters.`
          case 'forbiddenPrefix':
            return 'Name cannot start with # / ^ ! > &.'
          case 'noNumberStart':
            return 'Name cannot start with a number.'
          case 'reservedName':
            return 'Name is reserved.'
          case 'invalidCharacters':
            return 'Name cannot contain whitespace or braces ({}).' 
          default:
            return 'Name is invalid.'
        }
      })()
      throw new VariableError(
        `Invalid variable name: ${name}. ${reasonText}`,
        name,
        undefined,
        'INVALID_VARIABLE_NAME'
      );
    }

    if (this.isPredefinedVariable(name)) {
      throw new VariableError(
        `Cannot override predefined variable: ${name}`,
        name,
        undefined,
        'PREDEFINED_VARIABLE_OVERRIDE'
      );
    }

    if (value.length > VARIABLE_VALIDATION.MAX_VALUE_LENGTH) {
      throw new VariableError(
        `Variable value too long: ${value.length} > ${VARIABLE_VALIDATION.MAX_VALUE_LENGTH}`,
        name,
        undefined,
        'VALUE_TOO_LONG'
      );
    }

    this.customVariables[name] = value;
    this.saveToStorage();
  }

  getVariable(name: string): string | undefined {
    return this.customVariables[name];
  }

  deleteVariable(name: string): void {
    if (this.isPredefinedVariable(name)) {
      throw new VariableError(
        `Cannot delete predefined variable: ${name}`,
        name,
        undefined,
        'DELETE_PREDEFINED_VARIABLE'
      );
    }

    delete this.customVariables[name];
    this.saveToStorage();
  }

  listVariables(): Record<string, string> {
    return { ...this.customVariables };
  }

  // Variable resolution
  resolveAllVariables(context?: Record<string, unknown>): Record<string, string> {
    // Get the value of a predefined variable
    const predefinedValues: Record<string, string> = {};
    
    if (context) {
      // Extract the predefined variables from the context
      for (const varName of PREDEFINED_VARIABLES) {
        if (Object.prototype.hasOwnProperty.call(context, varName)) {
          const value = context[varName];
          predefinedValues[varName] = value != null ? String(value) : '';
        } else {
          predefinedValues[varName] = '';
        }
      }
    } else {
      // Without a context, the predefined variables are empty
      for (const varName of PREDEFINED_VARIABLES) {
        predefinedValues[varName] = '';
      }
    }

    // Merge predefined and custom variables (custom variables have higher priority but cannot override predefined variables)
    return { ...predefinedValues, ...this.customVariables };
  }

  // Validation methods
  validateVariableName(name: string): boolean {
    return isValidVariableName(name)
  }

  scanVariablesInContent(content: string): string[] {
    const variables: string[] = [];
    
    // Defensive programming: make sure content is a string
    if (typeof content !== 'string') {
      console.warn('[VariableManager] scanVariablesInContent received non-string input:', typeof content, content);
      return variables;
    }
    
    const matches = content.matchAll(VARIABLE_VALIDATION.VARIABLE_SCAN_PATTERN);
    
    for (const match of matches) {
      if (match[1]) {
        const variableName = match[1].trim();
        // Skip Mustache control tags (#, /, ^, !, >, &) to avoid false missing-variable reports.
        if (VARIABLE_VALIDATION.FORBIDDEN_PREFIX_PATTERN.test(variableName)) {
          continue;
        }
        if (!isValidVariableName(variableName)) {
          continue;
        }
        if (variableName && !variables.includes(variableName)) {
          variables.push(variableName);
        }
      }
    }
    
    return variables;
  }

  // Variable source check
  getVariableSource(name: string): VariableSource {
    return this.isPredefinedVariable(name) ? 'predefined' : 'custom';
  }

  isPredefinedVariable(name: string): boolean {
    return PREDEFINED_VARIABLES.includes(name as PredefinedVariable);
  }

  // Advanced mode state management
  getAdvancedModeEnabled(): boolean {
    return this.advancedModeEnabled;
  }

  setAdvancedModeEnabled(enabled: boolean): void {
    this.advancedModeEnabled = enabled;
    this.saveToStorage();
  }

  // Conversation message management
  getLastConversationMessages(): ConversationMessage[] {
    return [...this.lastConversationMessages];
  }

  setLastConversationMessages(messages: ConversationMessage[]): void {
    this.lastConversationMessages = [...messages];
    this.saveToStorage();
  }

  // Missing variable detection
  detectMissingVariables(
    content: string | ConversationMessage[], 
    availableVariables?: Record<string, string>
  ): string[] {
    const variables = availableVariables || this.resolveAllVariables();
    const usedVariables = new Set<string>();

    if (typeof content === 'string') {
      // Single string content
      const foundVariables = this.scanVariablesInContent(content);
      foundVariables.forEach(varName => usedVariables.add(varName));
    } else {
      // Message array
      content.forEach(message => {
        const foundVariables = this.scanVariablesInContent(message.content);
        foundVariables.forEach(varName => usedVariables.add(varName));
      });
    }

    // Return the missing variables
    return Array.from(usedVariables).filter(varName => 
      variables[varName] === undefined || String(variables[varName]).trim() === ''
    );
  }

  // Variable substitution
  replaceVariables(content: string, variables?: Record<string, string>): string {
    const finalVariables = variables || this.resolveAllVariables();
    
    return content.replace(VARIABLE_VALIDATION.VARIABLE_SCAN_PATTERN, (match, variableName) => {
      const trimmedName = variableName.trim();

      // Keep Mustache control tags and invalid names as-is.
      if (VARIABLE_VALIDATION.FORBIDDEN_PREFIX_PATTERN.test(trimmedName)) return match;
      if (!isValidVariableName(trimmedName)) return match;

      const value = finalVariables[trimmedName];
      
      // If the variable does not exist, keep the original placeholder (do not fail silently)
      return value !== undefined ? String(value) : match;
    });
  }

  // Data persistence
  private async loadFromStorage(): Promise<void> {
    try {
      const storage = await this.preferenceService.get<VariableStorage>(
        STORAGE_KEYS.VARIABLES,
        {
          customVariables: {},
          advancedModeEnabled: false,
          lastConversationMessages: []
        }
      );

      this.customVariables = storage.customVariables || {};
      this.advancedModeEnabled = storage.advancedModeEnabled || false;
      this.lastConversationMessages = storage.lastConversationMessages || [];

      // Sanitize persisted customVariables to avoid prototype pollution and invalid keys.
      const sanitized: Record<string, string> = {};
      if (storage.customVariables && typeof storage.customVariables === 'object') {
        for (const [name, value] of Object.entries(storage.customVariables)) {
          if (typeof value === 'string' && this.validateVariableName(name)) {
            sanitized[name] = value;
          }
        }
      }
      this.customVariables = sanitized;

      // Trigger the callback to notify outside code that the data has loaded
      if (this._onDataLoaded) {
        this._onDataLoaded();
      }
    } catch (error) {
      console.warn('[VariableManager] Failed to load from storage:', error);
      // Continue using the default values
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      const storage: VariableStorage = {
        customVariables: this.customVariables,
        advancedModeEnabled: this.advancedModeEnabled,
        lastConversationMessages: this.lastConversationMessages
      };

      await this.preferenceService.set(STORAGE_KEYS.VARIABLES, storage);
    } catch (error) {
      console.error('[VariableManager] Failed to save to storage:', error);
      // Do not throw, to avoid affecting user operations
    }
  }

  // Debugging and utility methods
  exportVariables(): string {
    const exportData = {
      customVariables: this.customVariables,
      advancedModeEnabled: this.advancedModeEnabled,
      exportTime: new Date().toISOString()
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  importVariables(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.customVariables && typeof data.customVariables === 'object') {
        // Validate each variable name
        for (const [name, value] of Object.entries(data.customVariables)) {
          if (typeof value === 'string' && this.validateVariableName(name)) {
            this.customVariables[name] = value;
          }
        }
      }

      if (typeof data.advancedModeEnabled === 'boolean') {
        this.advancedModeEnabled = data.advancedModeEnabled;
      }

      this.saveToStorage();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new VariableError(
        `Failed to import variables: ${errorMessage}`,
        undefined,
        undefined,
        'IMPORT_ERROR'
      );
    }
  }

  // Get variable statistics
  getStatistics(): {
    customVariableCount: number;
    predefinedVariableCount: number;
    totalVariableCount: number;
    advancedModeEnabled: boolean;
  } {
    return {
      customVariableCount: Object.keys(this.customVariables).length,
      predefinedVariableCount: PREDEFINED_VARIABLES.length,
      totalVariableCount: Object.keys(this.customVariables).length + PREDEFINED_VARIABLES.length,
      advancedModeEnabled: this.advancedModeEnabled
    };
  }
}
