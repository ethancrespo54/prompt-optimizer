/**
 * Evaluation service error classes
 * Evaluation service error classes
 */

import { EVALUATION_ERROR_CODES, type ErrorParams } from '../../constants/error-codes';

/**
 * Base error class for evaluation service
 * Base error class for the evaluation service
 */
export class EvaluationError extends Error {
  public readonly code: string;
  public readonly params?: ErrorParams;

  constructor(
    code: string,
    params?: ErrorParams,
    message?: string
  ) {
    // Fallback message includes code for debugging when not translated
    super(message ? `[${code}] ${message}` : `[${code}]`);
    this.name = 'EvaluationError';
    this.code = code;
    this.params = params ?? (message ? { details: message } : undefined);
  }
}

/**
 * Evaluation request validation error
 * Evaluation request validation error
 */
export class EvaluationValidationError extends EvaluationError {
  constructor(message: string) {
    super(EVALUATION_ERROR_CODES.VALIDATION_ERROR, undefined, message);
    this.name = 'EvaluationValidationError';
  }
}

/**
 * Evaluation model error (model does not exist or is misconfigured)
 * Evaluation model error (model does not exist or is misconfigured)
 */
export class EvaluationModelError extends EvaluationError {
  constructor(modelKey: string) {
    super(EVALUATION_ERROR_CODES.MODEL_NOT_FOUND, { context: modelKey });
    this.name = 'EvaluationModelError';
  }
}

/**
 * Evaluation template error (template does not exist)
 * Evaluation template error (template does not exist)
 */
export class EvaluationTemplateError extends EvaluationError {
  constructor(templateId: string) {
    super(EVALUATION_ERROR_CODES.TEMPLATE_NOT_FOUND, { context: templateId });
    this.name = 'EvaluationTemplateError';
  }
}

/**
 * Evaluation parse error (cannot parse LLM evaluation result)
 * Evaluation parse error (unable to parse the evaluation result returned by the LLM)
 */
export class EvaluationParseError extends EvaluationError {
  constructor(message: string) {
    super(EVALUATION_ERROR_CODES.PARSE_ERROR, undefined, message);
    this.name = 'EvaluationParseError';
  }
}

/**
 * Evaluation execution error (LLM call failed, etc.)
 * Evaluation execution error (LLM call failed, etc.)
 */
export class EvaluationExecutionError extends EvaluationError {
  constructor(message: string, public readonly cause?: Error) {
    super(EVALUATION_ERROR_CODES.EXECUTION_ERROR, undefined, message);
    this.name = 'EvaluationExecutionError';
  }
}
