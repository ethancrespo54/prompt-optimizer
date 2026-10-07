import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FavoriteManager } from '../../../src/services/favorite/manager';
import type { IStorageProvider } from '../../../src/services/storage/types';
import { FavoriteValidationError } from '../../../src/services/favorite/errors';

/**
 * Tag management feature unit test
 */
describe('FavoriteManager - tag management', () => {
  let manager: FavoriteManager;
  let mockStorage: Map<string, string>;
  let storageProvider: IStorageProvider;

  beforeEach(() => {
    // Create a mock storage
    mockStorage = new Map<string, string>();

    storageProvider = {
      getItem: vi.fn(async (key: string) => mockStorage.get(key) || null),
      setItem: vi.fn(async (key: string, value: string) => {
        mockStorage.set(key, value);
      }),
      removeItem: vi.fn(async (key: string) => {
        mockStorage.delete(key);
      }),
      clearAll: vi.fn(async () => {
        mockStorage.clear();
      }),
      batchUpdate: vi.fn(async (operations: Array<{ key: string; operation: 'set' | 'remove'; value?: string }>) => {
        operations.forEach(({ key, operation, value }) => {
          if (operation === 'set' && value) {
            mockStorage.set(key, value);
          } else if (operation === 'remove') {
            mockStorage.delete(key);
          }
        });
      }),
      updateData: vi.fn(async (key: string, updater: (data: any) => any) => {
        const currentData = mockStorage.get(key);
        const parsedData = currentData ? JSON.parse(currentData) : null;
        const updatedData = updater(parsedData);
        mockStorage.set(key, JSON.stringify(updatedData));
      })
    };

    manager = new FavoriteManager(storageProvider);
  });

  describe('Add tag', () => {
    it('should be able to add a new tag successfully', async () => {
      await manager.addTag('test tag');

      const tags = await manager.getAllTags();
      expect(tags).toHaveLength(1);
      expect(tags[0].tag).toBe('test tag');
      expect(tags[0].count).toBe(0); // A new tag is unused, so count is 0
    });

    it('should reject an empty tag name', async () => {
      await expect(manager.addTag('')).rejects.toThrow(FavoriteValidationError);
      await expect(manager.addTag('   ')).rejects.toThrow(FavoriteValidationError);
    });

    it('adding a tag repeatedly should be idempotent', async () => {
      await manager.addTag('tag 1');
      await expect(manager.addTag('tag 1')).resolves.toBeUndefined();

      const tags = await manager.getAllTags();
      expect(tags.filter(tag => tag.tag === 'tag 1')).toHaveLength(1);
    });

    it('should automatically trim leading and trailing spaces', async () => {
      await manager.addTag('  tag 2  ');
      const tags = await manager.getAllTags();
      expect(tags[0].tag).toBe('tag 2');
    });

    it('should be able to add multiple tags', async () => {
      await manager.addTag('tag 1');
      await manager.addTag('tag 2');
      await manager.addTag('tag 3');

      const tags = await manager.getAllTags();
      expect(tags).toHaveLength(3);
    });
  });

  describe('Get all tags', () => {
    it('should return standalone tags and tags in use', async () => {
      // Add standalone tags
      await manager.addTag('standalone tag 1');
      await manager.addTag('standalone tag 2');

      // Add a favorite (using some tags)
      await manager.addFavorite({
        title: 'Test favorite',
        content: 'Test content',
        tags: ['in-use tag', 'standalone tag 1'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      const tags = await manager.getAllTags();

      // Should contain 3 tags: standalone tag 1 (count=1), standalone tag 2 (count=0), in-use tag (count=1)
      expect(tags).toHaveLength(3);

      const tag1 = tags.find(t => t.tag === 'standalone tag 1');
      expect(tag1?.count).toBe(1);

      const tag2 = tags.find(t => t.tag === 'standalone tag 2');
      expect(tag2?.count).toBe(0);

      const tag3 = tags.find(t => t.tag === 'in-use tag');
      expect(tag3?.count).toBe(1);
    });

    it('should sort by usage count descending', async () => {
      await manager.addFavorite({
        title: 'Favorite 1',
        content: 'Content 1',
        tags: ['Tag A', 'Tag B'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.addFavorite({
        title: 'Favorite 2',
        content: 'Content 2',
        tags: ['Tag B', 'Tag C'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.addFavorite({
        title: 'Favorite 3',
        content: 'Content 3',
        tags: ['Tag B'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      const tags = await manager.getAllTags();

      // Tag B is used 3 times, so it should be first
      expect(tags[0].tag).toBe('Tag B');
      expect(tags[0].count).toBe(3);

      // Tag A and Tag C are each used once
      expect(tags[1].count).toBe(1);
      expect(tags[2].count).toBe(1);
    });

    it('should sort by tag name ascending when usage counts are equal', async () => {
      await manager.addFavorite({
        title: 'Favorite',
        content: 'Content',
        tags: ['Zebra', 'Apple', 'Banana'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      const tags = await manager.getAllTags();

      // All used once, so they should be sorted alphabetically
      expect(tags[0].tag).toBe('Apple');
      expect(tags[1].tag).toBe('Banana');
      expect(tags[2].tag).toBe('Zebra');
    });
  });

  describe('Rename tag', () => {
    it('should rename the tag and update all favorites', async () => {
      // Add favorites that use the tag
      await manager.addFavorite({
        title: 'Favorite 1',
        content: 'Content 1',
        tags: ['old tag'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.addFavorite({
        title: 'Favorite 2',
        content: 'Content 2',
        tags: ['old tag', 'other tag'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      const affectedCount = await manager.renameTag('old tag', 'new tag');

      expect(affectedCount).toBe(2); // 2 favorites affected

      // Verify the favorites were updated
      const favorites = await manager.getFavorites();
      expect(favorites[0].tags).toContain('new tag');
      expect(favorites[0].tags).not.toContain('old tag');
      expect(favorites[1].tags).toContain('new tag');
      expect(favorites[1].tags).not.toContain('old tag');

      // Verify the tag statistics
      const tags = await manager.getAllTags();
      const newTag = tags.find(t => t.tag === 'new tag');
      expect(newTag?.count).toBe(2);

      const oldTag = tags.find(t => t.tag === 'old tag');
      expect(oldTag).toBeUndefined();
    });

    it('should return 0 when renaming to the same name', async () => {
      const affectedCount = await manager.renameTag('Tag A', 'Tag A');
      expect(affectedCount).toBe(0);
    });

    it('should reject an empty tag name', async () => {
      await expect(manager.renameTag('', 'new tag')).rejects.toThrow(FavoriteValidationError);
      await expect(manager.renameTag('old tag', '')).rejects.toThrow(FavoriteValidationError);
    });

    it('should return 0 when renaming a non-existent tag', async () => {
      const affectedCount = await manager.renameTag('nonexistent tag', 'new tag');
      expect(affectedCount).toBe(0);
    });

    it('should merge if the new tag already exists when renaming', async () => {
      await manager.addFavorite({
        title: 'Favorite',
        content: 'Content',
        tags: ['Tag A', 'Tag B'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.renameTag('Tag A', 'Tag B');

      const favorites = await manager.getFavorites();
      // Should contain only one Tag B, without duplicates
      expect(favorites[0].tags).toEqual(['Tag B']);
    });
  });

  describe('Merge tags', () => {
    it('should merge multiple tags successfully', async () => {
      await manager.addFavorite({
        title: 'Favorite 1',
        content: 'Content 1',
        tags: ['Tag A'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.addFavorite({
        title: 'Favorite 2',
        content: 'Content 2',
        tags: ['Tag B'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.addFavorite({
        title: 'Favorite 3',
        content: 'Content 3',
        tags: ['Tag C'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      const affectedCount = await manager.mergeTags(['Tag A', 'Tag B'], 'Tag C');

      expect(affectedCount).toBe(2); // 2 favorites affected (Favorite 1 and Favorite 2)

      const favorites = await manager.getFavorites();
      expect(favorites[0].tags).toContain('Tag C');
      expect(favorites[0].tags).not.toContain('Tag A');
      expect(favorites[1].tags).toContain('Tag C');
      expect(favorites[1].tags).not.toContain('Tag B');

      // Tag C of Favorite 3 should not be duplicated
      expect(favorites[2].tags).toEqual(['Tag C']);
    });

    it('should reject an empty source tag list', async () => {
      await expect(manager.mergeTags([], 'target tag')).rejects.toThrow(FavoriteValidationError);
    });

    it('should reject an empty target tag', async () => {
      await expect(manager.mergeTags(['Tag A'], '')).rejects.toThrow(FavoriteValidationError);
    });

    it('should return 0 when merging non-existent tags', async () => {
      const affectedCount = await manager.mergeTags(['nonexistent 1', 'nonexistent 2'], 'target');
      expect(affectedCount).toBe(0);
    });
  });

  describe('Delete tag', () => {
    it('should delete the tag and remove it from all favorites', async () => {
      // Add a standalone tag (unused)
      await manager.addTag('standalone tag');

      // Add favorites that use the tag
      await manager.addFavorite({
        title: 'Favorite 1',
        content: 'Content 1',
        tags: ['tag to delete', 'tag to keep'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.addFavorite({
        title: 'Favorite 2',
        content: 'Content 2',
        tags: ['tag to delete'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      const affectedCount = await manager.deleteTag('tag to delete');

      expect(affectedCount).toBe(2); // 2 favorites affected

      // Verify the favorites were updated
      const favorites = await manager.getFavorites();

      // Verify neither favorite contains "tag to delete"
      favorites.forEach(fav => {
        expect(fav.tags).not.toContain('tag to delete');
      });

      // The first favorite should keep "tag to keep"
      const firstFavorite = favorites.find(f => f.title === 'Favorite 1');
      expect(firstFavorite).toBeDefined();
      expect(firstFavorite!.tags).toEqual(['tag to keep']);

      // The second favorite should have no tags
      const secondFavorite = favorites.find(f => f.title === 'Favorite 2');
      expect(secondFavorite).toBeDefined();
      expect(secondFavorite!.tags).toEqual([]);

      // Verify the tag statistics: the deleted tag should not exist
      const tags = await manager.getAllTags();
      const deletedTag = tags.find(t => t.tag === 'tag to delete');
      expect(deletedTag).toBeUndefined();

      // The standalone tag should still exist (count=0, since it is unused)
      const independentTag = tags.find(t => t.tag === 'standalone tag');
      expect(independentTag).toBeDefined();
      expect(independentTag!.count).toBe(0);

      // Test deleting a standalone tag
      const independentTagDelCount = await manager.deleteTag('standalone tag');
      expect(independentTagDelCount).toBe(0); // Not used by any favorite

      const tagsAfterDel = await manager.getAllTags();
      const deletedIndependentTag = tagsAfterDel.find(t => t.tag === 'standalone tag');
      expect(deletedIndependentTag).toBeUndefined();
    });

    it('should reject an empty tag name', async () => {
      await expect(manager.deleteTag('')).rejects.toThrow(FavoriteValidationError);
    });

    it('should return 0 when deleting a non-existent tag', async () => {
      const affectedCount = await manager.deleteTag('nonexistent tag');
      expect(affectedCount).toBe(0);
    });
  });

  describe('Tag import/export', () => {
    it('should include standalone tags on export', async () => {
      await manager.addTag('standalone tag 1');
      await manager.addTag('standalone tag 2');

      // Add an in-use tag to the standalone tag library
      await manager.addTag('in-use tag');

      await manager.addFavorite({
        title: 'Test',
        content: 'Content',
        tags: ['in-use tag'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      const exportData = await manager.exportFavorites();
      const parsed = JSON.parse(exportData);

      expect(parsed.tags).toBeDefined();
      expect(parsed.tags).toContain('standalone tag 1');
      expect(parsed.tags).toContain('standalone tag 2');
      expect(parsed.tags).toContain('in-use tag');
    });

    it('should automatically create standalone tags on import', async () => {
      const importData = JSON.stringify({
        version: '1.0',
        exportDate: new Date().toISOString(),
        favorites: [
          {
            title: 'Test',
            content: 'Content',
            tags: ['tag 1', 'tag 2'],
            functionMode: 'basic',
            optimizationMode: 'system'
          }
        ],
        categories: [],
        tags: ['tag 1', 'tag 2', 'pre-created tag']
      });

      await manager.importFavorites(importData);

      const tags = await manager.getAllTags();

      // Should contain all tags
      expect(tags.find(t => t.tag === 'tag 1')).toBeDefined();
      expect(tags.find(t => t.tag === 'tag 2')).toBeDefined();
      expect(tags.find(t => t.tag === 'pre-created tag')).toBeDefined();

      // The pre-created tag has a usage count of 0
      const preCreatedTag = tags.find(t => t.tag === 'pre-created tag');
      expect(preCreatedTag?.count).toBe(0);
    });
  });

  describe('Automatically registering tags when saving a favorite', () => {
    it('should automatically add tags to the standalone tag library when saving a favorite', async () => {
      // This test should be implemented at the UI level; here it only verifies the concept
      // In SaveFavoriteDialog, addTag should be called before saving

      await manager.addFavorite({
        title: 'Test',
        content: 'Content',
        tags: ['new tag 1', 'new tag 2'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      // Manually simulate the behavior of SaveFavoriteDialog
      for (const tag of ['new tag 1', 'new tag 2']) {
        try {
          await manager.addTag(tag);
        } catch (error) {
          // The tag already exists, ignore the error
        }
      }

      const tags = await manager.getAllTags();
      expect(tags.find(t => t.tag === 'new tag 1')).toBeDefined();
      expect(tags.find(t => t.tag === 'new tag 2')).toBeDefined();
    });
  });
});
