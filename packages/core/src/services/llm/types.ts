import type { UnifiedParameterDefinition } from '../model/parameter-schema'
import { ModelConfig } from '../model/types';

// === Core architecture types (three-layer separation: Provider → Model → Configuration) ===

/**
 * Type-safe definition of connection parameters
 * Defines the connection parameter structure required by a provider
 */
export interface ConnectionSchema {
  /** Required fields, e.g. ['apiKey'] */
  required: string[]
  /** Optional fields, e.g. ['baseURL', 'timeout', 'organization'] */
  optional: string[]
  /** Field type constraints */
  fieldTypes: Record<string, 'string' | 'number' | 'boolean'>
}

/**
 * Static definition of a text model service provider (provided by the adapter)
 * Defines the metadata and capabilities of an LLM service provider
 */
export interface TextProvider {
  /** Unique provider identifier, e.g. 'openai', 'gemini', 'anthropic' */
  readonly id: string
  /** Display name, e.g. 'OpenAI', 'Google Gemini', 'Anthropic' */
  readonly name: string
  /** Description */
  readonly description?: string
  /**
   * Whether the browser environment is restricted by CORS (the API cannot be requested directly).
   * - true: the web build may be blocked by the browser due to CORS; using Desktop or configuring a proxy yourself is recommended
   * - false/undefined: not marked as CORS-restricted (does not mean it will definitely work; network/auth issues may still apply)
   */
  readonly corsRestricted?: boolean
  /** Whether an API key must be provided */
  readonly requiresApiKey: boolean
  /** Default API address */
  readonly defaultBaseURL: string
  /** Whether dynamic model list fetching is supported */
  readonly supportsDynamicModels: boolean
  /** Connection parameter schema (if dynamic fetching is supported) */
  readonly connectionSchema?: ConnectionSchema
  /** API key page URL (optional) */
  readonly apiKeyUrl?: string
}

export type ParameterDefinition = UnifiedParameterDefinition;

/**
 * Static definition of a text model (provided by the adapter)
 * Defines the capabilities and parameter schema of an LLM model
 */
export interface TextModel {
  /** Unique model identifier, e.g. 'gpt-4', 'gemini-2.0-flash' */
  readonly id: string
  /** Display name, e.g. 'GPT-4', 'Gemini 2.0 Flash' */
  readonly name: string
  /** Model description */
  readonly description?: string
  /** Provider it belongs to, e.g. 'openai', 'gemini' */
  readonly providerId: string
  /** Model capability definitions */
  readonly capabilities: {
    /** Whether tool calling is supported */
    supportsTools: boolean
    /** Whether reasoning content is supported (e.g. the o1 series) */
    supportsReasoning?: boolean
    /** Maximum context length */
    maxContextLength?: number
  }
  /** Model-specific parameter definitions */
  readonly parameterDefinitions: readonly ParameterDefinition[]
  /** Default parameter values */
  readonly defaultParameterValues?: Record<string, unknown>
}

/**
 * User text model configuration (Configuration layer)
 * The configuration structure of the new architecture, fully independent of the legacy ModelConfig
 *
 * Design principles:
 * - Self-contained: includes complete copies of providerMeta and modelMeta
 * - Independent: does not inherit from ModelConfig; it is a brand-new type
 * - Type-safe: provides compile-time type checking through the metadata copies
 */
export interface TextModelConfig {
  // === Basic identity ===
  /** Unique configuration identifier */
  id: string
  /** User-defined configuration name */
  name: string
  /** Whether enabled */
  enabled: boolean

  // === Self-contained metadata copies ===
  /** Full copy of the Provider metadata */
  providerMeta: TextProvider
  /** Full copy of the Model metadata */
  modelMeta: TextModel

  // === Connection config ===
  /** Connection parameter config */
  connectionConfig: {
    /** API key */
    apiKey?: string
    /** Overrides the default API address */
    baseURL?: string
    /** Supports other connection parameters (e.g. organization, timeout) */
    [key: string]: any
  }

  // === Parameter overrides ===
  /** Overrides the default parameters in modelMeta */
  paramOverrides?: Record<string, unknown>
}

/**
 * Tool-call-related types
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters?: object;
}

export interface ToolDefinition {
  type: 'function';
  function: FunctionDefinition;
}
/**
 * Message role type
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Message type
 */
export interface Message {
  role: MessageRole;
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/**
 * LLM response structure
 */
export interface LLMResponse {
  content: string;
  reasoning?: string;
  toolCalls?: ToolCall[];  // 🆕 Tool call info
  metadata?: {
    model?: string;
    tokens?: number;
    finishReason?: string;
  };
}

/**
 * Streaming response handlers
 * Supports both legacy and structured formats
 */
export interface StreamHandlers {
  // Main content stream (required, backward compatible)
  onToken: (token: string) => void;
  
  // Reasoning content stream (optional, new feature)
  onReasoningToken?: (token: string) => void;
  
  // Tool call handling (🆕 new feature)
  onToolCall?: (toolCall: ToolCall) => void;
  
  // Completion callback (now passes the full response; backward compatible via an optional parameter)
  onComplete: (response?: LLMResponse) => void;
  
  // Error callback
  onError: (error: Error) => void;
}

/**
 * Model info interface
 */
export interface ModelInfo {
  id: string;  // Model ID, used for API calls
  name: string; // Display name
}

/**
 * Model option format for dropdown selection components
 */
export interface ModelOption {
  value: string; // Option value, usually the model ID
  label: string; // Display label, usually the model name
}

/**
 * LLM service interface
 */
export interface ILLMService {
  /**
   * Send a message (legacy format, returns a merged string)
   * @deprecated Prefer sendMessageStructured for better semantic support
   * @throws {RequestConfigError} When the parameters are invalid
   * @throws {APIError} When the request fails
   */
  sendMessage(messages: Message[], provider: string): Promise<string>;

  /**
   * Send a message (structured format)
   * @throws {RequestConfigError} When the parameters are invalid
   * @throws {APIError} When the request fails
   */
  sendMessageStructured(messages: Message[], provider: string): Promise<LLMResponse>;



  /**
   * Send a streaming message (supports structured and legacy formats)
   * @throws {RequestConfigError} When the parameters are invalid
   * @throws {APIError} When the request fails
   */
  sendMessageStream(
    messages: Message[],
    provider: string,
    callbacks: StreamHandlers
  ): Promise<void>;

  /**
   * Send a streaming message with tool call support (🆕 new feature)
   * @throws {RequestConfigError} When the parameters are invalid
   * @throws {APIError} When the request fails
   */
  sendMessageStreamWithTools(
    messages: Message[],
    provider: string,
    tools: ToolDefinition[],
    callbacks: StreamHandlers
  ): Promise<void>;

  /**
   * Test the connection
   */
  testConnection(provider: string): Promise<void>;

  /**
   * Get the model list, returned in dropdown option format
   * @param provider Provider identifier
   * @param customConfig Custom config (optional)
   * @throws {RequestConfigError} When the parameters are invalid
   * @throws {APIError} When the request fails
   */
  fetchModelList(provider: string, customConfig?: Partial<ModelConfig>): Promise<ModelOption[]>;
}

// === Adapter layer interface definitions ===

/**
 * Text model Provider adapter interface
 * Every LLM service provider must implement this interface
 *
 * Responsibilities:
 * - Encapsulate the SDK call logic of a specific Provider
 * - Provide Provider and Model metadata
 * - Handle request/response conversion
 * - Preserve the original error stack
 */
export interface ITextProviderAdapter {
  /**
   * Get Provider metadata
   * @returns Static Provider info
   */
  getProvider(): TextProvider

  /**
   * Get the static model list
   * @returns All model definitions supported by this Provider
   */
  getModels(): TextModel[]

  /**
   * Dynamically fetch the model list (if the Provider supports it)
   * @param config Connection config
   * @returns Dynamically fetched model list
   * @throws {Error} If the Provider does not support dynamic fetching
   */
  getModelsAsync?(config: TextModelConfig): Promise<TextModel[]>

  /**
   * Send a message (structured format)
   * @param messages Message array
   * @param config Model config
   * @returns LLM response
   * @throws The original SDK error (full stack preserved)
   */
  sendMessage(messages: Message[], config: TextModelConfig): Promise<LLMResponse>

  /**
   * Send a streaming message
   * @param messages Message array
   * @param config Model config
   * @param callbacks Streaming response callbacks
   * @throws The original SDK error (full stack preserved)
   */
  sendMessageStream(
    messages: Message[],
    config: TextModelConfig,
    callbacks: StreamHandlers
  ): Promise<void>

  /**
   * Send a streaming message with tool call support
   * @param messages Message array
   * @param config Model config
   * @param tools Tool definitions
   * @param callbacks Streaming response callbacks
   * @throws The original SDK error (full stack preserved)
   */
  sendMessageStreamWithTools(
    messages: Message[],
    config: TextModelConfig,
    tools: ToolDefinition[],
    callbacks: StreamHandlers
  ): Promise<void>

  /**
   * Build default metadata for an unknown model ID (fallback logic)
   * @param modelId Model ID
   * @returns TextModel object with default capabilities
   */
  buildDefaultModel(modelId: string): TextModel
}

/**
 * Text model Adapter registry interface
 * Manages all Adapter instances and provides a unified query interface
 */
export interface ITextAdapterRegistry {
  /**
   * Get an Adapter instance by providerId
   * @param providerId Unique Provider identifier
   * @returns Adapter instance
   * @throws {Error} If providerId does not exist
   */
  getAdapter(providerId: string): ITextProviderAdapter

  /**
   * Get metadata for all Providers
   * @returns Array of metadata for all registered Providers
   */
  getAllProviders(): TextProvider[]

  /**
   * Get the static model list of the given Provider (cached)
   * @param providerId Unique Provider identifier
   * @returns Static model list
   */
  getStaticModels(providerId: string): TextModel[]

  /**
   * Dynamically fetch the model list (only for supporting Providers)
   * @param providerId Unique Provider identifier
   * @param config Connection config
   * @returns Dynamically fetched model list
   * @throws {Error} If the Provider does not support dynamic fetching
   */
  getDynamicModels(providerId: string, config: TextModelConfig): Promise<TextModel[]>

  /**
   * Get the model list (unified interface)
   * Tries dynamic fetching first and falls back to the static list on failure
   * @param providerId Unique Provider identifier
   * @param config Connection config (optional)
   * @returns Model list
   */
  getModels(providerId: string, config?: TextModelConfig): Promise<TextModel[]>

  /**
   * Check whether the Provider supports dynamic model fetching
   * @param providerId Unique Provider identifier
   * @returns Whether it is supported
   */
  supportsDynamicModels(providerId: string): boolean

  /**
   * Validate whether the Provider and Model match
   * @param providerId Unique Provider identifier
   * @param modelId Unique Model identifier
   * @returns Whether it is valid
   */
  validateProviderModel(providerId: string, modelId: string): boolean
}
