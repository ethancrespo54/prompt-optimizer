import { IImportExportable } from '../../interfaces/import-export'
import type { UnifiedParameterDefinition } from '../model/parameter-schema'
import type { BaseProvider } from '../shared/types'

// Re-export shared types, keeping backward compatibility
export type { ConnectionSchema } from '../shared/types'

// === Image parameter definitions ===

export interface ImageParameterDefinition extends UnifiedParameterDefinition {
  labelKey: string                // UI text i18n key, e.g. "params.size.label"
  descriptionKey: string          // UI description i18n key, e.g. "params.size.description"
  allowedValueLabelKeys?: string[] // i18n keys for enum values
}

// === Core architecture types (three-layer separation: Provider → Model → Configuration) ===

/**
 * Static definition of an image service provider
 * Extends BaseProvider and adds image-model-specific properties (currently none)
 */
export interface ImageProvider extends BaseProvider {
  // Currently identical to BaseProvider; image-model-specific properties may be added in the future
}

// Static model definition (provided by the adapter)
export interface ImageModel {
  readonly id: string                    // Unique model identifier, e.g. 'dall-e-3', 'kolors'
  readonly name: string                  // Display name, e.g. 'DALL-E 3', 'Kolors'
  readonly description?: string          // Model description
  readonly providerId: string            // Provider it belongs to, e.g. 'openai'
  readonly capabilities: {
    text2image: boolean                  // Supports text-to-image
    image2image: boolean                 // Supports image-to-image
    multiImage?: boolean                 // Supports multi-image input (optional)
  }
  readonly parameterDefinitions: readonly ImageParameterDefinition[] // Model-specific parameter definitions
  readonly defaultParameterValues?: Record<string, unknown>          // Default parameter values
}

// User image model configuration (Configuration layer)
export interface ImageModelConfig {
  id: string                             // Unique configuration identifier
  name: string                           // User-defined name
  providerId: string                     // Referenced provider
  modelId: string                        // Referenced model
  enabled: boolean                       // Whether this configuration is enabled

  // Connection config (optional overrides)
  connectionConfig?: {
    apiKey?: string                      // API key
    baseURL?: string                     // Overrides the default API address
    [key: string]: any                   // Supports other connection parameters (e.g. organization, region)
  }

  // Parameter overrides (unified field)
  paramOverrides?: Record<string, unknown> // Overrides model default parameters (includes built-in and custom parameters)

  /**
   * @deprecated Deprecated, will be removed in v3.0
   * Legacy custom parameter field, now merged into paramOverrides
   * Only kept to read old data for backward compatibility; new code should not use this field
   */
  customParamOverrides?: Record<string, unknown>

  // Self-contained data (new)
  provider: ImageProvider              // Full copy of the provider info
  model: ImageModel                    // Full copy of the model info
}

// === Base types (request/result/progress) ===

export interface ImageInputRef {
  b64: string
  mimeType?: string
}

export interface ImageRequest {
  prompt: string
  configId: string                        // Use the config ID directly to simplify calls
  inputImage?: ImageInputRef               // Optional input image
  count?: number                           // Number of images to generate, default 1
  paramOverrides?: Record<string, unknown> // Temporary parameter overrides that do not affect the saved config
}

// === Explicit mode request types (avoid implicitly inferring from whether inputImage is present) ===

/**
 * Text-to-image request: inputImage is not allowed.
 */
export type Text2ImageRequest = Omit<ImageRequest, 'inputImage'> & { inputImage?: never }

/**
 * Image-to-image request: inputImage must be provided.
 */
export type Image2ImageRequest = Omit<ImageRequest, 'inputImage'> & { inputImage: ImageInputRef }

export interface ImageResultItem {
  b64?: string
  url?: string
  mimeType?: string
}

export interface ImageResult {
  images: ImageResultItem[]                // Image results
  text?: string                            // New: optional text output (multimodal)
  metadata?: {
    providerId: string                     // Provenance: the provider used
    modelId: string                        // Provenance: the model used
    configId: string                       // Provenance: the configuration used
    finishReason?: string                  // Finish reason
    usage?: any                            // Usage statistics
    [key: string]: any                     // Extension fields
  }
}

export interface ImageProgressHandlers {
  onProgress?: (stage: 'queued' | 'generating' | 'done' | string | number) => void
  onPreview?: (img: { b64: string }) => void
  onComplete?: (result: ImageResult) => void
  onError?: (error: Error) => void
}

// === Manager interface ===

export interface IImageModelManager extends IImportExportable {
  // Initialization (write default configs / fill in missing defaults)
  ensureInitialized?(): Promise<void>
  isInitialized?(): Promise<boolean>
  // Config CRUD operations
  addConfig(config: ImageModelConfig): Promise<void>
  updateConfig(id: string, updates: Partial<ImageModelConfig>): Promise<void>
  deleteConfig(id: string): Promise<void>
  getConfig(id: string): Promise<ImageModelConfig | null>
  getAllConfigs(): Promise<ImageModelConfig[]>
  getEnabledConfigs(): Promise<ImageModelConfig[]>
}

// === Adapter interface ===

// Unified adapter interface (all adapters must implement it)
export interface IImageProviderAdapter {
  // Static info retrieval (determined at compile time)
  getProvider(): ImageProvider
  getModels(): ImageModel[]                // Static model list, always available (for offline/default display)

  // Dynamic model retrieval (an empty implementation is allowed)
  getModelsAsync(connectionConfig: Record<string, any>): Promise<ImageModel[]>

  // Build a default model (supports model IDs that do not exist)
  buildDefaultModel(modelId: string): ImageModel

  // Dynamic generation behavior (automatically obtains model info based on the config)
  generate(request: ImageRequest, config: ImageModelConfig): Promise<ImageResult>
}

// === Registry interface ===

export interface IImageAdapterRegistry {
  // Basic adapter management
  getAdapter(providerId: string): IImageProviderAdapter

  // Metadata queries
  getAllProviders(): ImageProvider[]

  // Static model retrieval (immediately available)
  getStaticModels(providerId: string): ImageModel[]

  // Dynamic model retrieval (requires connection config)
  getDynamicModels(providerId: string, connectionConfig: Record<string, any>): Promise<ImageModel[]>

  // Unified model retrieval interface (automatically chooses static or dynamic)
  getModels(providerId: string, connectionConfig?: Record<string, any>): Promise<ImageModel[]>

  // Get a combined view of all static models
  getAllStaticModels(): Array<{ provider: ImageProvider; model: ImageModel }>

  // Capability checks
  supportsDynamicModels(providerId: string): boolean

  // Validation methods
  validateProviderModel(providerId: string, modelId: string): boolean
}

// === Service interface ===

export interface IImageService {
  // Core generation (compatibility entry: internally the mode may still be determined by inputImage)
  generate(request: ImageRequest): Promise<ImageResult>

  // Explicit mode entry: avoids mode misjudgment and confusing error messages
  generateText2Image(request: Text2ImageRequest): Promise<ImageResult>
  generateImage2Image(request: Image2ImageRequest): Promise<ImageResult>

  // Helper features (compatibility entry)
  validateRequest(request: ImageRequest): Promise<void>

  // Explicit validation: lets the UI/callers detect mismatched config and input early
  validateText2ImageRequest(request: Text2ImageRequest): Promise<void>
  validateImage2ImageRequest(request: Image2ImageRequest): Promise<void>

  // New: connection test (uses a temporary config directly, independent of saved configs)
  testConnection(config: ImageModelConfig): Promise<ImageResult>
  // New: get the dynamic model list (if supported)
  getDynamicModels(providerId: string, connectionConfig: Record<string, any>): Promise<ImageModel[]>
}


// === Image storage types (separate storage support) ===

/**
 * Image metadata (lightweight, without the actual image data)
 */
export interface ImageMetadata {
  id: string                    // Unique identifier, format: img_<timestamp>_<uuid>
  width?: number               // Image width (optional)
  height?: number              // Image height (optional)
  mimeType: string             // MIME type: image/png, image/jpeg
  sizeBytes: number            // Image size (bytes)
  createdAt: number            // Creation timestamp
  accessedAt: number           // Last access timestamp (used for LRU)
  source: 'generated' | 'uploaded'  // Source: generated vs uploaded
  metadata?: {                 // Associated generation metadata
    prompt?: string            // Generation prompt
    modelId?: string           // Model used
    configId?: string          // Configuration used
  }
}

/**
 * Image reference (used for Session storage)
 * When a Session is persisted, this type replaces the full image data
 */
export interface ImageRef {
  id: string                   // Image ID
  _type: 'image-ref'          // Type marker, used to distinguish references from actual data
  b64?: never                 // Explicitly excludes the base64 field
  url?: never                 // Explicitly excludes the URL field
  mimeType?: never            // Explicitly excludes the mimeType field
}

/**
 * Full image data (loaded only when needed)
 * Contains the metadata and the actual base64 image data
 */
export interface FullImageData {
  metadata: ImageMetadata
  data: string                 // base64-encoded image data (without the data URL prefix)
}

/**
 * Image storage configuration
 */
export interface ImageStorageConfig {
  maxCacheSize?: number        // Maximum cache size (bytes), default 50MB
  maxAge?: number              // Maximum retention time (ms), default 7 days
  maxCount?: number            // Maximum number of images, default 100
  autoCleanupThreshold?: number  // Auto-cleanup threshold (cleanup triggers at this ratio), default 0.8
  dbName?: string              // IndexedDB database name (default PromptOptimizerImageDB)
}

/**
 * Image storage service interface
 * Provides independent storage, querying, and cleanup of images
 */
export interface IImageStorageService {
  // Basic CRUD operations
  saveImage(data: FullImageData): Promise<string>  // Returns the image ID
  getImage(id: string): Promise<FullImageData | null>
  getMetadata(id: string): Promise<ImageMetadata | null>
  deleteImage(id: string): Promise<void>

  // Bulk operations
  deleteImages(ids: string[]): Promise<void>
  clearAll(): Promise<void>

  // Cleanup strategy
  cleanupOldImages(): Promise<number>  // Returns the number of images cleaned up
  enforceQuota(): Promise<void>        // Enforce quota limits

  // Queries and statistics
  listAllMetadata(): Promise<ImageMetadata[]>
  getStorageStats(): Promise<{
    count: number
    totalBytes: number
    oldestAt: number | null
    newestAt: number | null
  }>

  // Configuration management
  getConfig(): ImageStorageConfig
  updateConfig(config: Partial<ImageStorageConfig>): Promise<void>

  // Lifecycle management
  close(): Promise<void>
}

/**
 * Helper: determine whether a value is an image reference
 */
export function isImageRef(item: ImageResultItem): item is ImageRef {
  return '_type' in item && item._type === 'image-ref'
}

/**
 * Helper: create an image reference
 */
export function createImageRef(id: string): ImageRef {
  return { id, _type: 'image-ref' }
}

// Export the abstract base class
export { AbstractImageProviderAdapter } from './adapters/abstract-adapter'
