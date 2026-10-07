import { IImportExportable } from '../../interfaces/import-export';
import type { UnifiedParameterDefinition } from './parameter-schema';
import type { BaseProvider } from '../shared/types';

// Re-export shared types, keeping backward compatibility
export type { ConnectionSchema } from '../shared/types';

// === New architecture core types ===

/**
 * Text model service provider metadata
 * Extends BaseProvider and adds text-model-specific properties (currently none)
 */
export interface TextProvider extends BaseProvider {
  // Currently identical to BaseProvider; text-model-specific properties may be added in the future
}

/**
 * Text model metadata
 */
export interface TextModel {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly providerId: string;
  readonly capabilities: {
    supportsTools: boolean;
    supportsReasoning?: boolean;
    maxContextLength?: number;
  };
  readonly parameterDefinitions: readonly ParameterDefinition[];
  readonly defaultParameterValues?: Record<string, unknown>;
}

/**
 * Model parameter definition
 */
export type ParameterDefinition = UnifiedParameterDefinition;

/**
 * Text model config of the new architecture
 */
export interface TextModelConfig {
  id: string;
  name: string;
  enabled: boolean;
  providerMeta: TextProvider;
  modelMeta: TextModel;
  connectionConfig: {
    apiKey?: string;
    baseURL?: string;
    [key: string]: any;
  };
  paramOverrides?: Record<string, unknown>; // Unified parameter overrides (includes built-in and custom parameters)
  /**
   * @deprecated Deprecated, will be removed in v3.0
   * Legacy custom parameter field, now merged into paramOverrides
   * Only kept to read old data for backward compatibility; new code should not use this field
   */
  customParamOverrides?: Record<string, unknown>;
}

/**
 * TextModelConfig structure used for persistence
 */
export interface StoredTextModelConfig {
  id: string;
  name: string;
  enabled: boolean;
  providerMeta: TextProvider;
  modelMeta: TextModel;
  connectionConfig: Record<string, any>;
  paramOverrides?: Record<string, unknown>; // Unified parameter overrides (includes built-in and custom parameters)
  /**
   * @deprecated Deprecated, will be removed in v3.0
   * Legacy custom parameter field, now merged into paramOverrides
   * Only kept to read old data for backward compatibility; new code should not use this field
   */
  customParamOverrides?: Record<string, unknown>;
}

// === Legacy structure (compatible with old data) ===

export interface ModelConfig {
  name: string;
  baseURL: string;
  apiKey?: string;
  models?: string[];
  defaultModel: string;
  enabled: boolean;
  provider: 'deepseek' | 'gemini' | 'custom' | 'zhipu' | string;
  llmParams?: Record<string, any>;
}

// === Model manager interface ===

export interface IModelManager extends IImportExportable {
  ensureInitialized(): Promise<void>;
  isInitialized(): Promise<boolean>;

  getAllModels(): Promise<TextModelConfig[]>;
  getModel(key: string): Promise<TextModelConfig | undefined>;

  addModel(key: string, config: TextModelConfig): Promise<void>;
  updateModel(key: string, config: Partial<TextModelConfig>): Promise<void>;
  deleteModel(key: string): Promise<void>;

  enableModel(key: string): Promise<void>;
  disableModel(key: string): Promise<void>;

  getEnabledModels(): Promise<TextModelConfig[]>;
}
