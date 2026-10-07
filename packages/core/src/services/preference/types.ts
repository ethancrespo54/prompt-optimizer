import { IImportExportable } from '../../interfaces/import-export';

export interface IPreferenceService extends IImportExportable {
  get<T>(key: string, defaultValue: T): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;

  /**
   * Get all preferences
   * @returns Key-value object containing all preferences
   */
  getAll(): Promise<Record<string, string>>;
}