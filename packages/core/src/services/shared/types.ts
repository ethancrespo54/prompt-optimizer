/**
 * Shared type definitions
 * Types common to text model and image model services
 */

/**
 * Type-safe definition of connection parameters
 * Used to define the connection config structure required by a Provider
 */
export interface ConnectionSchema {
  /** Required fields, e.g. ['apiKey'] */
  required: string[];
  /** Optional fields, e.g. ['baseURL', 'timeout', 'region'] */
  optional: string[];
  /** Field type constraints */
  fieldTypes: Record<string, 'string' | 'number' | 'boolean'>;
}

/**
 * Base Provider interface
 * Defines the properties common to all service providers
 */
export interface BaseProvider {
  /** Unique Provider identifier, e.g. 'openai', 'gemini' */
  readonly id: string;
  /** Display name, e.g. 'OpenAI', 'Google Gemini' */
  readonly name: string;
  /** Description */
  readonly description?: string;
  /**
   * Whether the browser environment is restricted by CORS (the API cannot be requested directly).
   * - true: the web build may be blocked by the browser due to CORS; using Desktop or configuring a proxy yourself is recommended
   * - false/undefined: not marked as CORS-restricted (does not mean it will definitely work; network/auth issues may still apply)
   */
  readonly corsRestricted?: boolean;
  /** Whether an API key must be provided */
  readonly requiresApiKey: boolean;
  /** Default API address */
  readonly defaultBaseURL: string;
  /** Whether dynamic model list fetching is supported */
  readonly supportsDynamicModels: boolean;
  /** Connection parameter schema */
  readonly connectionSchema?: ConnectionSchema;
  /** API key page URL (optional) */
  readonly apiKeyUrl?: string;
}

/**
 * Base Model interface
 * Defines the properties common to all models
 */
export interface BaseModel {
  /** Unique model identifier, e.g. 'gpt-4', 'dall-e-3' */
  readonly id: string;
  /** Display name */
  readonly name: string;
  /** Model description */
  readonly description?: string;
  /** ID of the Provider it belongs to */
  readonly providerId: string;
  /** Default parameter values */
  readonly defaultParameterValues?: Record<string, unknown>;
}
