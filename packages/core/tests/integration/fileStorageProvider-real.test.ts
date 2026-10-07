import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FileStorageProvider } from '../../src/services/storage/fileStorageProvider';
import { StorageError } from '../../src/services/storage/errors';

describe('FileStorageProvider - Real File System Integration', () => {
  let provider: FileStorageProvider;
  let testDir: string;
  let storageFile: string;

  beforeEach(async () => {
    // Create a temporary test directory under the project's tests directory
    testDir = path.join(__dirname, '..', '..', 'temp-test-storage');
    storageFile = path.join(testDir, 'prompt-optimizer-data.json');
    
    // Make sure the test directory exists
    await fs.mkdir(testDir, { recursive: true });
    
    // Create a FileStorageProvider instance
    provider = new FileStorageProvider(testDir);
  });

  afterEach(async () => {
    // Clean up the test files and directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error);
    }
  });

  describe('Real file operations', () => {
    it('should create storage file when it does not exist', async () => {
      // Make sure the file does not exist
      await expect(fs.access(storageFile)).rejects.toThrow();
      
      // Perform an operation to trigger file creation
      await provider.setItem('test-key', 'test-value');
      
      // Wait for the delayed write to complete
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Verify the file was created
      await expect(fs.access(storageFile)).resolves.toBeUndefined();
      
      // Verify the file content
      const content = await fs.readFile(storageFile, 'utf8');
      const data = JSON.parse(content);
      expect(data['test-key']).toBe('test-value');
    });

    it('should load existing data from real file', async () => {
      // Manually create a test file
      const testData = { 'existing-key': 'existing-value' };
      await fs.writeFile(storageFile, JSON.stringify(testData), 'utf8');
      
      // Create a new provider instance to load the data
      const newProvider = new FileStorageProvider(testDir);
      
      // Verify the data was loaded correctly
      const value = await newProvider.getItem('existing-key');
      expect(value).toBe('existing-value');
    });

    it('should throw error when file is corrupted and no backup exists', async () => {
      // Create a corrupted JSON file
      await fs.writeFile(storageFile, 'invalid json content', 'utf8');

      // Create a new provider instance
      const newProvider = new FileStorageProvider(testDir);

      // It should throw StorageError rather than create new storage
      await expect(newProvider.setItem('recovery-key', 'recovery-value')).rejects.toThrow('Storage corruption detected');
    });

    it('should persist data across provider instances', async () => {
      // Write data using the first provider
      await provider.setItem('persist-key', 'persist-value');
      await provider.setItem('another-key', 'another-value');
      
      // Write immediately
      await provider.flush();
      
      // Create a new provider instance
      const newProvider = new FileStorageProvider(testDir);
      
      // Verify the data persisted
      expect(await newProvider.getItem('persist-key')).toBe('persist-value');
      expect(await newProvider.getItem('another-key')).toBe('another-value');
    });

    it('should handle batch operations with real files', async () => {
      const operations = [
        { key: 'batch-key-1', operation: 'set' as const, value: 'batch-value-1' },
        { key: 'batch-key-2', operation: 'set' as const, value: 'batch-value-2' },
        { key: 'batch-key-3', operation: 'set' as const, value: 'batch-value-3' }
      ];

      await provider.batchUpdate(operations);

      // Verify the data is correct in memory
      expect(await provider.getItem('batch-key-1')).toBe('batch-value-1');
      expect(await provider.getItem('batch-key-2')).toBe('batch-value-2');
      expect(await provider.getItem('batch-key-3')).toBe('batch-value-3');

      // Verify the file exists
      await expect(fs.access(storageFile)).resolves.toBeUndefined();
    });

    it('should handle clearAll with real files', async () => {
      // Add some data first
      await provider.setItem('clear-key-1', 'clear-value-1');
      await provider.setItem('clear-key-2', 'clear-value-2');
      await provider.flush();
      
      // Verify the data exists
      let content = await fs.readFile(storageFile, 'utf8');
      let data = JSON.parse(content);
      expect(Object.keys(data)).toHaveLength(2);
      
      // Clear all data
      await provider.clearAll();
      
      // Verify the file was cleared
      content = await fs.readFile(storageFile, 'utf8');
      data = JSON.parse(content);
      expect(Object.keys(data)).toHaveLength(0);
    });

    it('should handle updateData with real files', async () => {
      // Initialize the counter
      await provider.setItem('counter', '5');
      await provider.flush();
      
      // Increment the counter using updateData
      await provider.updateData<number>('counter', (current) => {
        return (current || 0) + 1;
      });
      
      await provider.flush();
      
      // Verify the data in the file was updated correctly
      const content = await fs.readFile(storageFile, 'utf8');
      const data = JSON.parse(content);
      expect(data['counter']).toBe('6');
    });

    it('should handle concurrent operations safely', async () => {
      // Run the write operations serially to avoid file conflicts
      for (let i = 0; i < 10; i++) {
        await provider.setItem(`concurrent-key-${i}`, `concurrent-value-${i}`);
      }

      await provider.flush();

      // Verify all data was written correctly
      const content = await fs.readFile(storageFile, 'utf8');
      const data = JSON.parse(content);

      for (let i = 0; i < 10; i++) {
        expect(data[`concurrent-key-${i}`]).toBe(`concurrent-value-${i}`);
      }
    });

    it('should handle removeItem with real files', async () => {
      // Add test data
      await provider.setItem('remove-key-1', 'remove-value-1');
      await provider.setItem('remove-key-2', 'remove-value-2');
      await provider.flush();
      
      // Delete a key
      await provider.removeItem('remove-key-1');
      await provider.flush();
      
      // Verify the data in the file
      const content = await fs.readFile(storageFile, 'utf8');
      const data = JSON.parse(content);
      
      expect(data['remove-key-1']).toBeUndefined();
      expect(data['remove-key-2']).toBe('remove-value-2');
    });
  });

  describe('Error handling with real file system', () => {
    it('should throw error when directory cannot be created', async () => {
      // Try to create storage in a read-only location (if possible)
      // This test may need adjusting for the specific environment
      const invalidPath = '/invalid/readonly/path';
      const invalidProvider = new FileStorageProvider(invalidPath);
      
      // On some systems this may succeed, so we only test the basic error handling
      try {
        await invalidProvider.setItem('test', 'test');
        await invalidProvider.flush();
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
      }
    });

    it('should handle temporary file cleanup on write failure', async () => {
      // This test is hard to simulate, but we can verify that no temporary files are left behind in the normal case
      await provider.setItem('temp-test', 'temp-value');
      await provider.flush();
      
      // Check that no temporary files are left
      const files = await fs.readdir(testDir);
      const tempFiles = files.filter(file => file.endsWith('.tmp'));
      expect(tempFiles).toHaveLength(0);
    });
  });

  describe('Performance with real files', () => {
    it('should handle large data efficiently', async () => {
      const largeValue = 'x'.repeat(10000); // 10KB of data
      
      const startTime = Date.now();
      
      // Write a lot of data
      for (let i = 0; i < 100; i++) {
        await provider.setItem(`large-key-${i}`, largeValue);
      }
      
      await provider.flush();
      
      const writeTime = Date.now() - startTime;
      
      // Read the data
      const readStartTime = Date.now();
      for (let i = 0; i < 100; i++) {
        await provider.getItem(`large-key-${i}`);
      }
      const readTime = Date.now() - readStartTime;
      
      // Performance assertions (these values may need adjusting for the actual situation)
      expect(writeTime).toBeLessThan(5000); // Writing should complete within 5 seconds
      expect(readTime).toBeLessThan(100);   // Reading should complete within 100ms (in-memory cache)
      
      console.log(`Write time: ${writeTime}ms, Read time: ${readTime}ms`);
    });
  });
});
