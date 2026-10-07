import { describe, it, expect, beforeEach } from 'vitest';
import { FavoriteManager } from '../../src/services/favorite/manager';
import type { IStorageProvider } from '../../src/services/storage/types';

/**
 * Data compatibility regression test
 *
 * Purpose: make sure favorite data from old versions can be imported and used normally
 * Scenarios:
 * 1. Old data lacks the functionMode field
 * 2. Old data uses the old metadata structure
 * 3. Old data lacks the newly added optional fields
 */
describe('Data compatibility regression test', () => {
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

  it('should be able to import old data lacking functionMode', async () => {
    // 1. Create old-format favorite data (without functionMode)
    const oldData = {
      favorites: [
        {
          id: 'old-fav-001',
          title: 'Legacy favorite 1',
          content: 'This is an old favorite without functionMode',
          tags: ['test', 'legacy data'],
          category: undefined,
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date('2024-01-01').toISOString()
          // Note: there is no functionMode field
        },
        {
          id: 'old-fav-002',
          title: 'Legacy favorite 2',
          content: 'Another old favorite',
          tags: ['compatibility'],
          category: undefined,
          createdAt: new Date('2024-01-02').toISOString(),
          updatedAt: new Date('2024-01-02').toISOString()
        }
      ],
      categories: [],
      tags: []
    };

    // 2. Import the old data
    const result = await manager.importFavorites(JSON.stringify(oldData));

    // 3. Verify the import succeeded
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors.length).toBe(0);

    // 4. Verify the data was imported correctly and the default functionMode was set
    const allFavorites = await manager.getFavorites();
    expect(allFavorites.length).toBe(2);

    // Look up by title, because the IDs are regenerated
    const fav1 = allFavorites.find(f => f.title === 'Legacy favorite 1');
    expect(fav1).toBeDefined();
    expect(fav1!.functionMode).toBe('basic'); // Should have a default value
    expect(fav1!.content).toBe('This is an old favorite without functionMode');
    expect(fav1!.tags).toEqual(['test', 'legacy data']);

    const fav2 = allFavorites.find(f => f.title === 'Legacy favorite 2');
    expect(fav2).toBeDefined();
    expect(fav2!.functionMode).toBe('basic'); // Should have a default value
  });

  it('should be able to import data using the old metadata structure', async () => {
    // 1. Create data using the old metadata structure
    const oldData = {
      favorites: [
        {
          id: 'old-meta-001',
          title: 'Old metadata structure',
          content: 'Optimized content',
          tags: ['test'],
          category: undefined,
          // Old structure: directly at the top level
          originalContent: 'Original content',
          sourceHistoryId: 'hist-001',
          functionMode: 'basic', // Has functionMode
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      categories: [],
      tags: []
    };

    // 2. Import
    const result = await manager.importFavorites(JSON.stringify(oldData));

    // 3. Verify the import succeeded
    expect(result.imported).toBe(1);

    // 4. Verify the data was imported correctly
    const favorites = await manager.getFavorites();
    expect(favorites.length).toBeGreaterThan(0);

    const imported = favorites.find(f => f.title === 'Old metadata structure');
    expect(imported).toBeDefined();
    expect(imported!.functionMode).toBe('basic');
    // The metadata field may or may not exist, depending on whether the import logic keeps it
  });

  it('should be able to query and search migrated old data normally', async () => {
    // 1. Import the old data
    const oldData = {
      favorites: [
        {
          id: 'search-test-001',
          title: 'Searchable legacy favorite',
          content: 'This is content that can be found by search',
          tags: ['search', 'test'],
          category: undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      categories: [],
      tags: []
    };

    await manager.importFavorites(JSON.stringify(oldData));

    // 2. Test the query feature
    const allFavorites = await manager.getFavorites();
    expect(allFavorites.length).toBeGreaterThan(0);

    // 3. Test the search feature
    const searchResults = await manager.searchFavorites('Searchable');
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0].title).toContain('Searchable');

    // 4. Test filtering by tag
    const tagResults = await manager.getFavorites({ tags: ['search'] });
    expect(tagResults.length).toBeGreaterThan(0);
  });

  it('should be able to update migrated old data', async () => {
    // 1. Import the old data
    const oldData = {
      favorites: [
        {
          title: 'Updatable legacy favorite',
          content: 'Original content',
          tags: ['test'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      categories: [],
      tags: []
    };

    await manager.importFavorites(JSON.stringify(oldData));

    // 2. Get the ID of the imported favorite
    const favorites = await manager.getFavorites();
    const imported = favorites.find(f => f.title === 'Updatable legacy favorite');
    expect(imported).toBeDefined();

    // 3. Update the data
    await manager.updateFavorite(imported!.id, {
      title: 'Updated title',
      content: 'Updated content'
    });

    // 4. Verify the update succeeded
    const updated = await manager.getFavorite(imported!.id);
    expect(updated).toBeDefined();
    expect(updated!.title).toBe('Updated title');
    expect(updated!.content).toBe('Updated content');
    expect(updated!.functionMode).toBe('basic'); // functionMode should be kept
  });

  it('should be able to delete migrated old data', async () => {
    // 1. Import the old data
    const oldData = {
      favorites: [
        {
          title: 'Deletable legacy favorite',
          content: 'This favorite will be deleted',
          tags: ['test'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      categories: [],
      tags: []
    };

    await manager.importFavorites(JSON.stringify(oldData));

    // 2. Get the imported favorite and verify it exists
    let favorites = await manager.getFavorites();
    const imported = favorites.find(f => f.title === 'Deletable legacy favorite');
    expect(imported).toBeDefined();

    // 3. Delete the data
    await manager.deleteFavorite(imported!.id);

    // 4. Verify the deletion succeeded
    favorites = await manager.getFavorites();
    expect(favorites.find(f => f.title === 'Deletable legacy favorite')).toBeUndefined();
  });

  it('should be able to export migrated data while keeping integrity', async () => {
    // 1. Import the old data
    const oldData = {
      favorites: [
        {
          title: 'Export test favorite',
          content: 'This data will be exported',
          tags: ['export', 'test'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      categories: [],
      tags: ['export', 'test']
    };

    await manager.importFavorites(JSON.stringify(oldData));

    // 2. Export the data
    const exported = await manager.exportFavorites();
    const exportedData = JSON.parse(exported);

    // 3. Verify the exported data contains the necessary fields
    expect(exportedData.favorites).toBeDefined();
    expect(exportedData.favorites.length).toBeGreaterThan(0);

    const exportedFav = exportedData.favorites.find((f: any) => f.title === 'Export test favorite');
    expect(exportedFav).toBeDefined();
    expect(exportedFav.functionMode).toBe('basic'); // Should have the default functionMode
    expect(exportedFav.title).toBe('Export test favorite');
    expect(exportedFav.tags).toEqual(['export', 'test']);
  });

  it('should be able to handle data in mixed old and new formats', async () => {
    // 1. Create mixed data (some with functionMode, some without)
    const mixedData = {
      favorites: [
        {
          title: 'Old format favorite',
          content: 'No functionMode',
          tags: ['old'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
          // No functionMode
        },
        {
          title: 'New format favorite',
          content: 'Has functionMode',
          tags: ['new'],
          functionMode: 'context',
          optimizationMode: 'user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      categories: [],
      tags: []
    };

    // 2. Import the mixed data
    const result = await manager.importFavorites(JSON.stringify(mixedData));

    // 3. Verify both were imported successfully
    expect(result.imported).toBe(2);

    // 4. Verify both kinds of data are handled correctly
    const favorites = await manager.getFavorites();

    const oldFav = favorites.find(f => f.title === 'Old format favorite');
    expect(oldFav).toBeDefined();
    expect(oldFav!.functionMode).toBe('basic'); // Old data should have the default value

    const newFav = favorites.find(f => f.title === 'New format favorite');
    expect(newFav).toBeDefined();
    expect(newFav!.functionMode).toBe('context'); // New data keeps its original value
    expect(newFav!.optimizationMode).toBe('user');
  });
});
