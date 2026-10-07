/**
 * History base error
 * Base history record error
 */

import { HISTORY_ERROR_CODES, type ErrorParams } from '../../constants/error-codes';

export class HistoryError extends Error {
  public readonly code: string;
  public readonly params?: ErrorParams;

  constructor(code: string, params?: ErrorParams, message?: string) {
    super(message ? `[${code}] ${message}` : `[${code}]`);
    this.name = 'HistoryError';
    this.code = code;
    this.params = params ?? (message ? { details: message } : undefined);
  }
}

/**
 * History not found error
 * History record not found error
 */
export class HistoryNotFoundError extends HistoryError {
  constructor(id: string) {
    super(HISTORY_ERROR_CODES.NOT_FOUND, { context: id });
    this.name = 'HistoryNotFoundError';
  }
}

/**
 * History chain error
 * History record chain error
 */
export class HistoryChainError extends HistoryError {
  constructor(message: string) {
    super(HISTORY_ERROR_CODES.CHAIN_ERROR, undefined, message);
    this.name = 'HistoryChainError';
  }
}

/**
 * Record not found error
 * Record does not exist error
 */
export class RecordNotFoundError extends HistoryError {
  constructor(
    message: string,
    public recordId: string
  ) {
    // i18n expects {details} for record_not_found
    super(HISTORY_ERROR_CODES.RECORD_NOT_FOUND, { details: message }, message);
    this.name = 'RecordNotFoundError';
  }
}

/**
 * History storage error
 * History record storage error
 *
 * Note: This class is different from StorageError in storage/errors.ts,
 * specifically for storage operation errors in the history module
 * Note: this class differs from StorageError in storage/errors.ts;
 * it is dedicated to storage-operation errors in the history module
 */
export class HistoryStorageError extends HistoryError {
  constructor(
    message: string,
    public operation: 'read' | 'write' | 'delete' | 'init' | 'storage'
  ) {
    // i18n expects {details} for storage
    super(HISTORY_ERROR_CODES.STORAGE_ERROR, { details: message }, message);
    this.name = 'HistoryStorageError';
  }
}

/**
 * Record validation error
 * Record validation error
 */
export class RecordValidationError extends HistoryError {
  constructor(
    message: string,
    public errors: string[]
  ) {
    super(HISTORY_ERROR_CODES.VALIDATION_ERROR, undefined, message);
    this.name = 'RecordValidationError';
  }
} 