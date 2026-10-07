/**
 * Error classes for the variable extraction service
 */

import { VARIABLE_EXTRACTION_ERROR_CODES, type ErrorParams } from '../../constants/error-codes'

/**
 * Base error class for the variable extraction service
 */
export class VariableExtractionError extends Error {
  public readonly code: string
  public readonly params?: ErrorParams

  constructor(code: string, message?: string, params?: ErrorParams) {
    super(message ? `[${code}] ${message}` : `[${code}]`)
    this.name = 'VariableExtractionError'
    this.code = code
    this.params = params ?? (message ? { details: message } : undefined)
  }
}

/**
 * Variable extraction request validation error
 */
export class VariableExtractionValidationError extends VariableExtractionError {
  constructor(details: string) {
    super(VARIABLE_EXTRACTION_ERROR_CODES.VALIDATION_ERROR, details, { details })
    this.name = 'VariableExtractionValidationError'
  }
}

/**
 * Variable extraction model error (model does not exist or is misconfigured)
 */
export class VariableExtractionModelError extends VariableExtractionError {
  constructor(modelKey: string) {
    super(VARIABLE_EXTRACTION_ERROR_CODES.MODEL_NOT_FOUND, undefined, { context: modelKey })
    this.name = 'VariableExtractionModelError'
  }
}

/**
 * Variable extraction parse error (unable to parse the variable extraction result returned by the LLM)
 */
export class VariableExtractionParseError extends VariableExtractionError {
  constructor(details: string) {
    super(VARIABLE_EXTRACTION_ERROR_CODES.PARSE_ERROR, details, { details })
    this.name = 'VariableExtractionParseError'
  }
}

/**
 * Variable extraction execution error (LLM call failed, etc.)
 */
export class VariableExtractionExecutionError extends VariableExtractionError {
  constructor(details: string) {
    super(VARIABLE_EXTRACTION_ERROR_CODES.EXECUTION_ERROR, details, { details })
    this.name = 'VariableExtractionExecutionError'
  }
}
