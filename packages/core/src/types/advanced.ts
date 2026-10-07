/**
 * Advanced module type definitions
 * Consolidates type support for advanced features such as variable management, tool calling, and context management
 */

import type {
  ConversationMessage,
  OptimizationRequest,
  CustomConversationRequest,
  ToolDefinition,
  FunctionDefinition,
  ToolCall,
  OptimizationMode
} from '../services/prompt/types';

import type {
  LLMResponse,
  StreamHandlers,
  Message,
  MessageRole
} from '../services/llm/types';

// Re-export core types to avoid duplicate definitions
export type {
  ConversationMessage,
  OptimizationRequest,
  CustomConversationRequest,
  ToolDefinition,
  FunctionDefinition,
  ToolCall,
  OptimizationMode,
  LLMResponse,
  StreamHandlers,
  Message,
  MessageRole
};

/**
 * Variable management types
 */
export interface VariableDefinition {
  /** Variable name */
  name: string;
  /** Variable value */
  value: string;
  /** Variable type: predefined or custom */
  type: 'predefined' | 'custom';
  /** Variable description (optional) */
  description?: string;
  /** Whether the variable is required */
  required?: boolean;
  /** Creation time */
  createdAt: Date;
  /** Update time */
  updatedAt: Date;
}

/**
 * Variable import/export data format
 */
export interface VariableExportData {
  /** Export version number */
  version: string;
  /** Export time */
  exportedAt: string;
  /** Variable data */
  variables: Omit<VariableDefinition, 'createdAt' | 'updatedAt'>[];
}

/**
 * Variable import options
 */
export interface VariableImportOptions {
  /** Whether to overwrite variables with the same name */
  overwriteExisting: boolean;
  /** Whether to validate the variable name format */
  validateNames: boolean;
  /** Whether to skip variables with empty values */
  skipEmpty: boolean;
}

/**
 * Variable manager interface
 */
export interface IVariableManager {
  /** Get all variables (predefined + custom) */
  getAllVariables(): Record<string, string>;
  
  /** Get custom variables */
  getCustomVariables(): Record<string, string>;
  
  /** Set a custom variable */
  setVariable(name: string, value: string): void;
  
  /** Delete a custom variable */
  deleteVariable(name: string): void;
  
  /** Clear all custom variables */
  clearCustomVariables(): void;
  
  /** Import variables */
  importVariables(data: VariableExportData, options?: VariableImportOptions): Promise<void>;
  
  /** Export variables */
  exportVariables(): VariableExportData;
  
  /** Scan the content for variable references */
  scanVariablesInContent(content: string): string[];
  
  /** Replace variables in the content */
  replaceVariables(content: string, variables?: Record<string, string>): string;
  
  /** Validate the variable name format */
  validateVariableName(name: string): boolean;
}

/**
 * Context management types
 */
export interface ContextTemplate {
  /** Template ID */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description?: string;
  /** Message template */
  messages: ConversationMessage[];
  /** Preset variables */
  defaultVariables?: Record<string, string>;
  /** Preset tools */
  defaultTools?: ToolDefinition[];
  /** Creation time */
  createdAt: Date;
}

/**
 * Context editor state
 */
export interface ContextEditorState {
  /** Current message list */
  messages: ConversationMessage[];
  /**
   * Current variables
   * @deprecated Migrated to useTemporaryVariables() and useVariableManager(); this field is kept only for backward compatibility
   */
  variables?: Record<string, string>;
  /** Current tools */
  tools: ToolDefinition[];
  /** Whether to show the variable preview */
  showVariablePreview: boolean;
  /** Whether to show tool management */
  showToolManager: boolean;
  /** Editor mode */
  mode: 'edit' | 'preview';
}

/**
 * Apply to Test sync data
 */
export interface ApplyToTestData {
  /** Optimization mode */
  optimizationMode: OptimizationMode;
  /** Current prompt */
  currentPrompt: string;
  /** Variable data */
  variables: Record<string, string>;
  /** Tool definitions */
  tools?: ToolDefinition[];
  /** Context messages (if any) */
  contextMessages?: ConversationMessage[];
}

/**
 * Types related to tool call result display
 */
export interface ToolCallResult {
  /** Tool call info */
  toolCall: ToolCall;
  /** Call result (if any) */
  result?: any;
  /** Call status */
  status: 'pending' | 'success' | 'error';
  /** Error info (if any) */
  error?: string;
  /** Call time */
  timestamp: Date;
}

/**
 * Advanced info in test results
 */
export interface AdvancedTestResult {
  /** Base response content */
  content: string;
  /** Reasoning process (if supported) */
  reasoning?: string;
  /** Tool call results */
  toolCalls?: ToolCallResult[];
  /** Variables used */
  usedVariables?: Record<string, string>;
  /** Metadata info */
  metadata?: {
    model?: string;
    tokens?: number;
    finishReason?: string;
    hasTools?: boolean;
    toolCount?: number;
  };
}

/**
 * UI component state types
 */
export interface ComponentVisibility {
  /** Variable manager visibility */
  variableManager: boolean;
  /** Tool manager visibility */
  toolManager: boolean;
  /** Context editor visibility */
  contextEditor: boolean;
  /** Advanced test panel visibility */
  advancedTestPanel: boolean;
}

/**
 * Advanced mode global state
 */
export interface AdvancedModuleState {
  /** Whether advanced mode is enabled */
  enabled: boolean;
  /** Currently active feature */
  activeFeature: 'variables' | 'tools' | 'context' | null;
  /** Component visibility state */
  visibility: ComponentVisibility;
  /** Data currently being edited */
  currentData: {
    variables: Record<string, string>;
    tools: ToolDefinition[];
    messages: ConversationMessage[];
  };
}

/**
 * Error handling types
 */
export class AdvancedModuleError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AdvancedModuleError';
  }
}

/**
 * Variable validation error
 */
export class VariableValidationError extends AdvancedModuleError {
  constructor(variableName: string, reason: string) {
    super(`Variable validation failed: ${variableName} - ${reason}`, 'VARIABLE_VALIDATION_ERROR');
  }
}

/**
 * Tool call error
 */
export class ToolCallError extends AdvancedModuleError {
  constructor(toolName: string, reason: string) {
    super(`Tool call failed: ${toolName} - ${reason}`, 'TOOL_CALL_ERROR');
  }
}