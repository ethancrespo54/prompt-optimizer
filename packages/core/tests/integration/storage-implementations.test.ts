import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalStorageProvider } from '../../src/services/storage/localStorageProvider';
import { DexieStorageProvider } from '../../src/services/storage/dexieStorageProvider';
import { StorageFactory } from '../../src/services/storage/factory';
import { HistoryManager } from '../../src/services/history/manager';
import { TemplateManager } from '../../src/services/template/manager';
import { ModelManager } from '../../src/services/model/manager';
import { createTemplateManager } from '../../src/services/template/manager';
import { createTemplateLanguageService } from '../../src/services/template/languageService';
import { createModelManager } from '../../src/services/model/manager';
import { IStorageProvider } from '../../src/services/storage/types';
import { PromptRecord } from '../../src/services/history/types';
import { TextModelConfig } from '../../src/services/model/types';
import { TextAdapterRegistry } from '../../src/services/llm/adapters/registry';
import { v4 as uuidv4 } from 'uuid';
import {createPreferenceService} from "../../src";

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(),
}));

// Mock model manager
vi.mock('../../src/services/model/manager', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    modelManager: {
      getModel: vi.fn().mockReturnValue({
        name: 'Test Model',
        defaultModel: 'test-model'
      })
    }
  };
});

/**
 * Generic test suite for storage implementations
 * This test suite runs the same tests against all storage implementations, ensuring they behave consistently
 */
describe('Generic storage implementation test', () => {
  // Define the storage implementations to test
  const storageImplementations: Array<{
    name: string;
    createProvider: () => IStorageProvider;
    cleanup?: () => Promise<void>;
  }> = [
    {
      name: 'LocalStorageProvider',
      createProvider: () => new LocalStorageProvider(),
      cleanup: async () => {
        // Clean up localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.clear();
        }
      }
    }
    // Dexie tests are disabled for now because the test environment has no IndexedDB
    // {
    //   name: 'DexieStorageProvider', 
    //   createProvider: () => new DexieStorageProvider(),
    //   cleanup: async () => {
    //     // Clean up the Dexie database
    //     try {
    //       const provider = new DexieStorageProvider();
    //       await provider.clearAll();
    //       await provider.close();
    //     } catch (error) {
    //       // Ignore cleanup errors
    //     }
    //   }
    // }
  ];

  // Run the tests for each storage implementation
  storageImplementations.forEach(({ name, createProvider, cleanup }) => {
    describe(`${name} implementation test`, () => {
      let storageProvider: IStorageProvider;

      beforeEach(async () => {
        storageProvider = createProvider();
        
        // Clean up the storage
        if (cleanup) {
          await cleanup();
        }
        
        // Reset the UUID mock
        (uuidv4 as any).mockClear();
        let counter = 0;
        (uuidv4 as any).mockImplementation(() => `mock-uuid-${++counter}`);
      });

      afterEach(async () => {
        if (cleanup) {
          await cleanup();
        }
      });

      describe('Basic storage operations', () => {
        it('should be able to set and get data', async () => {
          const key = 'test-key';
          const value = 'test-value';

          await storageProvider.setItem(key, value);
          const retrieved = await storageProvider.getItem(key);

          expect(retrieved).toBe(value);
        });

        it('should return null when the key does not exist', async () => {
          const result = await storageProvider.getItem('non-existent-key');
          expect(result).toBeNull();
        });

        it('should be able to delete data', async () => {
          const key = 'test-key';
          const value = 'test-value';

          await storageProvider.setItem(key, value);
          await storageProvider.removeItem(key);
          const result = await storageProvider.getItem(key);

          expect(result).toBeNull();
        });

        it('should be able to clear all data', async () => {
          await storageProvider.setItem('key1', 'value1');
          await storageProvider.setItem('key2', 'value2');
          
          await storageProvider.clearAll();
          
          const result1 = await storageProvider.getItem('key1');
          const result2 = await storageProvider.getItem('key2');
          
          expect(result1).toBeNull();
          expect(result2).toBeNull();
        });
      });

      describe('Atomic operation test', () => {
        it('should support atomic update operations', async () => {
          if (!storageProvider.updateData) {
            console.log(`${name} does not support atomic updates, skipping the test`);
            return;
          }

          const key = 'atomic-test';
          const initialData = { count: 0 };

          // Set the initial data
          await storageProvider.setItem(key, JSON.stringify(initialData));

          // Perform the atomic update
          await storageProvider.updateData(key, (current: any) => {
            const data = current || { count: 0 };
            return { count: data.count + 1 };
          });

          // Verify the result
          const result = await storageProvider.getItem(key);
          const parsedResult = JSON.parse(result!);
          expect(parsedResult.count).toBe(1);
        });

        it('should support concurrent atomic updates', async () => {
          if (!storageProvider.updateData) {
            console.log(`${name} does not support atomic updates, skipping the test`);
            return;
          }

          const key = 'concurrent-test';
          const initialData = { count: 0 };

          // Set the initial data
          await storageProvider.setItem(key, JSON.stringify(initialData));

          // Run multiple atomic updates concurrently
          const updatePromises = Array.from({ length: 5 }, () =>
            storageProvider.updateData!(key, (current: any) => {
              const data = current || { count: 0 };
              return { count: data.count + 1 };
            })
          );

          await Promise.all(updatePromises);

          // Verify the final result
          const result = await storageProvider.getItem(key);
          const parsedResult = JSON.parse(result!);
          expect(parsedResult.count).toBe(5);
        });
      });

      describe('Batch operation test', () => {
        it('should support batch update operations', async () => {
          if (!storageProvider.batchUpdate) {
            console.log(`${name} does not support batch updates, skipping the test`);
            return;
          }

          const operations = [
            { key: 'batch1', operation: 'set' as const, value: 'value1' },
            { key: 'batch2', operation: 'set' as const, value: 'value2' },
            { key: 'batch3', operation: 'set' as const, value: 'value3' }
          ];

          await storageProvider.batchUpdate(operations);

          // Verify all data was set
          const result1 = await storageProvider.getItem('batch1');
          const result2 = await storageProvider.getItem('batch2');
          const result3 = await storageProvider.getItem('batch3');

          expect(result1).toBe('value1');
          expect(result2).toBe('value2');
          expect(result3).toBe('value3');
        });

        it('should support batch delete operations', async () => {
          if (!storageProvider.batchUpdate) {
            console.log(`${name} does not support batch updates, skipping the test`);
            return;
          }

          // Set some data first
          await storageProvider.setItem('delete1', 'value1');
          await storageProvider.setItem('delete2', 'value2');

          // Batch delete
          const operations = [
            { key: 'delete1', operation: 'remove' as const },
            { key: 'delete2', operation: 'remove' as const }
          ];

          await storageProvider.batchUpdate(operations);

          // Verify the data was deleted
          const result1 = await storageProvider.getItem('delete1');
          const result2 = await storageProvider.getItem('delete2');

          expect(result1).toBeNull();
          expect(result2).toBeNull();
        });
      });

      describe('HistoryManager integration test', () => {
        let historyManager: HistoryManager;
        let modelManager: ModelManager;

        beforeEach(() => {
          modelManager = createModelManager(storageProvider);
          historyManager = new HistoryManager(storageProvider, modelManager);
        });

        it('should be able to add and get history records', async () => {
          const record: PromptRecord = {
            id: 'test-record-1',
            chainId: 'test-chain-1',
            originalPrompt: 'Test original prompt',
            optimizedPrompt: 'Test optimized prompt',
            type: 'optimize',
            version: 1,
            timestamp: Date.now(),
            modelKey: 'test-model',
            templateId: 'test-template',
            metadata: {}
          };

          await historyManager.addRecord(record);
          const records = await historyManager.getRecords();

          expect(records).toHaveLength(1);
          expect(records[0].id).toBe('test-record-1');
        });

        it('should be able to create a new record chain', async () => {
          const chainParams = {
            id: 'chain-record-1',
            originalPrompt: 'Chain original prompt',
            optimizedPrompt: 'Chain optimized prompt',
            type: 'optimize' as const,
            modelKey: 'test-model',
            templateId: 'test-template',
            timestamp: Date.now(),
            metadata: {}
          };

          const chain = await historyManager.createNewChain(chainParams);

          expect(chain.chainId).toBe('mock-uuid-1');
          expect(chain.rootRecord.id).toBe('chain-record-1');
          expect(chain.currentRecord.id).toBe('chain-record-1');
          expect(chain.versions).toHaveLength(1);
        });

        it('should support adding records concurrently', async () => {
          const records: PromptRecord[] = Array.from({ length: 5 }, (_, i) => ({
            id: `concurrent-record-${i}`,
            chainId: `concurrent-chain-${i}`,
            originalPrompt: `Original prompt ${i}`,
            optimizedPrompt: `Optimized prompt ${i}`,
            type: 'optimize',
            version: 1,
            timestamp: Date.now() + i,
            modelKey: 'test-model',
            templateId: 'test-template',
            metadata: {}
          }));

          // Add records concurrently
          await Promise.all(records.map(record => historyManager.addRecord(record)));

          // Verify all records were added
          const allRecords = await historyManager.getRecords();
          expect(allRecords).toHaveLength(5);

          // Verify the records are sorted by timestamp (newest first)
          for (let i = 0; i < allRecords.length - 1; i++) {
            expect(allRecords[i].timestamp).toBeGreaterThanOrEqual(allRecords[i + 1].timestamp);
          }
        });
      });

      describe('TemplateManager integration test', () => {
        let templateManager: TemplateManager;

        beforeEach(async () => {
          const preferenceService = createPreferenceService(storageProvider)
          const languageService = createTemplateLanguageService(preferenceService);
          templateManager = createTemplateManager(storageProvider, languageService);
    
        });

        it('should be able to save and get a template', async () => {
          const template = {
            id: 'test-template',
            name: 'Test Template',
            content: 'Test content: {{input}}',
            isBuiltin: false,
            metadata: {
              version: '1.0.0',
              templateType: 'optimize' as const,
              lastModified: Date.now(),
              language: 'zh' as const
            }
          };

          await templateManager.saveTemplate(template);
          const retrieved = await templateManager.getTemplate('test-template');

          expect(retrieved.id).toBe('test-template');
          expect(retrieved.name).toBe('Test Template');
        });

        it('should be able to list all templates', async () => {
          const template1 = {
            id: 'template-1',
            name: 'Template 1',
            content: 'Content 1: {{input}}',
            isBuiltin: false,
            metadata: {
              version: '1.0.0',
              templateType: 'optimize' as const,
              lastModified: Date.now(),
              language: 'zh' as const
            }
          };

          const template2 = {
            id: 'template-2',
            name: 'Template 2',
            content: 'Content 2: {{input}}',
            isBuiltin: false,
            metadata: {
              version: '1.0.0',
              templateType: 'iterate' as const,
              lastModified: Date.now(),
              language: 'zh' as const
            }
          };

          await templateManager.saveTemplate(template1);
          await templateManager.saveTemplate(template2);

          const templates = await templateManager.listTemplates();
          const userTemplates = templates.filter(t => !t.isBuiltin);

          expect(userTemplates).toHaveLength(2);
        });
      });

      describe('ModelManager integration test', () => {
        let modelManager: ModelManager;

        beforeEach(async () => {
          modelManager = createModelManager(storageProvider);
        });

        it('should be able to add and get a model config', async () => {
          const registry = new TextAdapterRegistry();
          const adapter = registry.getAdapter('openai');
          const config: TextModelConfig = {
            id: 'test-model',
            name: 'Test Model',
            enabled: false,
            providerMeta: adapter.getProvider(),
            modelMeta: adapter.buildDefaultModel('test-model-1'),
            connectionConfig: {
              apiKey: 'test-api-key',
              baseURL: 'https://api.test.com'
            },
            paramOverrides: {}
          };

          await modelManager.addModel('test-model', config);
          const retrieved = await modelManager.getModel('test-model');

          expect(retrieved?.name).toBe('Test Model');
          expect(retrieved?.connectionConfig.baseURL).toBe('https://api.test.com');
        });

        it('should be able to enable and disable a model', async () => {
          const registry = new TextAdapterRegistry();
          const adapter = registry.getAdapter('openai');
          const config: TextModelConfig = {
            id: 'test-model',
            name: 'Test Model',
            enabled: false,
            providerMeta: adapter.getProvider(),
            modelMeta: adapter.buildDefaultModel('test-model-1'),
            connectionConfig: {
              apiKey: 'test-api-key',
              baseURL: 'https://api.test.com'
            },
            paramOverrides: {}
          };

          await modelManager.addModel('test-model', config);
          await modelManager.enableModel('test-model');

          const enabledModels = await modelManager.getEnabledModels();
          expect(enabledModels.some(m => m.id === 'test-model')).toBe(true);

          await modelManager.disableModel('test-model');
          const disabledModels = await modelManager.getEnabledModels();
          expect(disabledModels.some(m => m.id === 'test-model')).toBe(false);
        });
      });
    });
  });

  describe('Storage factory test', () => {
    it('should be able to create a localStorage provider', () => {
      const provider = StorageFactory.create('localStorage');
      expect(provider).toBeInstanceOf(LocalStorageProvider);
    });

    it('should be able to create a Dexie provider', () => {
      const provider = StorageFactory.create('dexie');
      expect(provider).toBeInstanceOf(DexieStorageProvider);
    });

    it('should throw an error for an unsupported type', () => {
      expect(() => {
        // @ts-ignore - deliberately passing an invalid type
        StorageFactory.create('invalid');
      }).toThrow('Unsupported storage type: invalid');
    });

    it('should be able to create a provider of the specified type', () => {
      const dexieProvider = StorageFactory.create('dexie');
      expect(dexieProvider).toBeDefined();
      expect(dexieProvider instanceof DexieStorageProvider).toBe(true);

      const localProvider = StorageFactory.create('localStorage');
      expect(localProvider).toBeDefined();
      expect(localProvider instanceof LocalStorageProvider).toBe(true);
    });

    it('should ensure providers of the same type are singletons', () => {
      // Reset the factory state
      StorageFactory.reset();

      // Create multiple provider instances of the same type
      const provider1 = StorageFactory.create('memory');
      const provider2 = StorageFactory.create('memory');
      const provider3 = StorageFactory.create('memory');

      // Verify they are the same instance
      expect(provider1).toBe(provider2);
      expect(provider2).toBe(provider3);
      expect(provider1).toBe(provider3);
    });

    it('should ensure providers of the same type are singletons', () => {
      // Reset the factory state
      StorageFactory.reset();
      
      // Create multiple providers of the same type
      const localStorage1 = StorageFactory.create('localStorage');
      const localStorage2 = StorageFactory.create('localStorage');
      const dexie1 = StorageFactory.create('dexie');
      const dexie2 = StorageFactory.create('dexie');
      
      // Verify providers of the same type are singletons
      expect(localStorage1).toBe(localStorage2);
      expect(dexie1).toBe(dexie2);
      
      // Verify providers of different types are different instances
      expect(localStorage1).not.toBe(dexie1);
    });

    it('should be able to reset the factory state', () => {
      // Create some instances
      const memory1 = StorageFactory.create('memory');
      const localStorage1 = StorageFactory.create('localStorage');

      // Reset the state
      StorageFactory.reset();

      // Creating a new instance should give a different object
      const memory2 = StorageFactory.create('memory');
      const localStorage2 = StorageFactory.create('localStorage');

      expect(memory2).not.toBe(memory1);
      expect(localStorage2).not.toBe(localStorage1);
    });
  });

  // Note: the data migration test needs a browser environment and cannot run in the Node.js test environment
  // These tests should be run in the E2E tests
}); 