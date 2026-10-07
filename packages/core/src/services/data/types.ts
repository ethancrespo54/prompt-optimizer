/**
 * Type definitions related to data import/export
 */

/**
 * Complete export data structure
 */
export interface ExportData {
  version: number;
  timestamp: number;
  data: Record<string, any>;
}

/**
 * Data manager interface
 */
export interface IDataManager {
  /**
   * Export all data
   * @returns Data string in JSON format
   */
  exportAllData(): Promise<string>;

  /**
   * Import all data
   * @param dataString Data string in JSON format
   */
  importAllData(dataString: string): Promise<void>;
}

// ImportExportError has been moved to ../../interfaces/import-export.ts
