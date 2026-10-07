import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PreferenceService } from '../../../src/services/preference/service';
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider';

describe('PreferenceService Import/Export', () => {
  let preferenceService: PreferenceService;
  let storageProvider: MemoryStorageProvider;

  beforeEach(() => {
    storageProvider = new MemoryStorageProvider();
    preferenceService = new PreferenceService(storageProvider);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('exportData', () => {
    it('should export all preferences', async () => {
      // Set some preferences
      await preferenceService.set('app:settings:ui:theme-id', 'dark');
      await preferenceService.set('app:settings:ui:preferred-language', 'zh-CN');
      await preferenceService.set('app:selected-optimize-model', 'openai');

      // Export data
      const exportedData = await preferenceService.exportData();

      // Verify the exported data
      expect(typeof exportedData).toBe('object');
      expect(exportedData).toEqual({
        'app:settings:ui:theme-id': 'dark',
        'app:settings:ui:preferred-language': 'zh-CN',
        'app:selected-optimize-model': 'openai'
      });
    });

    it('should export empty object when no preferences exist', async () => {
      const exportedData = await preferenceService.exportData();
      expect(exportedData).toEqual({});
    });

    it('should handle export error gracefully', async () => {
      // Simulate a getAll error
      vi.spyOn(preferenceService, 'getAll').mockRejectedValue(new Error('Storage error'));

      await expect(preferenceService.exportData()).rejects.toThrow('Failed to export preference data');
    });
  });

  describe('importData', () => {
    it('should import valid preferences', async () => {
      const importData = {
        'app:settings:ui:theme-id': 'light',
        'app:settings:ui:preferred-language': 'en-US',
        'app:selected-optimize-model': 'anthropic'
      };

      await preferenceService.importData(importData);

      // Verify the preferences were imported
      expect(await preferenceService.get('app:settings:ui:theme-id', null)).toBe('light');
      expect(await preferenceService.get('app:settings:ui:preferred-language', null)).toBe('en-US');
      expect(await preferenceService.get('app:selected-optimize-model', null)).toBe('anthropic');
    });

    it('should handle legacy key conversion', async () => {
      const importData = {
        'theme-id': 'dark', // Legacy key name
        'preferred-language': 'zh-CN', // Legacy key name
        'app:selected-optimize-model': 'openai' // New key name
      };

      await preferenceService.importData(importData);

      // Verify legacy key names were converted to the new ones
      expect(await preferenceService.get('app:settings:ui:theme-id', null)).toBe('dark');
      expect(await preferenceService.get('app:settings:ui:preferred-language', null)).toBe('zh-CN');
      expect(await preferenceService.get('app:selected-optimize-model', null)).toBe('openai');
    });

    it('should skip invalid keys (not in whitelist)', async () => {
      const importData = {
        'app:settings:ui:theme-id': 'dark', // Valid key
        'malicious-key': 'malicious-value', // Invalid key
        'app:settings:ui:preferred-language': 'zh-CN' // Valid key
      };

      // Should not throw, just skip invalid keys
      await expect(preferenceService.importData(importData)).resolves.not.toThrow();

      // Verify the valid keys were imported
      expect(await preferenceService.get('app:settings:ui:theme-id', null)).toBe('dark');
      expect(await preferenceService.get('app:settings:ui:preferred-language', null)).toBe('zh-CN');

      // Verify the invalid keys were skipped
      expect(await preferenceService.get('malicious-key', null)).toBe(null);
    });

    it('should skip invalid values', async () => {
      const importData = {
        'app:settings:ui:theme-id': 'dark', // Valid value
        'app:settings:ui:preferred-language': 123, // Invalid value (not a string)
        'app:selected-optimize-model': 'openai' // Valid value
      };

      await expect(preferenceService.importData(importData)).resolves.not.toThrow();

      // Verify the valid values were imported
      expect(await preferenceService.get('app:settings:ui:theme-id', null)).toBe('dark');
      expect(await preferenceService.get('app:selected-optimize-model', null)).toBe('openai');

      // Verify the invalid values were skipped
      expect(await preferenceService.get('app:settings:ui:preferred-language', null)).toBe(null);
    });

    it('should skip keys with dangerous characters', async () => {
      const importData = {
        'app:settings:ui:theme-id': 'dark', // Valid key
        'app<script>alert("xss")</script>': 'malicious', // Key containing dangerous characters
        'app:settings:ui:preferred-language': 'zh-CN' // Valid key
      };

      await expect(preferenceService.importData(importData)).resolves.not.toThrow();

      // Verify the valid keys were imported
      expect(await preferenceService.get('app:settings:ui:theme-id', null)).toBe('dark');
      expect(await preferenceService.get('app:settings:ui:preferred-language', null)).toBe('zh-CN');
    });

    it('should skip values with control characters', async () => {
      const importData = {
        'app:settings:ui:theme-id': 'dark', // Valid value
        'app:settings:ui:preferred-language': 'zh-CN\x00\x01', // Value containing control characters
        'app:selected-optimize-model': 'openai' // Valid value
      };

      await expect(preferenceService.importData(importData)).resolves.not.toThrow();

      // Verify the valid values were imported
      expect(await preferenceService.get('app:settings:ui:theme-id', null)).toBe('dark');
      expect(await preferenceService.get('app:selected-optimize-model', null)).toBe('openai');

      // Verify values containing control characters were skipped
      expect(await preferenceService.get('app:settings:ui:preferred-language', null)).toBe(null);
    });

    it('should handle import errors gracefully', async () => {
      const importData = {
        'app:settings:ui:theme-id': 'dark'
      };

      // Simulate a set error
      vi.spyOn(preferenceService, 'set').mockRejectedValue(new Error('Set error'));

      // Should not throw, just record the failure
      await expect(preferenceService.importData(importData)).resolves.not.toThrow();
    });
  });

  describe('validateData', () => {
    it('should validate correct preference data', async () => {
      const validData = {
        'app:settings:ui:theme-id': 'dark',
        'app:settings:ui:preferred-language': 'zh-CN',
        'app:selected-optimize-model': 'openai'
      };

      expect(await preferenceService.validateData(validData)).toBe(true);
    });

    it('should accept numeric and boolean values (converted to string)', async () => {
      const validData = {
        'app:settings:ui:theme-id': 'dark',
        'app:settings:ui:preferred-language': 123,
        'app:selected-optimize-model': true
      };

      expect(await preferenceService.validateData(validData)).toBe(true);
    });

    it('should reject invalid data formats', async () => {
      // Not an object
      expect(await preferenceService.validateData([])).toBe(false);
      expect(await preferenceService.validateData('string')).toBe(false);
      expect(await preferenceService.validateData(null)).toBe(false);

      // Array
      expect(await preferenceService.validateData(['item1', 'item2'])).toBe(false);
    });
  });

  describe('getDataType', () => {
    it('should return correct data type', async () => {
      expect(await preferenceService.getDataType()).toBe('userSettings');
    });
  });

  describe('security validation', () => {
    it('should reject keys that are too long', async () => {
      const longKey = 'a'.repeat(51); // Exceeds the 50-character limit
      const importData = {
        [longKey]: 'value'
      };

      await expect(preferenceService.importData(importData)).resolves.not.toThrow();

      // Verify the long key was skipped
      expect(await preferenceService.get(longKey, null)).toBe(null);
    });

    it('should reject values that are too long', async () => {
      const longValue = 'a'.repeat(1001); // Exceeds the 1000-character limit
      const importData = {
        'app:settings:ui:theme-id': longValue
      };

      await expect(preferenceService.importData(importData)).resolves.not.toThrow();

      // Verify the long value was skipped
      expect(await preferenceService.get('app:settings:ui:theme-id', null)).toBe(null);
    });

    it('should reject empty keys', async () => {
      const importData = {
        '': 'value' // Empty key
      };

      await expect(preferenceService.importData(importData)).resolves.not.toThrow();

      // Verify the empty key was skipped
      expect(await preferenceService.get('', null)).toBe(null);
    });
  });
});
