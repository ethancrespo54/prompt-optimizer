/**
 * Variable management-related type definitions
 */

// Unified message structure
export interface ConversationMessage {
  /**
   * Optional message ID (used by context/conversation mode for precise location and history restore)
   */
  id?: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string  // May contain variable syntax {{variableName}}
  /**
   * Optional original content (used for comparison / history restore)
   */
  originalContent?: string
  name?: string
  tool_calls?: {
    id: string
    type: 'function'
    function: {
      name: string
      arguments: string
    }
  }[]
  tool_call_id?: string
}

// Custom conversation test request
export interface CustomConversationRequest {
  modelKey: string;
  messages: ConversationMessage[];
  variables: Record<string, string>;
}

// Variable value type (the MVP stage only supports strings)
export interface VariableValue {
  value: string;
  type: 'string';  // The MVP stage only supports the string type
  description?: string;
  lastModified: number;
}

// Variable storage structure
export interface VariableStorage {
  customVariables: Record<string, string>;  // Simplified storage, values only
  advancedModeEnabled: boolean;
  lastConversationMessages?: ConversationMessage[];
}

// Variable source identifier
export type VariableSource = 'predefined' | 'custom';

// Variable manager interface
export interface IVariableManager {
  // Variable CRUD
  setVariable(name: string, value: string): void;
  getVariable(name: string): string | undefined;
  deleteVariable(name: string): void;
  listVariables(): Record<string, string>;
  
  // Variable resolution (predefined + custom)
  resolveAllVariables(context?: Record<string, unknown>): Record<string, string>;
  
  // Validation
  validateVariableName(name: string): boolean;
  scanVariablesInContent(content: string): string[];
  
  // Variable source check
  getVariableSource(name: string): VariableSource;
  isPredefinedVariable(name: string): boolean;
  
  // Advanced mode state
  getAdvancedModeEnabled(): boolean;
  setAdvancedModeEnabled(enabled: boolean): void;
  
  // Conversation message management
  getLastConversationMessages(): ConversationMessage[];
  setLastConversationMessages(messages: ConversationMessage[]): void;
  
  // Missing methods
  getStatistics(): { customVariableCount: number; predefinedVariableCount: number; totalVariableCount: number; advancedModeEnabled: boolean; };
  replaceVariables(content: string, variables?: Record<string, string>): string;
  detectMissingVariables(content: string | ConversationMessage[], availableVariables?: Record<string, string>): string[];
  exportVariables(): string;
  importVariables(jsonData: string): void;
}

// Variable error class
export class VariableError extends Error {
  constructor(
    message: string, 
    public variableName?: string, 
    public position?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'VariableError';
  }
}

import { PREDEFINED_VARIABLES as CORE_PREDEFINED_VARIABLES } from '@prompt-optimizer/core';

// Predefined variable constants (imported from core to ensure consistency)
export const PREDEFINED_VARIABLES = CORE_PREDEFINED_VARIABLES;

export type PredefinedVariable = typeof PREDEFINED_VARIABLES[number];

// Variable validation rules
export const VARIABLE_VALIDATION = {
  // Variable name rules: must not be empty, must not contain whitespace or curly braces
  NAME_PATTERN: /^[^\s{}]+$/,
  // Variable names must not start with a digit
  NO_NUMBER_START_PATTERN: /^\d/u,
  // Forbid Mustache control tag prefixes as variable names (avoids semantic conflicts with {{#if}} etc.)
  FORBIDDEN_PREFIX_PATTERN: /^[#/^!>&]/u,
  // Prevent prototype pollution / abnormal keys
  RESERVED_NAMES: ['__proto__', 'prototype', 'constructor'] as const,
  MAX_NAME_LENGTH: 50,
  MAX_VALUE_LENGTH: 10000,
  // Allow whitespace around variable name, but not inside it.
  // - valid: {{foo}}, {{ foo }}
  // - invalid: {{ foo bar }}
  // Also disallow names starting with a digit.
  VARIABLE_SCAN_PATTERN: /\{\{\s*([^\d{}\s][^{}\s]*)\s*\}\}/g
} as const;

export type ReservedVariableName = (typeof VARIABLE_VALIDATION.RESERVED_NAMES)[number]

export const isReservedVariableName = (name: string): name is ReservedVariableName => {
  return (VARIABLE_VALIDATION.RESERVED_NAMES as readonly string[]).includes(name)
}

export type VariableNameValidationError =
  | 'required'
  | 'tooLong'
  | 'forbiddenPrefix'
  | 'noNumberStart'
  | 'reservedName'
  | 'invalidCharacters'

export const getVariableNameValidationError = (name: string): VariableNameValidationError | null => {
  if (!name) return 'required'
  if (name.length > VARIABLE_VALIDATION.MAX_NAME_LENGTH) return 'tooLong'
  if (VARIABLE_VALIDATION.FORBIDDEN_PREFIX_PATTERN.test(name)) return 'forbiddenPrefix'
  if (VARIABLE_VALIDATION.NO_NUMBER_START_PATTERN.test(name)) return 'noNumberStart'
  if (isReservedVariableName(name)) return 'reservedName'
  if (!VARIABLE_VALIDATION.NAME_PATTERN.test(name)) return 'invalidCharacters'
  return null
}

export const isValidVariableName = (name: string): boolean => {
  return getVariableNameValidationError(name) === null
}

export const sanitizeVariableRecord = (input: unknown): Record<string, string> => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const next: Record<string, string> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === 'string' && isValidVariableName(key)) {
      next[key] = value
    }
  }
  return next
}
