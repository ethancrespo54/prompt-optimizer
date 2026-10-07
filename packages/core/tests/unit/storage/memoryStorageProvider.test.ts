import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider';

describe('MemoryStorageProvider', () => {
  let storage: MemoryStorageProvider;

  beforeEach(() => {
    storage = new MemoryStorageProvider();
  });

  describe('Basic storage operations', () => {
    it('should be able to set and get data', async () => {
      await storage.setItem('test-key', 'test-value');
      const value = await storage.getItem('test-key');
      expect(value).toBe('test-value');
    });

    it('should return null when the key does not exist', async () => {
      const value = await storage.getItem('non-existent-key');
      expect(value).toBeNull();
    });

    it('should be able to delete data', async () => {
      await storage.setItem('test-key', 'test-value');
      await storage.removeItem('test-key');
      const value = await storage.getItem('test-key');
      expect(value).toBeNull();
    });

    it('should be able to clear all data', async () => {
      await storage.setItem('key1', 'value1');
      await storage.setItem('key2', 'value2');
      await storage.clearAll();
      
      const value1 = await storage.getItem('key1');
      const value2 = await storage.getItem('key2');
      expect(value1).toBeNull();
      expect(value2).toBeNull();
    });
  });

  describe('Advanced operations', () => {
    it('should be able to update data', async () => {
      await storage.setItem('counter', '5');
      
      await storage.updateData<number>('counter', (current) => {
        return (current || 0) + 1;
      });
      
      const result = await storage.getItem('counter');
      expect(JSON.parse(result!)).toBe(6);
    });

    it('should be able to handle updates for a non-existent key', async () => {
      await storage.updateData<number>('new-counter', (current) => {
        return (current || 0) + 10;
      });
      
      const result = await storage.getItem('new-counter');
      expect(JSON.parse(result!)).toBe(10);
    });

    it('should be able to perform batch operations', async () => {
      await storage.batchUpdate([
        { key: 'key1', operation: 'set', value: 'value1' },
        { key: 'key2', operation: 'set', value: 'value2' },
        { key: 'key3', operation: 'set', value: 'value3' }
      ]);

      const value1 = await storage.getItem('key1');
      const value2 = await storage.getItem('key2');
      const value3 = await storage.getItem('key3');
      
      expect(value1).toBe('value1');
      expect(value2).toBe('value2');
      expect(value3).toBe('value3');
    });

    it('should be able to delete in batch', async () => {
      await storage.setItem('key1', 'value1');
      await storage.setItem('key2', 'value2');
      
      await storage.batchUpdate([
        { key: 'key1', operation: 'remove' },
        { key: 'key2', operation: 'remove' }
      ]);

      const value1 = await storage.getItem('key1');
      const value2 = await storage.getItem('key2');
      
      expect(value1).toBeNull();
      expect(value2).toBeNull();
    });
  });

  describe('Utility methods', () => {
    it('should return the correct storage capabilities', () => {
      const capabilities = storage.getCapabilities();
      expect(capabilities).toEqual({
        supportsAtomic: true,
        supportsBatch: true,
        maxStorageSize: undefined
      });
    });

    it('should report the storage size correctly', async () => {
      expect(storage.size).toBe(0);
      
      await storage.setItem('key1', 'value1');
      expect(storage.size).toBe(1);
      
      await storage.setItem('key2', 'value2');
      expect(storage.size).toBe(2);
      
      await storage.removeItem('key1');
      expect(storage.size).toBe(1);
    });

    it('should check whether a key exists correctly', async () => {
      expect(storage.has('test-key')).toBe(false);
      
      await storage.setItem('test-key', 'test-value');
      expect(storage.has('test-key')).toBe(true);
      
      await storage.removeItem('test-key');
      expect(storage.has('test-key')).toBe(false);
    });

    it('should return all keys', async () => {
      await storage.setItem('key1', 'value1');
      await storage.setItem('key2', 'value2');
      await storage.setItem('key3', 'value3');
      
      const keys = storage.getAllKeys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });
  });

  describe('Data serialization', () => {
    it('should handle complex objects correctly', async () => {
      const complexObject = {
        name: 'test',
        nested: {
          value: 42,
          array: [1, 2, 3]
        }
      };
      
      await storage.setItem('complex', JSON.stringify(complexObject));
      const result = await storage.getItem('complex');
      const parsed = JSON.parse(result!);
      
      expect(parsed).toEqual(complexObject);
    });

    it('should handle JSON data correctly via updateData', async () => {
      const initialData = { count: 0, items: [] };
      await storage.setItem('data', JSON.stringify(initialData));
      
      await storage.updateData<{ count: number; items: string[] }>('data', (current) => {
        return {
          count: (current?.count || 0) + 1,
          items: [...(current?.items || []), 'new-item']
        };
      });
      
      const result = await storage.getItem('data');
      const parsed = JSON.parse(result!);
      
      expect(parsed.count).toBe(1);
      expect(parsed.items).toEqual(['new-item']);
    });
  });
}); 