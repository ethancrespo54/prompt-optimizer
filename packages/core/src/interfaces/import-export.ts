/**
 * Import/export interface definitions
 * 
 * This file defines import/export-related interfaces, avoiding circular dependencies
 */

import { IMPORT_EXPORT_ERROR_CODES } from '../constants/error-codes'

/**
 * Importable/exportable service interface
 * All services that participate in data import/export should implement this interface
 */
export interface IImportExportable {
  /**
   * Export all data of the service
   * @returns JSON representation of the service data
   */
  exportData(): Promise<any>;

  /**
   * Import data into the service
   * @param data Data to import
   */
  importData(data: any): Promise<void>;

  /**
   * Get the data type identifier of the service
   * Used to identify the data type in the import/export JSON
   */
  getDataType(): Promise<string>;

  /**
   * Validate that the data format is correct
   * @param data Data to validate
   * @returns Whether the format is valid
   */
  validateData(data: any): Promise<boolean>;
}

/**
 * Import/export error type
 */
export class ImportExportError extends Error {
  public readonly code: string
  public readonly params?: Record<string, unknown>

  constructor(
    message: string,
    public readonly dataType?: string,
    public readonly originalError?: Error,
    code: string = IMPORT_EXPORT_ERROR_CODES.IMPORT_FAILED,
  ) {
    // Keep message for debugging; user-facing text should come from `code + params`.
    super(message)
    this.name = 'ImportExportError'

    this.code = code
    this.params = { details: message, dataType }
  }
}
