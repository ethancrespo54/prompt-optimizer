import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TemplateManager } from '../../../src/services/template/manager';
import { Template } from '../../../src/services/template/types';
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider';
import { TemplateLanguageService } from '../../../src/services/template/languageService';
import { PreferenceService } from '../../../src/services/preference/service';

describe('TemplateManager Import/Export', () => {
  let templateManager: TemplateManager;
  let storageProvider: MemoryStorageProvider;
  let languageService: TemplateLanguageService;
  let preferenceService: PreferenceService;

  beforeEach(async () => {
    storageProvider = new MemoryStorageProvider();
    await storageProvider.clearAll();

    preferenceService = new PreferenceService(storageProvider);
    languageService = new TemplateLanguageService(preferenceService);
    await languageService.initialize();
    templateManager = new TemplateManager(storageProvider, languageService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('exportData', () => {
    it('should export only user templates', async () => {
      // Add user templates
      const userTemplate: Template = {
        id: 'user-template-1',
        name: 'User Template 1',
        content: 'User template content',
        isBuiltin: false,
        metadata: {
          version: '1.0.0',
          lastModified: Date.now(),
          templateType: 'optimize',
          author: 'User'
        }
      };

      await templateManager.saveTemplate(userTemplate);

      // Export data
      const exportedData = await templateManager.exportData();

      // Verify the exported data
      expect(Array.isArray(exportedData)).toBe(true);
      
      // Should contain only user templates, not built-in templates
      const userTemplates = exportedData.filter(template => !template.isBuiltin);
      const builtinTemplates = exportedData.filter(template => template.isBuiltin);
      
      expect(userTemplates.length).toBeGreaterThan(0);
      expect(builtinTemplates.length).toBe(0);

      // Verify the user template content
      const exportedUserTemplate = exportedData.find(template => template.id === 'user-template-1');
      expect(exportedUserTemplate).toBeDefined();
      expect(exportedUserTemplate?.name).toBe('User Template 1');
    });

    it('should export empty array when no user templates exist', async () => {
      const exportedData = await templateManager.exportData();
      
      // Should return an empty array (only built-in templates, which are not exported)
      expect(Array.isArray(exportedData)).toBe(true);
      expect(exportedData.length).toBe(0);
    });

    it('should handle export error gracefully', async () => {
      // Simulate a listTemplates error
      vi.spyOn(templateManager, 'listTemplates').mockRejectedValue(new Error('Storage error'));

      await expect(templateManager.exportData()).rejects.toThrow('Failed to export template data');
    });
  });

  describe('importData', () => {
    it('should replace existing user templates', async () => {
      // Add some user templates first
      const existingTemplate: Template = {
        id: 'existing-template',
        name: 'Existing Template',
        content: 'Existing content',
        isBuiltin: false,
        metadata: {
          version: '1.0.0',
          lastModified: Date.now(),
          templateType: 'optimize',
          author: 'User'
        }
      };

      await templateManager.saveTemplate(existingTemplate);

      // Verify the templates exist
      const beforeImport = await templateManager.listTemplates();
      const existingUserTemplates = beforeImport.filter(t => !t.isBuiltin);
      expect(existingUserTemplates.length).toBe(1);

      // Import new templates
      const importData: Template[] = [
        {
          id: 'imported-template-1',
          name: 'Imported Template 1',
          content: 'Imported content 1',
          isBuiltin: false,
          metadata: {
            version: '1.0.0',
            lastModified: Date.now(),
            templateType: 'optimize',
            author: 'User'
          }
        },
        {
          id: 'imported-template-2',
          name: 'Imported Template 2',
          content: 'Imported content 2',
          isBuiltin: false,
          metadata: {
            version: '1.0.0',
            lastModified: Date.now(),
            templateType: 'iterate',
            author: 'User'
          }
        }
      ];

      await templateManager.importData(importData);

      // Verify replace mode: old templates are deleted, new templates are added
      const afterImport = await templateManager.listTemplates();
      const userTemplates = afterImport.filter(t => !t.isBuiltin);
      
      expect(userTemplates.length).toBe(2);
      expect(userTemplates.find(t => t.id === 'existing-template')).toBeUndefined();
      expect(userTemplates.find(t => t.id === 'imported-template-1')).toBeDefined();
      expect(userTemplates.find(t => t.id === 'imported-template-2')).toBeDefined();
    });

    it('should handle builtin template ID conflicts', async () => {
      // Get the list of built-in templates
      const allTemplates = await templateManager.listTemplates();
      const builtinTemplates = allTemplates.filter(t => t.isBuiltin);
      
      if (builtinTemplates.length === 0) {
        // If there are no built-in templates, skip this test
        return;
      }

      const builtinTemplate = builtinTemplates[0];

      // Try to import a template whose ID conflicts with a built-in template
      const importData: Template[] = [
        {
          id: builtinTemplate.id, // Use the built-in template's ID
          name: 'Conflicting Template',
          content: 'Conflicting content',
          isBuiltin: false,
          metadata: {
            version: '1.0.0',
            lastModified: Date.now(),
            templateType: 'optimize',
            author: 'User'
          }
        }
      ];

      await templateManager.importData(importData);

      // Verify conflict handling: a new ID and name should be generated
      const afterImport = await templateManager.listTemplates();
      const userTemplates = afterImport.filter(t => !t.isBuiltin);
      
      expect(userTemplates.length).toBe(1);
      
      const importedTemplate = userTemplates[0];
      expect(importedTemplate.id).not.toBe(builtinTemplate.id); // The ID should be changed
      expect(importedTemplate.id).toMatch(/^user-.*-\d+-[a-z0-9]+$/); // Should match the generated ID format
      expect(importedTemplate.name).toBe('Conflicting Template (Imported Copy)'); // The name should be modified
    });

    it('should preserve template metadata and set defaults', async () => {
      const importData: Template[] = [
        {
          id: 'metadata-template',
          name: 'Metadata Template',
          content: 'Template with metadata',
          isBuiltin: true, // Should be forced to false
          metadata: {
            version: '2.0.0',
            lastModified: 1000000, // Should be updated to the current time
            templateType: 'iterate',
            author: 'Original Author',
            description: 'Original description',
            language: 'en'
          }
        }
      ];

      await templateManager.importData(importData);

      const afterImport = await templateManager.listTemplates();
      const userTemplates = afterImport.filter(t => !t.isBuiltin);
      const importedTemplate = userTemplates.find(t => t.id === 'metadata-template');

      expect(importedTemplate).toBeDefined();
      expect(importedTemplate?.isBuiltin).toBe(false); // Should be forced to false
      expect(importedTemplate?.metadata.version).toBe('2.0.0'); // Original value kept
      expect(importedTemplate?.metadata.lastModified).toBeGreaterThan(1000000); // Should be updated
      expect(importedTemplate?.metadata.templateType).toBe('iterate'); // Original value kept
      expect(importedTemplate?.metadata.author).toBe('Original Author'); // Original value kept
      expect(importedTemplate?.metadata.description).toBe('Original description'); // Original value kept
      expect(importedTemplate?.metadata.language).toBe('en'); // Normalized to a valid value
    });

    it('should provide default metadata for incomplete templates', async () => {
      const importData: Template[] = [
        {
          id: 'minimal-template',
          name: 'Minimal Template',
          content: 'Minimal content',
          isBuiltin: false,
          metadata: {
            // Provide only part of the metadata
            author: 'Test Author'
          } as any
        }
      ];

      await templateManager.importData(importData);

      const afterImport = await templateManager.listTemplates();
      const userTemplates = afterImport.filter(t => !t.isBuiltin);
      const importedTemplate = userTemplates.find(t => t.id === 'minimal-template');

      expect(importedTemplate).toBeDefined();
      expect(importedTemplate?.metadata.version).toBe('1.0.0'); // Default value
      expect(importedTemplate?.metadata.templateType).toBe('optimize'); // Default value
      expect(importedTemplate?.metadata.author).toBe('Test Author'); // Original value kept
      expect(importedTemplate?.metadata.lastModified).toBeGreaterThan(0); // Should be set
    });

    it('should skip invalid templates', async () => {
      const importData = [
        {
          // Missing id field
          name: 'Invalid Template 1',
          content: 'Invalid content 1',
          isBuiltin: false,
          metadata: {
            version: '1.0.0',
            lastModified: Date.now(),
            templateType: 'optimize',
            author: 'User'
          }
        },
        {
          id: 'valid-template',
          name: 'Valid Template',
          content: 'Valid content',
          isBuiltin: false,
          metadata: {
            version: '1.0.0',
            lastModified: Date.now(),
            templateType: 'optimize',
            author: 'User'
          }
        }
      ];

      // Should not throw, just skip invalid templates
      await expect(templateManager.importData(importData)).resolves.not.toThrow();

      // Verify the valid template was imported
      const afterImport = await templateManager.listTemplates();
      const userTemplates = afterImport.filter(t => !t.isBuiltin);
      expect(userTemplates.length).toBe(1);
      expect(userTemplates[0].id).toBe('valid-template');
    });

    it('should handle import errors gracefully', async () => {
      const importData: Template[] = [
        {
          id: 'error-template',
          name: 'Error Template',
          content: 'Error content',
          isBuiltin: false,
          metadata: {
            version: '1.0.0',
            lastModified: Date.now(),
            templateType: 'optimize',
            author: 'User'
          }
        }
      ];

      // Simulate a saveTemplate error
      vi.spyOn(templateManager, 'saveTemplate').mockRejectedValue(new Error('Save template error'));

      // Should not throw, just record the failure
      await expect(templateManager.importData(importData)).resolves.not.toThrow();
    });
  });

  describe('validateData', () => {
    it('should validate correct template data', async () => {
      const validData: Template[] = [
        {
          id: 'test-template',
          name: 'Test Template',
          content: 'Test content',
          isBuiltin: false,
          metadata: {
            version: '1.0.0',
            lastModified: Date.now(),
            templateType: 'optimize',
            author: 'User'
          }
        }
      ];

      expect(await templateManager.validateData(validData)).toBe(true);
    });

    it('should reject invalid data formats', async () => {
      // Not an array
      expect(await templateManager.validateData({})).toBe(false);
      expect(await templateManager.validateData('string')).toBe(false);
      expect(await templateManager.validateData(null)).toBe(false);

      // Missing required fields
      expect(await templateManager.validateData([
        {
          name: 'Test Template',
          // Missing id
          content: 'Test content',
          isBuiltin: false,
          metadata: {}
        }
      ])).toBe(false);

      // Wrong field type
      expect(await templateManager.validateData([
        {
          id: 'test-template',
          name: 123, // Should be a string
          content: 'Test content',
          isBuiltin: false,
          metadata: {}
        }
      ])).toBe(false);
    });
  });

  describe('getDataType', () => {
    it('should return correct data type', async () => {
      expect(await templateManager.getDataType()).toBe('userTemplates');
    });
  });
});
