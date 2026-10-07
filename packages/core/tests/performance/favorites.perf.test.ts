import { describe, it, expect, beforeEach } from 'vitest';
import { FavoriteManager } from '../../src/services/favorite/manager';
import type { IStorageProvider } from '../../src/services/storage/types';

/**
 * Performance regression test
 *
 * Purpose: make sure performance has not degraded noticeably
 * Benchmarks:
 * - Query 1000 favorites: < 100ms
 * - Add a single favorite: < 50ms
 * - Search 1000 favorites: < 200ms
 * - Export 1000 favorites: < 500ms
 */
describe('Performance regression test', () => {
  let manager: FavoriteManager;
  let storage: Map<string, string>;

  // Create an in-memory storage provider
  const createMemoryStorage = (): IStorageProvider => {
    storage = new Map();
    return {
      async getItem(key: string): Promise<string | null> {
        return storage.get(key) || null;
      },
      async setItem(key: string, value: string): Promise<void> {
        storage.set(key, value);
      },
      async removeItem(key: string): Promise<void> {
        storage.delete(key);
      },
      async clearAll(): Promise<void> {
        storage.clear();
      },
      async updateData<T>(key: string, modifier: (currentValue: T | null) => T): Promise<void> {
        const currentStr = storage.get(key);
        const currentValue = currentStr ? JSON.parse(currentStr) : null;
        const updated = modifier(currentValue);
        storage.set(key, JSON.stringify(updated));
      },
      async batchUpdate(operations: Array<{
        key: string;
        operation: 'set' | 'remove';
        value?: string;
      }>): Promise<void> {
        for (const op of operations) {
          if (op.operation === 'set' && op.value) {
            storage.set(op.key, op.value);
          } else if (op.operation === 'remove') {
            storage.delete(op.key);
          }
        }
      }
    };
  };

  beforeEach(async () => {
    manager = new FavoriteManager(createMemoryStorage());
    await manager.initialize();
  });

  it('should be able to add a single favorite in a reasonable time (< 50ms)', async () => {
    const startTime = performance.now();

    await manager.addFavorite({
      title: 'Performance test favorite',
      content: 'This is a favorite used for performance testing',
      tags: ['performance', 'test'],
      functionMode: 'basic',
      optimizationMode: 'system'
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Should finish within 50ms
    expect(duration).toBeLessThan(50);
  });

  it('should be able to query a large number of favorites in a reasonable time (< 100ms for 1000 items)', async () => {
    // 1. Prepare a large amount of test data
    const favorites = Array.from({ length: 1000 }, (_, i) => ({
      title: `Performance test favorite ${i}`,
      content: `This is the content of favorite number ${i}`,
      tags: [`tag${i % 10}`, 'performance test'],
      functionMode: 'basic' as const,
      optimizationMode: 'system' as const
    }));

    // 2. Add in a batch (this operation is not counted in the performance test)
    for (const fav of favorites) {
      await manager.addFavorite(fav);
    }

    // 3. Test the query performance
    const startTime = performance.now();

    const result = await manager.getFavorites();

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 4. Verify the query succeeded
    expect(result.length).toBeGreaterThanOrEqual(1000);

    // 5. Verify the performance
    // Querying 1000 favorites should finish within 100ms
    expect(duration).toBeLessThan(100);
  });

  it('should be able to search a large number of favorites in a reasonable time (< 200ms for 1000 items)', async () => {
    // 1. Prepare the test data
    const favorites = Array.from({ length: 1000 }, (_, i) => ({
      title: `Search test ${i}`,
      content: i % 10 === 0 ? 'Content containing the keyword' : 'Ordinary content',
      tags: ['test'],
      functionMode: 'basic' as const,
      optimizationMode: 'system' as const
    }));

    for (const fav of favorites) {
      await manager.addFavorite(fav);
    }

    // 2. Test the search performance
    const startTime = performance.now();

    const searchResults = await manager.searchFavorites('keyword');

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 3. Verify the search results
    expect(searchResults.length).toBeGreaterThan(0);

    // 4. Verify the performance
    // Searching should finish within 200ms
    expect(duration).toBeLessThan(200);
  });

  it('should be able to export a large number of favorites in a reasonable time (< 500ms for 1000 items)', async () => {
    // 1. Prepare the test data
    const favorites = Array.from({ length: 1000 }, (_, i) => ({
      title: `Export test ${i}`,
      content: `Export test content ${i}`,
      tags: ['export', `tag${i % 5}`],
      functionMode: 'basic' as const,
      optimizationMode: 'system' as const
    }));

    for (const fav of favorites) {
      await manager.addFavorite(fav);
    }

    // 2. Test the export performance
    const startTime = performance.now();

    const exportData = await manager.exportFavorites();

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 3. Verify the exported data
    expect(exportData).toBeTruthy();
    const parsed = JSON.parse(exportData);
    expect(parsed.favorites.length).toBeGreaterThanOrEqual(1000);

    // 4. Verify the performance
    // Exporting should finish within 500ms
    expect(duration).toBeLessThan(500);
  });

  it('should be able to import a large number of favorites in a reasonable time (< 1000ms for 1000 items)', async () => {
    // 1. Prepare the import data
    const importData = {
      favorites: Array.from({ length: 1000 }, (_, i) => ({
        id: `import-${i}`,
        title: `Import test ${i}`,
        content: `Import content ${i}`,
        tags: ['import'],
        functionMode: 'basic',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })),
      categories: [],
      tags: []
    };

    // 2. Test the import performance
    const startTime = performance.now();

    await manager.importFavorites(JSON.stringify(importData));

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 3. Verify the import succeeded
    const favorites = await manager.getFavorites();
    expect(favorites.length).toBeGreaterThanOrEqual(1000);

    // 4. Verify the performance
    // Importing 1000 favorites should finish within 1000ms
    expect(duration).toBeLessThan(1000);
  });

  it('should be able to filter by category in a reasonable time (< 100ms)', async () => {
    // 1. Create the category
    const categoryId = await manager.addCategory({
      name: 'Performance test category',
      description: 'Used for performance testing',
      color: '#FF5722'
    });

    // 2. Add a large number of favorites to that category
    for (let i = 0; i < 500; i++) {
      await manager.addFavorite({
        title: `Category test ${i}`,
        content: `Content ${i}`,
        tags: ['test'],
        category: categoryId,
        functionMode: 'basic',
        optimizationMode: 'system'
      });
    }

    // 3. Test the performance of filtering by category
    const startTime = performance.now();

    const filtered = await manager.getFavorites({ categoryId });

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 4. Verify the filter results
    expect(filtered.length).toBe(500);

    // 5. Verify the performance
    expect(duration).toBeLessThan(100);
  });

  it('should be able to filter by tag in a reasonable time (< 100ms)', async () => {
    // 1. Add a large number of favorites, some with a specific tag
    for (let i = 0; i < 500; i++) {
      await manager.addFavorite({
        title: `Tag test ${i}`,
        content: `Content ${i}`,
        tags: i % 2 === 0 ? ['performance tag', 'test'] : ['test'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });
    }

    // 2. Test the performance of filtering by tag
    const startTime = performance.now();

    const filtered = await manager.getFavorites({ tags: ['performance tag'] });

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 3. Verify the filter results
    expect(filtered.length).toBeGreaterThan(0);

    // 4. Verify the performance
    expect(duration).toBeLessThan(100);
  });

  it('should be able to update a single favorite in a reasonable time (< 50ms)', async () => {
    // 1. Add a favorite
    const favoriteId = await manager.addFavorite({
      title: 'Favorite to update',
      content: 'Original content',
      tags: ['test'],
      functionMode: 'basic',
      optimizationMode: 'system'
    });

    // 2. Test the update performance
    const startTime = performance.now();

    await manager.updateFavorite(favoriteId, {
      title: 'Updated title',
      content: 'Updated content'
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 3. Verify the update succeeded
    const updated = await manager.getFavorite(favoriteId);
    expect(updated!.title).toBe('Updated title');

    // 4. Verify the performance
    expect(duration).toBeLessThan(50);
  });

  it('should be able to delete a single favorite in a reasonable time (< 50ms)', async () => {
    // 1. Add a favorite
    const favoriteId = await manager.addFavorite({
      title: 'Favorite to delete',
      content: 'Content',
      tags: ['test'],
      functionMode: 'basic',
      optimizationMode: 'system'
    });

    // 2. Test the delete performance
    const startTime = performance.now();

    await manager.deleteFavorite(favoriteId);

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 3. Verify the deletion succeeded (getFavorite throws an error when it cannot find the item)
    const allFavorites = await manager.getFavorites();
    expect(allFavorites.find(f => f.id === favoriteId)).toBeUndefined();

    // 4. Verify the performance
    expect(duration).toBeLessThan(50);
  });

  it('should be able to get tag statistics in a reasonable time (< 100ms for 1000 items)', async () => {
    // 1. Add a large number of favorites, containing various tags
    for (let i = 0; i < 1000; i++) {
      await manager.addFavorite({
        title: `Tag statistics test ${i}`,
        content: `Content ${i}`,
        tags: [`tag${i % 20}`, 'common tag'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });
    }

    // 2. Test the tag statistics performance
    const startTime = performance.now();

    const tagStats = await manager.getAllTags();

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 3. Verify the statistics results
    expect(tagStats.length).toBeGreaterThan(0);

    // 4. Verify the performance
    expect(duration).toBeLessThan(100);
  });
});

/**
 * Memory usage test
 * Make sure there are no obvious memory leaks
 */
describe('Memory usage test', () => {
  let manager: FavoriteManager;
  let storage: Map<string, string>;

  const createMemoryStorage = (): IStorageProvider => {
    storage = new Map();
    return {
      async getItem(key: string): Promise<string | null> {
        return storage.get(key) || null;
      },
      async setItem(key: string, value: string): Promise<void> {
        storage.set(key, value);
      },
      async removeItem(key: string): Promise<void> {
        storage.delete(key);
      },
      async clearAll(): Promise<void> {
        storage.clear();
      },
      async updateData<T>(key: string, modifier: (currentValue: T | null) => T): Promise<void> {
        const currentStr = storage.get(key);
        const currentValue = currentStr ? JSON.parse(currentStr) : null;
        const updated = modifier(currentValue);
        storage.set(key, JSON.stringify(updated));
      },
      async batchUpdate(operations: Array<{
        key: string;
        operation: 'set' | 'remove';
        value?: string;
      }>): Promise<void> {
        for (const op of operations) {
          if (op.operation === 'set' && op.value) {
            storage.set(op.key, op.value);
          } else if (op.operation === 'remove') {
            storage.delete(op.key);
          }
        }
      }
    };
  };

  beforeEach(async () => {
    manager = new FavoriteManager(createMemoryStorage());
    await manager.initialize();
  });

  it('repeated adding and deleting should not cause memory leaks', async () => {
    // 1. Record the initial state
    const initialSize = storage.size;

    // 2. Add and delete repeatedly
    for (let i = 0; i < 100; i++) {
      const id = await manager.addFavorite({
        title: `Temporary favorite ${i}`,
        content: 'Temporary content',
        tags: ['temporary'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.deleteFavorite(id);
    }

    // 3. Verify the storage size has not grown significantly
    const finalSize = storage.size;

    // The storage size should be basically the same or slightly larger (there may be caching)
    expect(finalSize - initialSize).toBeLessThan(5);
  });

  it('storage should be reasonable after a large number of data operations', async () => {
    // 1. Add 1000 favorites
    for (let i = 0; i < 1000; i++) {
      await manager.addFavorite({
        title: `Favorite ${i}`,
        content: `Content ${i}`,
        tags: ['test'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });
    }

    // 2. Export the data and check the size
    const exported = await manager.exportFavorites();
    const exportedSize = exported.length;

    // 3. The stored data should not bloat excessively
    // The JSON string of 1000 simple favorites should be within a reasonable range (such as < 1MB)
    expect(exportedSize).toBeLessThan(1024 * 1024); // < 1MB
  });
});
