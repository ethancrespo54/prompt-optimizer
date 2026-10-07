// Type definitions
export type {
  // Base types
  ImageParameterDefinition,
  ImageProvider,
  ImageModel,
  ImageModelConfig,
  ImageInputRef,
  ImageRequest,
  Text2ImageRequest,
  Image2ImageRequest,
  ImageResultItem,
  ImageResult,
  ImageProgressHandlers,

  // Manager interface
  IImageModelManager,

  // Adapter interface
  IImageProviderAdapter,

  // Registry interface
  IImageAdapterRegistry,

  // Service interface
  IImageService,

  // Image storage types
  ImageMetadata,
  ImageRef,
  FullImageData,
  ImageStorageConfig,
  IImageStorageService
} from './types'

// Helper functions
export {
  isImageRef,
  createImageRef
} from './types'

// Abstract base class
export { AbstractImageProviderAdapter } from './adapters/abstract-adapter'

// Image storage service
export {
  ImageStorageService,
  createImageStorageService
} from './storage'
