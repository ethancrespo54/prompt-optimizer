/**
 * Base error class
 * Base error class
 */

import { LLM_ERROR_CODES, type ErrorParams } from '../../constants/error-codes';

export class BaseError extends Error {
  public readonly code: string;
  public readonly params?: ErrorParams;

  constructor(code: string, message?: string, params?: ErrorParams) {
    super(message ? `[${code}] ${message}` : `[${code}]`);
    this.name = this.constructor.name;
    this.code = code;
    // Prefer structured params for UI translation; fall back to message as {details}.
    this.params = params ?? (message ? { details: message } : undefined);
    Object.setPrototypeOf(this, new.target.prototype); // Ensure correct prototype chain
  }
}

/**
 * API error - Used for errors during API calls
 * API error - represents an error during an API call
 */
export class APIError extends BaseError {
  constructor(message: string) {
    super(LLM_ERROR_CODES.API_ERROR, message);
  }
}

/**
 * Request configuration error - Used for request configuration validation failures
 * Request configuration error - represents a failed request configuration validation
 */
export class RequestConfigError extends BaseError {
  constructor(message: string) {
    super(LLM_ERROR_CODES.CONFIG_ERROR, message);
  }
}

/**
 * Validation error - Used for parameter validation failures
 * Validation error - represents a failed parameter validation
 */
export class ValidationError extends BaseError {
  constructor(message: string) {
    super(LLM_ERROR_CODES.VALIDATION_ERROR, message);
  }
}

/**
 * Initialization error - Used for service initialization failures
 * Initialization error - represents a failed service initialization
 */
export class InitializationError extends BaseError {
  constructor(message: string) {
    super(LLM_ERROR_CODES.INITIALIZATION_ERROR, message);
  }
}

/**
 * LLM service base error
 * Base LLM service error
 */
export class LLMError extends Error {
  public readonly code: string;
  public readonly params?: ErrorParams;

  constructor(code: string, message?: string, params?: ErrorParams) {
    super(message ? `[${code}] ${message}` : `[${code}]`);
    this.name = 'LLMError';
    this.code = code;
    // Prefer structured params for UI translation; fall back to message as {details}.
    this.params = params ?? (message ? { details: message } : undefined);
  }
}

/**
 * Model configuration error
 * Model configuration error
 */
export class ModelConfigError extends LLMError {
  constructor(message: string) {
    super(LLM_ERROR_CODES.CONFIG_ERROR, message);
    this.name = 'ModelConfigError';
  }
}

/**
 * Unified error code constants for LLM operations
 * Unified error code constants for LLM operations
 *
 * @deprecated Use LLM_ERROR_CODES from '@prompt-optimizer/core/constants/error-codes' instead
 */
export const ERROR_MESSAGES = {
  API_KEY_REQUIRED: LLM_ERROR_CODES.API_KEY_REQUIRED,
  MODEL_NOT_FOUND: LLM_ERROR_CODES.MODEL_NOT_FOUND,
  TEMPLATE_INVALID: LLM_ERROR_CODES.TEMPLATE_INVALID,
  EMPTY_INPUT: LLM_ERROR_CODES.EMPTY_INPUT,
  OPTIMIZATION_FAILED: LLM_ERROR_CODES.OPTIMIZATION_FAILED,
  ITERATION_FAILED: LLM_ERROR_CODES.ITERATION_FAILED,
  TEST_FAILED: LLM_ERROR_CODES.TEST_FAILED,
  MODEL_KEY_REQUIRED: LLM_ERROR_CODES.MODEL_KEY_REQUIRED,
  INPUT_TOO_LONG: LLM_ERROR_CODES.INPUT_TOO_LONG,
} as const; 