/**
 * Base model error
 */
import { MODEL_ERROR_CODES, type ErrorParams } from '../../constants/error-codes'

export class ModelError extends Error {
  public readonly code: string
  public readonly params?: ErrorParams

  constructor(code: string, message?: string, params?: ErrorParams) {
    super(message ? `[${code}] ${message}` : `[${code}]`)
    this.name = 'ModelError'
    this.code = code
    this.params = params ?? (message ? { details: message } : undefined)
  }
}

/**
 * Model validation error
 */
export class ModelValidationError extends ModelError {
  constructor(
    details: string,
    public errors: string[],
  ) {
    super(MODEL_ERROR_CODES.VALIDATION_ERROR, details, { details })
    this.name = 'ModelValidationError'
  }
}

// Note: ModelConfigError has been moved to llm/errors.ts to avoid duplicate definitions
