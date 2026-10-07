import { describe, it, expect, beforeEach } from 'vitest';
import { createTemplateManager } from '../../../src/services/template/manager';
import { createTemplateLanguageService } from '../../../src/services/template/languageService';
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider';
import { PreferenceService } from '../../../src/services/preference/service';

describe('Extended Metadata Fields Support', () => {
  let templateManager: any;
  let storageProvider: MemoryStorageProvider;
  let languageService: any;

  beforeEach(async () => {
    storageProvider = new MemoryStorageProvider();
    const preferenceService = new PreferenceService(storageProvider);
    languageService = createTemplateLanguageService(preferenceService);
    templateManager = createTemplateManager(storageProvider, languageService);

  });

  it('should save and retrieve template with custom metadata fields', async () => {
    const templateWithExtraFields = {
      id: 'test-extended-template',
      name: 'Extended fields test template',
      content: 'This is a template for testing extended fields',
      metadata: {
        version: '1.0.0',
        lastModified: Date.now(),
        templateType: 'optimize' as const,
        // Basic optional fields
        author: 'Test author',
        description: 'Test description',
        language: 'zh' as const,
        // Extra custom fields
        customField: 'Custom content',
        tags: ['test', 'extension', 'metadata'],
        priority: 5,
        category: 'Experimental',
        isExperimental: true,
        config: {
          maxTokens: 1000,
          temperature: 0.7
        }
      }
    };

    // Save the template
    await templateManager.saveTemplate(templateWithExtraFields);

    // Get the template
    const savedTemplate = await templateManager.getTemplate('test-extended-template');

    // Verify the basic fields
    expect(savedTemplate.id).toBe('test-extended-template');
    expect(savedTemplate.name).toBe('Extended fields test template');
    expect(savedTemplate.metadata.version).toBe('1.0.0');
    expect(savedTemplate.metadata.templateType).toBe('optimize');
    expect(savedTemplate.metadata.author).toBe('Test author');
    expect(savedTemplate.metadata.description).toBe('Test description');
    expect(savedTemplate.metadata.language).toBe('zh');

    // Verify the extra fields
    expect(savedTemplate.metadata.customField).toBe('Custom content');
    expect(savedTemplate.metadata.tags).toEqual(['test', 'extension', 'metadata']);
    expect(savedTemplate.metadata.priority).toBe(5);
    expect(savedTemplate.metadata.category).toBe('Experimental');
    expect(savedTemplate.metadata.isExperimental).toBe(true);
    expect(savedTemplate.metadata.config).toEqual({
      maxTokens: 1000,
      temperature: 0.7
    });
  });

  it('should export and import template with custom metadata fields', async () => {
    const templateWithExtraFields = {
      id: 'test-export-import',
      name: 'Export/import test',
      content: 'Test export/import functionality',
      metadata: {
        version: '1.0.0',
        lastModified: Date.now(),
        templateType: 'iterate' as const,
        customData: {
          nested: {
            value: 'deep nesting test'
          }
        },
        arrayField: [1, 2, 3, { key: 'value' }],
        booleanField: false,
        numberField: 42.5
      }
    };

    // Save the original template
    await templateManager.saveTemplate(templateWithExtraFields);

    // Export the template
    const exportedJson = await templateManager.exportTemplate('test-export-import');
    
    // Delete the original template
    await templateManager.deleteTemplate('test-export-import');

    // Import the template
    await templateManager.importTemplate(exportedJson);

    // Verify the imported template
    const importedTemplate = await templateManager.getTemplate('test-export-import');
    
    expect(importedTemplate.metadata.customData).toEqual({
      nested: {
        value: 'deep nesting test'
      }
    });
    expect(importedTemplate.metadata.arrayField).toEqual([1, 2, 3, { key: 'value' }]);
    expect(importedTemplate.metadata.booleanField).toBe(false);
    expect(importedTemplate.metadata.numberField).toBe(42.5);
  });

  it('should maintain core field validation while allowing extra fields', async () => {
    // Test that a missing required field still errors
    const invalidTemplate = {
      id: 'invalid-template',
      name: 'Invalid template',
      content: 'Test content',
      metadata: {
        // Missing the required version field
        lastModified: Date.now(),
        templateType: 'optimize' as const,
        customField: 'This custom field should be ignored'
      }
    };

    await expect(templateManager.saveTemplate(invalidTemplate as any))
      .rejects.toThrow('Template validation failed');
  });

  it('should handle templates with mixed field types in metadata', async () => {
    const mixedFieldsTemplate = {
      id: 'mixed-fields-test',
      name: 'Mixed fields test',
      content: 'Test various data types',
      metadata: {
        version: '2.0.0',
        lastModified: Date.now(),
        templateType: 'userOptimize' as const,
        // Custom fields of different types
        stringField: 'string value',
        numberField: 123,
        booleanField: true,
        arrayField: ['a', 'b', 'c'],
        objectField: { nested: 'value' },
        nullField: null,
        undefinedField: undefined
      }
    };

    await templateManager.saveTemplate(mixedFieldsTemplate);
    const savedTemplate = await templateManager.getTemplate('mixed-fields-test');

    expect(savedTemplate.metadata.stringField).toBe('string value');
    expect(savedTemplate.metadata.numberField).toBe(123);
    expect(savedTemplate.metadata.booleanField).toBe(true);
    expect(savedTemplate.metadata.arrayField).toEqual(['a', 'b', 'c']);
    expect(savedTemplate.metadata.objectField).toEqual({ nested: 'value' });
    expect(savedTemplate.metadata.nullField).toBe(null);
    // undefined fields are usually ignored after JSON serialization
  });
}); 