import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FavoriteManager } from '../../../src/services/favorite/manager';
import type { IStorageProvider } from '../../../src/services/storage/types';
import { TypeMapper } from '../../../src/services/favorite/type-mapper';
import type { PromptRecordType } from '../../../src/services/history/types';

/**
 * FavoriteManager integration test
 * Tests the complete business flows and cross-feature interactions
 */
describe('FavoriteManager - integration test', () => {
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

  describe('Complete favorite CRUD flow', () => {
    it('should complete the full create/read/update/delete flow', async () => {
      // 1. Create a category
      const categoryId = await manager.addCategory({
        name: 'Test category',
        description: 'Used for the integration test',
        color: '#FF5722'
      });

      // 2. Add a favorite
      const favoriteId = await manager.addFavorite({
        title: 'Test favorite',
        content: 'Test content',
        tags: ['test', 'integration'],
        category: categoryId,
        functionMode: 'basic',
        optimizationMode: 'system',
        metadata: {
          originalContent: 'Original content',
          sourceHistoryId: 'history-001'
        }
      });

      expect(favoriteId).toBeTruthy();

      // 3. Query a single favorite
      const favorite = await manager.getFavorite(favoriteId);
      expect(favorite.id).toBe(favoriteId);
      expect(favorite.title).toBe('Test favorite');
      expect(favorite.tags).toEqual(['test', 'integration']);
      expect(favorite.category).toBe(categoryId);
      expect(favorite.functionMode).toBe('basic');
      expect(favorite.optimizationMode).toBe('system');
      expect(favorite.metadata?.originalContent).toBe('Original content');
      expect(favorite.metadata?.sourceHistoryId).toBe('history-001');

      // 4. Query the list
      const favorites = await manager.getFavorites();
      expect(favorites.length).toBe(1);
      expect(favorites[0].id).toBe(favoriteId);

      // 5. Update the favorite
      await manager.updateFavorite(favoriteId, {
        title: 'Updated title',
        tags: ['test', 'integration', 'update'],
        functionMode: 'context',
        optimizationMode: 'user'
      });

      const updated = await manager.getFavorite(favoriteId);
      expect(updated.title).toBe('Updated title');
      expect(updated.tags).toEqual(['test', 'integration', 'update']);
      expect(updated.functionMode).toBe('context');
      expect(updated.optimizationMode).toBe('user');
      expect(updated.updatedAt).not.toBe(favorite.updatedAt);

      // 6. Delete the favorite
      await manager.deleteFavorite(favoriteId);
      const allFavorites = await manager.getFavorites();
      expect(allFavorites.length).toBe(0);

      // 7. Verify the category still exists
      const categories = await manager.getCategories();
      expect(categories.find(c => c.id === categoryId)).toBeDefined();
    });

    it('should handle relationships among multiple favorites correctly', async () => {
      // Create 2 categories
      const cat1Id = await manager.addCategory({ name: 'Category 1', color: '#FF0000' });
      const cat2Id = await manager.addCategory({ name: 'Category 2', color: '#00FF00' });

      // Create 3 favorites
      const fav1Id = await manager.addFavorite({
        title: 'Favorite 1',
        content: 'Content 1',
        tags: ['shared tag', 'tag 1'],
        category: cat1Id,
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      const fav2Id = await manager.addFavorite({
        title: 'Favorite 2',
        content: 'Content 2',
        tags: ['shared tag', 'tag 2'],
        category: cat1Id,
        functionMode: 'basic',
        optimizationMode: 'user'
      });

      const fav3Id = await manager.addFavorite({
        title: 'Favorite 3',
        content: 'Content 3',
        tags: ['tag 3'],
        category: cat2Id,
        functionMode: 'image',
        imageSubMode: 'text2image'
      });

      // Verify the tag statistics
      const tags = await manager.getAllTags();
      const sharedTag = tags.find(t => t.tag === 'shared tag');
      expect(sharedTag?.count).toBe(2);

      // Verify the category usage statistics
      const cat1Usage = await manager.getCategoryUsage(cat1Id);
      const cat2Usage = await manager.getCategoryUsage(cat2Id);
      expect(cat1Usage).toBe(2);
      expect(cat2Usage).toBe(1);

      // Query by category
      const cat1Favorites = await manager.getFavorites({ categoryId: cat1Id });
      expect(cat1Favorites.length).toBe(2);

      // Query by tag
      const sharedTagFavorites = await manager.getFavorites({ tags: ['shared tag'] });
      expect(sharedTagFavorites.length).toBe(2);
    });

    it('should support the full flow of function mode validation', async () => {
      // Add favorites of various modes
      const basicId = await manager.addFavorite({
        title: 'Basic Mode',
        content: 'Content',
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      const contextId = await manager.addFavorite({
        title: 'Context Mode',
        content: 'Content',
        tags: [],
        functionMode: 'context',
        optimizationMode: 'user'
      });

      const imageId = await manager.addFavorite({
        title: 'Image Mode',
        content: 'Content',
        tags: [],
        functionMode: 'image',
        imageSubMode: 'text2image'
      });

      // Verify the mode of each favorite
      const basic = await manager.getFavorite(basicId);
      expect(basic.functionMode).toBe('basic');
      expect(basic.optimizationMode).toBe('system');
      expect(basic.imageSubMode).toBeUndefined();

      const context = await manager.getFavorite(contextId);
      expect(context.functionMode).toBe('context');
      expect(context.optimizationMode).toBe('user');
      expect(context.imageSubMode).toBeUndefined();

      const image = await manager.getFavorite(imageId);
      expect(image.functionMode).toBe('image');
      expect(image.imageSubMode).toBe('text2image');
      expect(image.optimizationMode).toBeUndefined();

      // An updated mode should take effect
      await manager.updateFavorite(basicId, {
        functionMode: 'context',
        optimizationMode: 'system'
      });

      const updated = await manager.getFavorite(basicId);
      expect(updated.functionMode).toBe('context');
      expect(updated.optimizationMode).toBe('system');
    });
  });

  describe('Integration test for saving favorites from optimization history', () => {
    it('should create a favorite correctly from the optimize type', async () => {
      // Mock the history record
      const recordType: PromptRecordType = 'optimize';
      const mapping = TypeMapper.mapFromRecordType(recordType);

      // Create the favorite
      const favoriteId = await manager.addFavorite({
        title: 'Optimized prompt',
        content: 'This is the optimized content',
        tags: ['AI', 'optimization'],
        ...mapping,
        metadata: {
          originalContent: 'This is the original content',
          sourceHistoryId: 'hist-123'
        }
      });

      // Verify
      const favorite = await manager.getFavorite(favoriteId);
      expect(favorite.functionMode).toBe('basic');
      expect(favorite.optimizationMode).toBe('system');
      expect(favorite.metadata?.originalContent).toBe('This is the original content');
      expect(favorite.metadata?.sourceHistoryId).toBe('hist-123');
    });

    it('should create a favorite correctly from the contextUserOptimize type', async () => {
      const recordType: PromptRecordType = 'contextUserOptimize';
      const mapping = TypeMapper.mapFromRecordType(recordType);

      const favoriteId = await manager.addFavorite({
        title: 'User context optimization',
        content: 'Optimized content',
        tags: [],
        ...mapping,
        metadata: {
          originalContent: 'Original content',
          sourceHistoryId: 'hist-456'
        }
      });

      const favorite = await manager.getFavorite(favoriteId);
      expect(favorite.functionMode).toBe('context');
      expect(favorite.optimizationMode).toBe('user');
    });

    it('should create a favorite correctly from the imageOptimize type', async () => {
      const recordType: PromptRecordType = 'imageOptimize';
      const mapping = TypeMapper.mapFromRecordType(recordType);

      const favoriteId = await manager.addFavorite({
        title: 'Image prompt optimization',
        content: 'Optimized image prompt',
        tags: ['image generation'],
        ...mapping
      });

      const favorite = await manager.getFavorite(favoriteId);
      expect(favorite.functionMode).toBe('image');
      expect(favorite.imageSubMode).toBe('text2image');
    });

    it('should create a favorite correctly from the image2imageOptimize type', async () => {
      const recordType: PromptRecordType = 'image2imageOptimize';
      const mapping = TypeMapper.mapFromRecordType(recordType);

      const favoriteId = await manager.addFavorite({
        title: 'Image-to-image prompt',
        content: 'Image-to-image optimization content',
        tags: [],
        ...mapping
      });

      const favorite = await manager.getFavorite(favoriteId);
      expect(favorite.functionMode).toBe('image');
      expect(favorite.imageSubMode).toBe('image2image');
    });

    it('should handle all history record types', async () => {
      const allTypes: PromptRecordType[] = [
        'optimize',
        'userOptimize',
        'iterate',
        'test',
        'conversationMessageOptimize',
        'contextUserOptimize',
        'contextIterate',
        'imageOptimize',
        'contextImageOptimize',
        'imageIterate',
        'text2imageOptimize',
        'image2imageOptimize'
      ];

      const ids: string[] = [];

      for (const type of allTypes) {
        const mapping = TypeMapper.mapFromRecordType(type);
        const id = await manager.addFavorite({
          title: `Favorite-${type}`,
          content: `Content-${type}`,
          tags: [type],
          ...mapping
        });
        ids.push(id);
      }

      // Verify all favorites were created successfully
      expect(ids.length).toBe(allTypes.length);

      const favorites = await manager.getFavorites();
      expect(favorites.length).toBe(allTypes.length);

      // Verify the function mode of every favorite is valid
      for (const favorite of favorites) {
        const mapping = {
          functionMode: favorite.functionMode,
          optimizationMode: favorite.optimizationMode,
          imageSubMode: favorite.imageSubMode
        };
        expect(TypeMapper.validateMapping(mapping)).toBe(true);
      }
    });
  });

  describe('Tag and category management integration test', () => {
    it('renaming a tag should update all associated favorites', async () => {
      // Create multiple favorites that use the same tag
      await manager.addFavorite({
        title: 'Favorite 1',
        content: 'Content 1',
        tags: ['old tag', 'other tag'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.addFavorite({
        title: 'Favorite 2',
        content: 'Content 2',
        tags: ['old tag'],
        functionMode: 'basic',
        optimizationMode: 'user'
      });

      await manager.addFavorite({
        title: 'Favorite 3',
        content: 'Content 3',
        tags: ['unrelated tag'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      // Rename the tag
      await manager.renameTag('old tag', 'new tag');

      // Verify all favorites were updated
      const favorites = await manager.getFavorites();
      const fav1 = favorites.find(f => f.title === 'Favorite 1');
      const fav2 = favorites.find(f => f.title === 'Favorite 2');
      const fav3 = favorites.find(f => f.title === 'Favorite 3');

      expect(fav1?.tags).toContain('new tag');
      expect(fav1?.tags).not.toContain('old tag');
      expect(fav1?.tags).toContain('other tag');

      expect(fav2?.tags).toContain('new tag');
      expect(fav2?.tags).not.toContain('old tag');

      expect(fav3?.tags).toContain('unrelated tag');
      expect(fav3?.tags).not.toContain('new tag');

      // Verify the tag statistics
      const tags = await manager.getAllTags();
      const newTag = tags.find(t => t.tag === 'new tag');
      const oldTag = tags.find(t => t.tag === 'old tag');

      expect(newTag?.count).toBe(2);
      expect(oldTag).toBeUndefined();
    });

    it('merging tags should deduplicate correctly', async () => {
      // Create the test data
      await manager.addFavorite({
        title: 'Favorite 1',
        content: 'Content',
        tags: ['Tag A', 'Tag B'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.addFavorite({
        title: 'Favorite 2',
        content: 'Content',
        tags: ['Tag A', 'Tag C'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.addFavorite({
        title: 'Favorite 3',
        content: 'Content',
        tags: ['Tag B', 'Tag C'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      // Merge Tag A and Tag B -> Tag B
      await manager.mergeTags(['Tag A'], 'Tag B');

      const favorites = await manager.getFavorites();
      const fav1 = favorites.find(f => f.title === 'Favorite 1');
      const fav2 = favorites.find(f => f.title === 'Favorite 2');
      const fav3 = favorites.find(f => f.title === 'Favorite 3');

      // Favorite 1: originally [A, B] -> [B] (deduplicated)
      expect(fav1?.tags).toEqual(['Tag B']);

      // Favorite 2: originally [A, C] -> [B, C]
      expect(fav2?.tags).toContain('Tag B');
      expect(fav2?.tags).toContain('Tag C');
      expect(fav2?.tags).not.toContain('Tag A');

      // Favorite 3: originally [B, C] -> [B, C] (unchanged)
      expect(fav3?.tags).toContain('Tag B');
      expect(fav3?.tags).toContain('Tag C');

      // Verify the tag statistics
      const tags = await manager.getAllTags();
      const tagA = tags.find(t => t.tag === 'Tag A');
      const tagB = tags.find(t => t.tag === 'Tag B');

      expect(tagA).toBeUndefined();
      expect(tagB?.count).toBe(3); // All 3 favorites have Tag B
    });

    it('deleting a tag should remove it from all favorites', async () => {
      await manager.addFavorite({
        title: 'Favorite 1',
        content: 'Content',
        tags: ['to delete', 'keep'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.addFavorite({
        title: 'Favorite 2',
        content: 'Content',
        tags: ['to delete'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.deleteTag('to delete');

      const favorites = await manager.getFavorites();
      favorites.forEach(fav => {
        expect(fav.tags).not.toContain('to delete');
      });

      const tags = await manager.getAllTags();
      expect(tags.find(t => t.tag === 'to delete')).toBeUndefined();
      expect(tags.find(t => t.tag === 'keep')).toBeDefined();
    });

    it('reordering categories should update the sortOrder of all categories', async () => {
      const cat1 = await manager.addCategory({ name: 'Category 1', color: '#FF0000' });
      const cat2 = await manager.addCategory({ name: 'Category 2', color: '#00FF00' });
      const cat3 = await manager.addCategory({ name: 'Category 3', color: '#0000FF' });

      // New order: 3, 1, 2
      await manager.reorderCategories([cat3, cat1, cat2]);

      const categories = await manager.getCategories();
      const sorted = categories.sort((a, b) => a.sortOrder - b.sortOrder);

      expect(sorted[0].id).toBe(cat3);
      expect(sorted[0].sortOrder).toBe(0);
      expect(sorted[1].id).toBe(cat1);
      expect(sorted[1].sortOrder).toBe(1);
      expect(sorted[2].id).toBe(cat2);
      expect(sorted[2].sortOrder).toBe(2);
    });

    it('category usage statistics should update in real time', async () => {
      const catId = await manager.addCategory({ name: 'Test category', color: '#FF0000' });

      // Initial usage is 0
      expect(await manager.getCategoryUsage(catId)).toBe(0);

      // Add favorites
      const fav1 = await manager.addFavorite({
        title: 'Favorite 1',
        content: 'Content',
        tags: [],
        category: catId,
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      expect(await manager.getCategoryUsage(catId)).toBe(1);

      const fav2 = await manager.addFavorite({
        title: 'Favorite 2',
        content: 'Content',
        tags: [],
        category: catId,
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      expect(await manager.getCategoryUsage(catId)).toBe(2);

      // Delete a favorite
      await manager.deleteFavorite(fav1);
      expect(await manager.getCategoryUsage(catId)).toBe(1);

      // Update a favorite to remove the category
      await manager.updateFavorite(fav2, { category: undefined });
      expect(await manager.getCategoryUsage(catId)).toBe(0);
    });

    it('deleting a category should clear the category field of associated favorites', async () => {
      const catId = await manager.addCategory({ name: 'Category to delete', color: '#FF0000' });

      const fav1 = await manager.addFavorite({
        title: 'Favorite 1',
        content: 'Content',
        tags: [],
        category: catId,
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      const fav2 = await manager.addFavorite({
        title: 'Favorite 2',
        content: 'Content',
        tags: [],
        category: catId,
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      const affectedCount = await manager.deleteCategory(catId);
      expect(affectedCount).toBe(2);

      const updated1 = await manager.getFavorite(fav1);
      const updated2 = await manager.getFavorite(fav2);

      expect(updated1.category).toBeUndefined();
      expect(updated2.category).toBeUndefined();
    });
  });

  describe('Import/export integration test', () => {
    it('should export and import correctly including all associated data', async () => {
      // Create the full test data
      const catId = await manager.addCategory({
        name: 'Test category',
        description: 'Description',
        color: '#FF5722'
      });

      await manager.addFavorite({
        title: 'Complete favorite',
        content: 'Content',
        tags: ['tag 1', 'tag 2'],
        category: catId,
        functionMode: 'basic',
        optimizationMode: 'system',
        metadata: {
          originalContent: 'Original content',
          sourceHistoryId: 'hist-001',
          customField: 'Custom value'
        }
      });

      // Export
      const exportData = await manager.exportFavorites();

      // Clear the data
      await storageProvider.clearAll();

      // Import
      await manager.importFavorites(exportData);

      // Verify
      const favorites = await manager.getFavorites();
      expect(favorites.length).toBe(1);

      const favorite = favorites[0];
      expect(favorite.title).toBe('Complete favorite');
      expect(favorite.tags).toEqual(['tag 1', 'tag 2']);
      expect(favorite.category).toBe(catId);
      expect(favorite.functionMode).toBe('basic');
      expect(favorite.optimizationMode).toBe('system');
      expect(favorite.metadata?.originalContent).toBe('Original content');
      expect(favorite.metadata?.sourceHistoryId).toBe('hist-001');
      expect(favorite.metadata?.customField).toBe('Custom value');

      const categories = await manager.getCategories();
      expect(categories.length).toBe(1);
      expect(categories[0].name).toBe('Test category');
    });

    it('should correctly handle category and tag associations on import', async () => {
      const cat1 = await manager.addCategory({ name: 'Category 1', color: '#FF0000' });
      const cat2 = await manager.addCategory({ name: 'Category 2', color: '#00FF00' });

      await manager.addFavorite({
        title: 'Favorite 1',
        content: 'Content 1',
        tags: ['shared', 'A'],
        category: cat1,
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.addFavorite({
        title: 'Favorite 2',
        content: 'Content 2',
        tags: ['shared', 'B'],
        category: cat2,
        functionMode: 'context',
        optimizationMode: 'user'
      });

      const exportData = await manager.exportFavorites();
      await storageProvider.clearAll();
      await manager.importFavorites(exportData);

      // Verify the categories
      const categories = await manager.getCategories();
      expect(categories.length).toBe(2);

      // Verify the tags
      const tags = await manager.getAllTags();
      const sharedTag = tags.find(t => t.tag === 'shared');
      expect(sharedTag?.count).toBe(2);

      // Verify the favorites
      const favorites = await manager.getFavorites();
      expect(favorites.length).toBe(2);
    });
  });

  describe('Search and filter integration test', () => {
    beforeEach(async () => {
      // Create the test dataset
      const cat1 = await manager.addCategory({ name: 'AI tools', color: '#FF0000' });
      const cat2 = await manager.addCategory({ name: 'Writing assistant', color: '#00FF00' });

      await manager.addFavorite({
        title: 'ChatGPT prompt',
        content: 'Help me write an article about AI',
        tags: ['AI', 'ChatGPT'],
        category: cat1,
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.addFavorite({
        title: 'Creative writing assistant',
        content: 'Help me generate a creative story outline',
        tags: ['writing', 'creative'],
        category: cat2,
        functionMode: 'context',
        optimizationMode: 'user'
      });

      await manager.addFavorite({
        title: 'AI drawing prompt',
        content: 'a beautiful sunset over mountains',
        tags: ['AI', 'drawing'],
        category: cat1,
        functionMode: 'image',
        imageSubMode: 'text2image'
      });
    });

    it('should be able to search by keyword', async () => {
      const results = await manager.searchFavorites('AI');
      expect(results.length).toBe(2);
      expect(results.every(f => f.title.includes('AI') || f.content.includes('AI'))).toBe(true);
    });

    it('should be able to filter by category', async () => {
      const categories = await manager.getCategories();
      const aiCategory = categories.find(c => c.name === 'AI tools');

      const results = await manager.getFavorites({ categoryId: aiCategory!.id });
      expect(results.length).toBe(2);
      expect(results.every(f => f.category === aiCategory!.id)).toBe(true);
    });

    it('should be able to filter by tag', async () => {
      const results = await manager.getFavorites({ tags: ['AI'] });
      expect(results.length).toBe(2);
      expect(results.every(f => f.tags.includes('AI'))).toBe(true);
    });

    it('should support combined filtering', async () => {
      const categories = await manager.getCategories();
      const aiCategory = categories.find(c => c.name === 'AI tools');

      const results = await manager.searchFavorites('prompt', {
        tags: ['AI'],
        categoryId: aiCategory!.id
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach(f => {
        expect(f.title.includes('prompt') || f.content.includes('prompt')).toBe(true);
        expect(f.tags.includes('AI')).toBe(true);
        expect(f.category).toBe(aiCategory!.id);
      });
    });
  });
});
