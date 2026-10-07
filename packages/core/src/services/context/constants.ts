/**
 * Constant definitions for the context service
 */

import type { ContextMode } from './types';

// Storage keys
export const CONTEXT_STORE_KEY = 'ctx:store' as const;

// Default context mode
export const DEFAULT_CONTEXT_MODE: ContextMode = 'system' as const;

// Predefined variable list (kept consistent with the UI package)
// These variable names may not be used in context variable overrides
export const PREDEFINED_VARIABLES = [
  'originalPrompt',
  'lastOptimizedPrompt', 
  'iterateInput',
  'currentPrompt',  // Current prompt variable used during the test phase
  'userQuestion',   // User question variable
  'conversationContext',  // Conversation context variable
  'toolsContext' // Available tools context (injected by the template processor/service)
] as const;

export type PredefinedVariable = typeof PREDEFINED_VARIABLES[number];

// Default context configuration
export const DEFAULT_CONTEXT_CONFIG = {
  id: 'default',
  title: 'Default Context',
  version: '1.0.0'
} as const;

// Document version
export const CONTEXT_STORE_VERSION = '1.0.0' as const;

// UI text constants
export const CONTEXT_UI_LABELS = {
  /** Default context title template */
  DEFAULT_TITLE_TEMPLATE: 'Context', // Combined with a date when used
  /** Duplicate suffix */
  DUPLICATE_SUFFIX: '(Copy)'
} as const;
