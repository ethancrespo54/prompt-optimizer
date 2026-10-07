/**
 * Variable value generation service - error class definitions
 */

import { VARIABLE_VALUE_GENERATION_ERROR_CODES, type ErrorParams } from '../../constants/error-codes'

/**
 * Base error class for the variable value generation service
 */
export class VariableValueGenerationError extends Error {
  public readonly code: string
  public readonly params?: ErrorParams

  constructor(code: string, message?: string, params?: ErrorParams) {
    super(message ? `[${code}] ${message}` : `[${code}]`)
    this.name = 'VariableValueGenerationError'
    this.code = code
    this.params = params ?? (message ? { details: message } : undefined)
  }
}

/**
 * Variable value generation request validation error
 */
export class VariableValueGenerationValidationError extends VariableValueGenerationError {
  constructor(details: string) {
    super(VARIABLE_VALUE_GENERATION_ERROR_CODES.VALIDATION_ERROR, details, { details })
    this.name = 'VariableValueGenerationValidationError'
  }
}

/**
 * Variable value generation model error
 */
export class VariableValueGenerationModelError extends VariableValueGenerationError {
  constructor(modelKey: string) {
    super(VARIABLE_VALUE_GENERATION_ERROR_CODES.MODEL_NOT_FOUND, undefined, { context: modelKey })
    this.name = 'VariableValueGenerationModelError'
  }
}

/**
 * Variable value generation parse error
 */
export class VariableValueGenerationParseError extends VariableValueGenerationError {
  constructor(details: string) {
    super(VARIABLE_VALUE_GENERATION_ERROR_CODES.PARSE_ERROR, details, { details })
    this.name = 'VariableValueGenerationParseError'
  }
}

/**
 * Variable value generation execution error (LLM call failed, etc.)
 */
export class VariableValueGenerationExecutionError extends VariableValueGenerationError {
  constructor(details: string) {
    super(VARIABLE_VALUE_GENERATION_ERROR_CODES.EXECUTION_ERROR, details, { details })
    this.name = 'VariableValueGenerationExecutionError'
  }
}
