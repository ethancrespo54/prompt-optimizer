/**
 * Error handling utility functions
 * Provides unified error handling and type-safe error message extraction
 */

import { useToast } from '../composables/ui/useToast'
import { i18n } from '../plugins/i18n'

/**
 * Extended error type supporting more detailed error info
 */
export interface ExtendedError extends Error {
  /** Detailed error message */
  detailedMessage?: string
  /** Original error object */
  originalError?: unknown
  /** Error code (i18n key) */
  code?: string
  /** i18n interpolation params */
  params?: Record<string, unknown>
  /** Extra context (not for i18n interpolation) */
  context?: Record<string, unknown>
}

/**
 * Application error class
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string = 'UNKNOWN_ERROR',
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * Extract an error message from an error of unknown type
 * @param error - Error object of unknown type
 * @param fallback - Default error message
 * @returns Error message string
 */
export function getErrorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error === null || error === undefined) {
    return fallback
  }

  // IPC / cross-context errors may arrive as plain objects ({ message, code, params }).
  if (typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
      return maybeMessage
    }
  }

  try {
    return String(error)
  } catch {
    return fallback
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Convert a structured error (code + params) into user-readable i18n text.
 *
 * Rules:
 * - Do not parse error.message (avoids exposing `[error.xxx] ...` to users)
 * - Only use the translation when the key exists in i18n; otherwise fall back to getErrorMessage
 */
export function getI18nErrorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (!isRecord(error)) {
    return getErrorMessage(error, fallback)
  }

  const code = typeof error.code === 'string' ? error.code : undefined
  const params = isRecord(error.params) ? error.params : undefined

  if (code) {
    const hasKey = i18n.global.te(code)
    if (hasKey) {
      try {
        return i18n.global.t(code, params ?? {})
      } catch {
        // If interpolation fails for any reason, fall back to raw error message.
      }
    }
  }

  const message = getErrorMessage(error, fallback)

  // Avoid leaking internal error-code placeholders like "[error.xxx]" to users.
  if (typeof fallback === 'string' && fallback.trim() && /^\[error\.[^\]]+\]/.test(message)) {
    return fallback
  }

  return message
}


/**
 * Type guard: check whether it is an ExtendedError
 * @param error - Error object to check
 * @returns Whether it is an ExtendedError
 */
export function isExtendedError(error: unknown): error is ExtendedError {
  return (
    error instanceof Error &&
    ('detailedMessage' in error || 'originalError' in error || 'code' in error || 'context' in error)
  )
}

/**
 * Safely convert an unknown error into an ExtendedError
 * @param error - Error object of unknown type
 * @returns ExtendedError or null
 */
export function asExtendedError(error: unknown): ExtendedError | null {
  if (isExtendedError(error)) {
    return error
  }
  return null
}

/**
 * Get a detailed error message, preferring the detailed info of ExtendedError
 * @param error - Error object of unknown type
 * @param fallback - Default error message
 * @returns Detailed error message string
 */
export function getDetailedErrorMessage(error: unknown, fallback = 'Unknown error'): string {
  const extendedError = asExtendedError(error)

  if (extendedError) {
    // Prefer the detailed message
    if (extendedError.detailedMessage) {
      return extendedError.detailedMessage
    }

    // Then use the original error
    if (extendedError.originalError !== undefined) {
      return String(extendedError.originalError)
    }

    // Finally use the standard error message
    return extendedError.message
  }

  return getErrorMessage(error, fallback)
}

/**
 * Create an ExtendedError instance
 * @param message - Error message
 * @param options - Extension options
 * @returns ExtendedError instance
 */
export function createExtendedError(
  message: string,
  options?: {
    detailedMessage?: string
    originalError?: unknown
    code?: string
    params?: Record<string, unknown>
    context?: Record<string, unknown>
  }
): ExtendedError {
  const error = new Error(message) as ExtendedError

  if (options?.detailedMessage) {
    error.detailedMessage = options.detailedMessage
  }

  if (options?.originalError !== undefined) {
    error.originalError = options.originalError
  }

  if (options?.code) {
    error.code = options.code
  }

  if (options?.params) {
    error.params = options.params
  }

  if (options?.context) {
    error.context = options.context
  }

  return error
}

/**
 * Create an error handler
 * @param context - Error context description
 * @returns Error handler object
 */
export function createErrorHandler(context: string) {
  const toast = useToast()

  return {
    handleError(error: unknown) {
      console.error(`[${context}] Error:`, error)

      toast.error(getI18nErrorMessage(error, `An unknown error occurred during ${context}`))
    }
  }
}

/**
 * Log detailed error info in the development environment
 * @param context - Error context description
 * @param error - Error object
 */
export function logErrorInDev(context: string, error: unknown): void {
  if (import.meta.env.DEV) {
    console.error(`[${context}] Error occurred:`, error)

    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        ...(isExtendedError(error) && {
          detailedMessage: error.detailedMessage,
          originalError: error.originalError,
          code: error.code,
          context: error.context
        })
      })
    }
  }
}

/**
 * Predefined error message constants
 */
export const errorMessages = {
  SERVICE_NOT_INITIALIZED: 'Service not initialized, please try again later',
  TEMPLATE_NOT_SELECTED: 'Please select a prompt template first',
  INCOMPLETE_TEST_INFO: 'Please fill in the complete test info',
  LOAD_TEMPLATE_FAILED: 'Failed to load prompts',
  CLEAR_HISTORY_FAILED: 'Failed to clear the history'
} as const 
