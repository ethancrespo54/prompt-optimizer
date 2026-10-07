import type { IPreferenceService } from "./types";
import type { IStorageProvider } from "../storage/types";
import { ImportExportError } from "../../interfaces/import-export";
import { IMPORT_EXPORT_ERROR_CODES } from "../../constants/error-codes";
import { StorageError } from "../storage/errors";
import { toErrorWithCode } from "../../utils/error";

// UI config keys to export - whitelist validation
const UI_SETTINGS_KEYS = [
  "app:settings:ui:theme-id",
  "app:settings:ui:preferred-language",
  "app:settings:ui:builtin-template-language",

  // Deprecated: model selection has moved to each mode's session store
  // Kept for backward compatibility when importing old-version data, to avoid import failures
  // TODO: safe to remove once no old data remains (expected in v3.0)
  "app:selected-optimize-model",
  "app:selected-test-model",

  "app:selected-optimize-template", // System optimize template
  "app:selected-user-optimize-template", // User optimize template
  "app:selected-iterate-template", // Iterate template
] as const;

// Legacy key name mapping - used for compatibility handling
const LEGACY_KEY_MAPPING: Record<string, string> = {
  // Legacy short key names -> new full key names
  "theme-id": "app:settings:ui:theme-id",
  "preferred-language": "app:settings:ui:preferred-language",
  "builtin-template-language": "app:settings:ui:builtin-template-language",
  // Other key names stay unchanged since they already have the correct prefix
};

/**
 * Convert a legacy key name to the new key name
 * @param key Original key name
 * @returns Normalized key name
 */
const normalizeSettingKey = (key: string): string => {
  return LEGACY_KEY_MAPPING[key] || key;
};

/**
 * Validate that a UI config key is safe
 */
const isValidSettingKey = (key: string): boolean => {
  // Normalize the key name first, then validate
  const normalizedKey = normalizeSettingKey(key);
  return (
    UI_SETTINGS_KEYS.includes(normalizedKey as any) &&
    normalizedKey.length <= 50 &&
    normalizedKey.length > 0 &&
    !/[<>"\\'&\x00-\x1f\x7f-\x9f]/.test(normalizedKey)
  ); // Exclude dangerous characters and control characters
};

/**
 * Validate that a UI config value is safe
 */
const isValidSettingValue = (value: any): value is string => {
  return (
    typeof value === "string" &&
    value.length <= 1000 && // Limit the value length
    !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/.test(value)
  ); // Exclude control characters
};

/**
 * Preference service implementation based on IStorageProvider
 */
export class PreferenceService implements IPreferenceService {
  private readonly PREFIX = "pref:";
  private keyCache: Set<string> = new Set();
  private storageProvider: IStorageProvider;

  constructor(storageProvider: IStorageProvider) {
    this.storageProvider = storageProvider;
  }

  /**
   * Get a preference
   * @param key Key name
   * @param defaultValue Default value
   * @returns The setting value, or the default value if it does not exist
   */
  async get<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const prefKey = this.getPrefKey(key);
      const storedValue = await this.storageProvider.getItem(prefKey);

      if (storedValue === null) {
        return defaultValue;
      }
      // Add the key to the cache
      this.keyCache.add(key);
      return JSON.parse(storedValue) as T;
    } catch (error) {
      console.error(
        `[PreferenceService] Error getting preference for key "${key}":`,
        error,
      );
      if (typeof (error as any)?.code === "string") {
        throw toErrorWithCode(error);
      }
      const details = error instanceof Error ? error.message : String(error);
      throw new StorageError(`Failed to get preference: ${details}`, "read");
    }
  }

  /**
   * Set a preference
   * @param key Key name
   * @param value Value
   */
  async set<T>(key: string, value: T): Promise<void> {
    try {
      const prefKey = this.getPrefKey(key);
      const stringValue = JSON.stringify(value);

      await this.storageProvider.setItem(prefKey, stringValue);
      // Add the key to the cache
      this.keyCache.add(key);
    } catch (error) {
      console.error(
        `[PreferenceService] Error setting preference for key "${key}":`,
        error,
      );
      if (typeof (error as any)?.code === "string") {
        throw toErrorWithCode(error);
      }
      const details = error instanceof Error ? error.message : String(error);
      throw new StorageError(`Failed to set preference: ${details}`, "write");
    }
  }

  /**
   * Delete a preference
   * @param key Key name
   */
  async delete(key: string): Promise<void> {
    try {
      const prefKey = this.getPrefKey(key);
      await this.storageProvider.removeItem(prefKey);
      // Remove the key from the cache
      this.keyCache.delete(key);
    } catch (error) {
      console.error(
        `[PreferenceService] Error deleting preference for key "${key}":`,
        error,
      );
      if (typeof (error as any)?.code === "string") {
        throw toErrorWithCode(error);
      }
      const details = error instanceof Error ? error.message : String(error);
      throw new StorageError(`Failed to delete preference: ${details}`, "delete");
    }
  }

  /**
   * Get the key names of all preferences
   * @returns List of key names
   */
  async keys(): Promise<string[]> {
    // Since IStorageProvider has no getAllKeys method, we can only return the known keys
    // This is a limitation, but should be sufficient in most cases
    return Array.from(this.keyCache);
  }

  /**
   * Clear all preferences
   */
  async clear(): Promise<void> {
    try {
      const prefKeys = Array.from(this.keyCache);
      for (const key of prefKeys) {
        await this.delete(key);
      }
      this.keyCache.clear();
    } catch (error) {
      console.error("[PreferenceService] Error clearing preferences:", error);
      if (typeof (error as any)?.code === "string") {
        throw toErrorWithCode(error);
      }
      const details = error instanceof Error ? error.message : String(error);
      throw new StorageError(`Failed to clear preferences: ${details}`, "clear");
    }
  }

  /**
   * Get all preferences
   * @returns Key-value object containing all preferences (using the original key names, without the prefix)
   */
  async getAll(): Promise<Record<string, string>> {
    try {
      const allKeys = await this.keys();
      const result: Record<string, string> = {};

      for (const key of allKeys) {
        try {
          const value = await this.get(key, null);
          if (value !== null) {
            result[key] = String(value);
          }
        } catch (error) {
          console.warn(
            `[PreferenceService] Failed to get preference for key "${key}":`,
            error,
          );
          // Continue with the other keys; one key's failure should not interrupt the rest
        }
      }

      return result;
    } catch (error) {
      console.error(
        "[PreferenceService] Error getting all preferences:",
        error,
      );
      if (typeof (error as any)?.code === "string") {
        throw toErrorWithCode(error);
      }
      const details = error instanceof Error ? error.message : String(error);
      throw new StorageError(`Failed to get all preferences: ${details}`, "read");
    }
  }

  // Implement the IImportExportable interface

  /**
   * Export all preferences
   */
  async exportData(): Promise<Record<string, string>> {
    try {
      return await this.getAll();
    } catch (error) {
      throw new ImportExportError(
        "Failed to export preference data",
        await this.getDataType(),
        error as Error,
        IMPORT_EXPORT_ERROR_CODES.EXPORT_FAILED,
      );
    }
  }

  /**
   * Import preferences
   */
  async importData(data: any): Promise<void> {
    if (!(await this.validateData(data))) {
      throw new ImportExportError(
        "Invalid preference data format: data must be an object with string key-value pairs",
        await this.getDataType(),
        undefined,
        IMPORT_EXPORT_ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const preferences = data as Record<string, string>;
    const failedSettings: { key: string; error: Error }[] = [];

    for (const [key, value] of Object.entries(preferences)) {
      try {
        // Validate that the key name is safe and in the whitelist
        if (!isValidSettingKey(key)) {
          console.warn(`Skipping invalid UI configuration key: ${key}`);
          continue;
        }

        // Validate that the value is safe
        if (!isValidSettingValue(value)) {
          console.warn(
            `Skipping invalid UI configuration value ${key}: type=${typeof value}`,
          );
          continue;
        }

        // Normalize the key name (handle legacy compatibility)
        const normalizedKey = normalizeSettingKey(key);

        await this.set(normalizedKey, value);

        // If the key name was converted, show the conversion info
        if (normalizedKey !== key) {
          console.log(
            `Imported UI configuration (legacy key converted): ${key} -> ${normalizedKey} = ${value}`,
          );
        } else {
          console.log(`Imported UI configuration: ${normalizedKey} = ${value}`);
        }
      } catch (error) {
        console.warn(`Failed to import UI setting ${key}:`, error);
        failedSettings.push({ key, error: error as Error });
      }
    }

    if (failedSettings.length > 0) {
      console.warn(`Failed to import ${failedSettings.length} UI settings`);
      // Do not throw; allow a partial import to succeed
    }
  }

  /**
   * Get the data type identifier
   */
  async getDataType(): Promise<string> {
    return "userSettings";
  }

  /**
   * Validate the preferences data format
   */
  async validateData(data: any): Promise<boolean> {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return false;
    }

    return Object.entries(data).every(
      ([key, value]) =>
        typeof key === "string" &&
        (typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"),
    );
  }

  /**
   * Get the key name with the prefix
   * @param key Original key name
   * @returns Key name with the prefix
   * @private
   */
  private getPrefKey(key: string): string {
    return `${this.PREFIX}${key}`;
  }
}

/**
 * Create the preference service
 * @param storageProvider Storage provider
 * @returns Preference service instance
 */
export function createPreferenceService(
  storageProvider: IStorageProvider,
): IPreferenceService {
  return new PreferenceService(storageProvider);
}
