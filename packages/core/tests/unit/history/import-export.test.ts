import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HistoryManager } from '../../../src/services/history/manager';
import { PromptRecord } from '../../../src/services/history/types';
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider';
import { ModelManager } from '../../../src/services/model/manager';

describe('HistoryManager Import/Export', () => {
  let historyManager: HistoryManager;
  let storageProvider: MemoryStorageProvider;
  let modelManager: ModelManager;

  beforeEach(async () => {
    storageProvider = new MemoryStorageProvider();
    modelManager = new ModelManager(storageProvider);
    await modelManager.ensureInitialized();
    historyManager = new HistoryManager(storageProvider, modelManager);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('exportData', () => {
    it('should export all history records', async () => {
      // Add some history records
      const record1: PromptRecord = {
        id: 'record-1',
        originalPrompt: 'Test prompt 1',
        optimizedPrompt: 'Test response 1',
        type: 'optimize',
        chainId: 'chain-1',
        version: 1,
        timestamp: Date.now(),
        modelKey: 'openai',
        templateId: 'template-1'
      };

      const record2: PromptRecord = {
        id: 'record-2',
        originalPrompt: 'Test prompt 2',
        optimizedPrompt: 'Test response 2',
        type: 'iterate',
        chainId: 'chain-1',
        version: 2,
        timestamp: Date.now() + 1000,
        modelKey: 'anthropic',
        templateId: 'template-2',
        previousId: 'record-1'
      };

      await historyManager.addRecord(record1);
      await historyManager.addRecord(record2);

      // Export data
      const exportedData = await historyManager.exportData();

      // Verify the exported data
      expect(Array.isArray(exportedData)).toBe(true);
      expect(exportedData.length).toBe(2);

      // Verify record content
      const exportedRecord1 = exportedData.find(record => record.id === 'record-1');
      const exportedRecord2 = exportedData.find(record => record.id === 'record-2');

      expect(exportedRecord1).toBeDefined();
      expect(exportedRecord1?.originalPrompt).toBe('Test prompt 1');
      expect(exportedRecord1?.optimizedPrompt).toBe('Test response 1');

      expect(exportedRecord2).toBeDefined();
      expect(exportedRecord2?.chainId).toBe('chain-1');
      expect(exportedRecord2?.previousId).toBe('record-1');
    });

    it('should export empty array when no records exist', async () => {
      const exportedData = await historyManager.exportData();
      expect(Array.isArray(exportedData)).toBe(true);
      expect(exportedData.length).toBe(0);
    });

    it('should handle export error gracefully', async () => {
      // Simulate a getRecords error
      vi.spyOn(historyManager, 'getRecords').mockRejectedValue(new Error('Storage error'));

      await expect(historyManager.exportData()).rejects.toThrow('Failed to export history data');
    });
  });

  describe('importData', () => {
    it('should replace existing history records', async () => {
      // Add some existing records first
      const existingRecord: PromptRecord = {
        id: 'existing-record',
        originalPrompt: 'Existing prompt',
        optimizedPrompt: 'Existing response',
        type: 'optimize',
        chainId: 'existing-chain',
        version: 1,
        timestamp: Date.now(),
        modelKey: 'openai',
        templateId: 'template-1'
      };

      await historyManager.addRecord(existingRecord);

      // Verify the records exist
      const beforeImport = await historyManager.getRecords();
      expect(beforeImport.length).toBe(1);

      // Import new records
      const importData: PromptRecord[] = [
        {
          id: 'imported-record-1',
          originalPrompt: 'Imported prompt 1',
          optimizedPrompt: 'Imported response 1',
          type: 'optimize',
          chainId: 'imported-chain-1',
          version: 1,
          timestamp: Date.now(),
          modelKey: 'anthropic',
          templateId: 'template-2'
        },
        {
          id: 'imported-record-2',
          originalPrompt: 'Imported prompt 2',
          optimizedPrompt: 'Imported response 2',
          type: 'iterate',
          chainId: 'imported-chain-1',
          version: 2,
          timestamp: Date.now() + 1000,
          modelKey: 'openai',
          templateId: 'template-3',
          previousId: 'imported-record-1'
        }
      ];

      await historyManager.importData(importData);

      // Verify replace mode: old records are deleted, new records are added
      const afterImport = await historyManager.getRecords();
      expect(afterImport.length).toBe(2);
      
      expect(afterImport.find(r => r.id === 'existing-record')).toBeUndefined();
      expect(afterImport.find(r => r.id === 'imported-record-1')).toBeDefined();
      expect(afterImport.find(r => r.id === 'imported-record-2')).toBeDefined();
    });

    it('should preserve original IDs and maintain data relationships', async () => {
      // Import records with relationships
      const importData: PromptRecord[] = [
        {
          id: 'parent-record',
          originalPrompt: 'Parent prompt',
          optimizedPrompt: 'Parent response',
          type: 'optimize',
          chainId: 'test-chain',
          version: 1,
          timestamp: Date.now(),
          modelKey: 'openai',
          templateId: 'template-1'
        },
        {
          id: 'child-record',
          originalPrompt: 'Child prompt',
          optimizedPrompt: 'Child response',
          type: 'iterate',
          chainId: 'test-chain',
          version: 2,
          timestamp: Date.now() + 1000,
          modelKey: 'openai',
          templateId: 'template-2',
          previousId: 'parent-record' // References the parent record
        }
      ];

      await historyManager.importData(importData);

      // Verify IDs and relationships are preserved
      const afterImport = await historyManager.getRecords();
      const parentRecord = afterImport.find(r => r.id === 'parent-record');
      const childRecord = afterImport.find(r => r.id === 'child-record');

      expect(parentRecord).toBeDefined();
      expect(childRecord).toBeDefined();
      expect(childRecord?.previousId).toBe('parent-record'); // The relationship should be preserved
      expect(childRecord?.chainId).toBe('test-chain'); // The chain ID should be preserved
    });

    it('should handle records with missing optional fields', async () => {
      const importData: PromptRecord[] = [
        {
          id: 'minimal-record',
          originalPrompt: 'Minimal prompt',
          optimizedPrompt: 'Minimal response',
          type: 'optimize',
          chainId: 'minimal-chain',
          version: 1,
          timestamp: Date.now(),
          modelKey: 'openai',
          templateId: 'template-1'
          // No previousId (since this is the first version)
        }
      ];

      await historyManager.importData(importData);

      const afterImport = await historyManager.getRecords();
      const importedRecord = afterImport.find(r => r.id === 'minimal-record');

      expect(importedRecord).toBeDefined();
      expect(importedRecord?.originalPrompt).toBe('Minimal prompt');
      expect(importedRecord?.chainId).toBe('minimal-chain');
      expect(importedRecord?.previousId).toBeUndefined();
    });

    it('should handle import errors gracefully', async () => {
      const importData: PromptRecord[] = [
        {
          id: 'error-record',
          originalPrompt: 'Error prompt',
          optimizedPrompt: 'Error response',
          type: 'optimize',
          chainId: 'error-chain',
          version: 1,
          timestamp: Date.now(),
          modelKey: 'openai',
          templateId: 'template-1'
        }
      ];

      // Simulate an addRecord error
      vi.spyOn(historyManager, 'addRecord').mockRejectedValue(new Error('Add record error'));

      // Should not throw, just record the failure
      await expect(historyManager.importData(importData)).resolves.not.toThrow();
    });

    it('should clear history before importing', async () => {
      // Add existing records
      const existingRecord: PromptRecord = {
        id: 'existing-record',
        originalPrompt: 'Existing prompt',
        optimizedPrompt: 'Existing response',
        type: 'optimize',
        chainId: 'existing-chain',
        version: 1,
        timestamp: Date.now(),
        modelKey: 'openai',
        templateId: 'template-1'
      };

      await historyManager.addRecord(existingRecord);

      // Verify clearHistory was called
      const clearHistorySpy = vi.spyOn(historyManager, 'clearHistory');

      const importData: PromptRecord[] = [
        {
          id: 'new-record',
          originalPrompt: 'New prompt',
          optimizedPrompt: 'New response',
          type: 'optimize',
          chainId: 'new-chain',
          version: 1,
          timestamp: Date.now(),
          modelKey: 'anthropic',
          templateId: 'template-2'
        }
      ];

      await historyManager.importData(importData);

      expect(clearHistorySpy).toHaveBeenCalledOnce();
    });
  });

  describe('validateData', () => {
    it('should validate correct history data', async () => {
      const validData: PromptRecord[] = [
        {
          id: 'test-record',
          originalPrompt: 'Test prompt',
          optimizedPrompt: 'Test response',
          type: 'optimize',
          chainId: 'test-chain',
          version: 1,
          timestamp: Date.now(),
          modelKey: 'openai',
          templateId: 'template-1'
        }
      ];

      expect(await historyManager.validateData(validData)).toBe(true);
    });

    it('should validate records with optional fields', async () => {
      const validData: PromptRecord[] = [
        {
          id: 'test-record',
          originalPrompt: 'Test prompt',
          optimizedPrompt: 'Test response',
          type: 'iterate',
          chainId: 'test-chain',
          version: 2,
          timestamp: Date.now(),
          modelKey: 'openai',
          templateId: 'template-1',
          previousId: 'previous-record'
        }
      ];

      expect(await historyManager.validateData(validData)).toBe(true);
    });

    it('should reject invalid data formats', async () => {
      // Not an array
      expect(await historyManager.validateData({})).toBe(false);
      expect(await historyManager.validateData('string')).toBe(false);
      expect(await historyManager.validateData(null)).toBe(false);

      // Missing required fields
      expect(await historyManager.validateData([
        {
          originalPrompt: 'Test prompt',
          // Missing id
          optimizedPrompt: 'Test response',
          timestamp: Date.now()
        }
      ])).toBe(false);

      // Wrong field type
      expect(await historyManager.validateData([
        {
          id: 'test-record',
          originalPrompt: 123, // Should be a string
          optimizedPrompt: 'Test response',
          timestamp: Date.now()
        }
      ])).toBe(false);

      // Wrong timestamp type
      expect(await historyManager.validateData([
        {
          id: 'test-record',
          originalPrompt: 'Test prompt',
          optimizedPrompt: 'Test response',
          timestamp: 'invalid-timestamp' // Should be a number
        }
      ])).toBe(false);
    });
  });

  describe('getDataType', () => {
    it('should return correct data type', async () => {
      expect(await historyManager.getDataType()).toBe('history');
    });
  });

  describe('data integrity', () => {
    it('should maintain chain relationships after import', async () => {
      // Create a complete conversation chain
      const importData: PromptRecord[] = [
        {
          id: 'chain-start',
          originalPrompt: 'Initial prompt',
          optimizedPrompt: 'Initial response',
          type: 'optimize',
          chainId: 'conversation-1',
          version: 1,
          timestamp: Date.now(),
          modelKey: 'openai',
          templateId: 'template-1'
        },
        {
          id: 'chain-middle',
          originalPrompt: 'Follow-up prompt',
          optimizedPrompt: 'Follow-up response',
          type: 'iterate',
          chainId: 'conversation-1',
          version: 2,
          timestamp: Date.now() + 1000,
          modelKey: 'openai',
          templateId: 'template-2',
          previousId: 'chain-start'
        },
        {
          id: 'chain-end',
          originalPrompt: 'Final prompt',
          optimizedPrompt: 'Final response',
          type: 'iterate',
          chainId: 'conversation-1',
          version: 3,
          timestamp: Date.now() + 2000,
          modelKey: 'openai',
          templateId: 'template-3',
          previousId: 'chain-middle'
        }
      ];

      await historyManager.importData(importData);

      // Verify chain relationship integrity
      const afterImport = await historyManager.getRecords();
      const startRecord = afterImport.find(r => r.id === 'chain-start');
      const middleRecord = afterImport.find(r => r.id === 'chain-middle');
      const endRecord = afterImport.find(r => r.id === 'chain-end');

      expect(startRecord?.chainId).toBe('conversation-1');
      expect(startRecord?.previousId).toBeUndefined();

      expect(middleRecord?.chainId).toBe('conversation-1');
      expect(middleRecord?.previousId).toBe('chain-start');

      expect(endRecord?.chainId).toBe('conversation-1');
      expect(endRecord?.previousId).toBe('chain-middle');
    });
  });
});
