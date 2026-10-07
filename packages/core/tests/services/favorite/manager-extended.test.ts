import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FavoriteManager } from '../../../src/services/favorite/manager';
import type { IStorageProvider } from '../../../src/services/storage/types';
import { FavoriteValidationError } from '../../../src/services/favorite/errors';
import { TypeMapper } from '../../../src/services/favorite/type-mapper';

/**
 * FavoriteManager extended feature unit test
 * Tests features such as functionMode validation and category management
 */
describe('FavoriteManager - extended features', () => {
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

  describe('addFavorite - functionMode validation', () => {
    it('should reject a favorite missing functionMode', async () => {
      await expect(
        manager.addFavorite({
          title: 'Test',
          content: 'Content',
          tags: [],
          // @ts-expect-error deliberately omit functionMode to test the validation
          optimizationMode: 'system'
        })
      ).rejects.toThrow(FavoriteValidationError);
    });

    it('should accept a valid basic/system mode', async () => {
      const id = await manager.addFavorite({
        title: 'Test basic mode',
        content: 'Test content',
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      expect(id).toBeTruthy();
      const favorite = await manager.getFavorite(id);
      expect(favorite.functionMode).toBe('basic');
      expect(favorite.optimizationMode).toBe('system');
    });

    it('should accept a valid context/user mode', async () => {
      const id = await manager.addFavorite({
        title: 'Test context mode',
        content: 'Test content',
        tags: [],
        functionMode: 'context',
        optimizationMode: 'user'
      });

      expect(id).toBeTruthy();
      const favorite = await manager.getFavorite(id);
      expect(favorite.functionMode).toBe('context');
      expect(favorite.optimizationMode).toBe('user');
    });

    it('should accept a valid image/text2image mode', async () => {
      const id = await manager.addFavorite({
        title: 'Test image mode',
        content: 'Test content',
        tags: [],
        functionMode: 'image',
        imageSubMode: 'text2image'
      });

      expect(id).toBeTruthy();
      const favorite = await manager.getFavorite(id);
      expect(favorite.functionMode).toBe('image');
      expect(favorite.imageSubMode).toBe('text2image');
    });

    it('should reject basic mode missing optimizationMode', async () => {
      await expect(
        manager.addFavorite({
          title: 'Test',
          content: 'Content',
          tags: [],
          functionMode: 'basic'
          // Missing optimizationMode
        })
      ).rejects.toThrow(FavoriteValidationError);
    });

    it('should reject image mode missing imageSubMode', async () => {
      await expect(
        manager.addFavorite({
          title: 'Test',
          content: 'Content',
          tags: [],
          functionMode: 'image'
          // Missing imageSubMode
        })
      ).rejects.toThrow(FavoriteValidationError);
    });

    it('basic mode containing imageSubMode does not error (the field is saved but unused)', async () => {
      // Note: the current implementation does not validate conflicting fields; this is a known design choice
      const id = await manager.addFavorite({
        title: 'Test',
        content: 'Content',
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system',
        imageSubMode: 'text2image' // Redundant field, does not error
      });

      expect(id).toBeTruthy();
      const favorite = await manager.getFavorite(id);
      expect(favorite.functionMode).toBe('basic');
      expect(favorite.optimizationMode).toBe('system');
      // imageSubMode is saved but not used in basic mode
    });

    it('image mode containing optimizationMode does not error (the field is saved but unused)', async () => {
      // Note: the current implementation does not validate conflicting fields; this is a known design choice
      const id = await manager.addFavorite({
        title: 'Test',
        content: 'Content',
        tags: [],
        functionMode: 'image',
        imageSubMode: 'text2image',
        optimizationMode: 'system' // Redundant field, does not error
      });

      expect(id).toBeTruthy();
      const favorite = await manager.getFavorite(id);
      expect(favorite.functionMode).toBe('image');
      expect(favorite.imageSubMode).toBe('text2image');
      // optimizationMode is saved but not used in image mode
    });
  });

  describe('addFavorite - metadata handling', () => {
    it('should store metadata.originalContent correctly', async () => {
      const id = await manager.addFavorite({
        title: 'Test',
        content: 'Optimized content',
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system',
        metadata: {
          originalContent: 'Original content'
        }
      });

      const favorite = await manager.getFavorite(id);
      expect(favorite.metadata?.originalContent).toBe('Original content');
    });

    it('should store metadata.sourceHistoryId correctly', async () => {
      const id = await manager.addFavorite({
        title: 'Test',
        content: 'Optimized content',
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system',
        metadata: {
          sourceHistoryId: 'history-123'
        }
      });

      const favorite = await manager.getFavorite(id);
      expect(favorite.metadata?.sourceHistoryId).toBe('history-123');
    });

    it('should keep other metadata fields', async () => {
      const id = await manager.addFavorite({
        title: 'Test',
        content: 'Content',
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system',
        metadata: {
          customField: 'Custom value',
          anotherField: 123
        }
      });

      const favorite = await manager.getFavorite(id);
      expect(favorite.metadata?.customField).toBe('Custom value');
      expect(favorite.metadata?.anotherField).toBe(123);
    });
  });

  describe('Category management - reorderCategories', () => {
    it('should be able to reorder categories', async () => {
      // Create the test categories
      const cat1Id = await manager.addCategory({ name: 'Category 1', color: '#ff0000' });
      const cat2Id = await manager.addCategory({ name: 'Category 2', color: '#00ff00' });
      const cat3Id = await manager.addCategory({ name: 'Category 3', color: '#0000ff' });

      // Reorder: 3, 1, 2
      await manager.reorderCategories([cat3Id, cat1Id, cat2Id]);

      const categories = await manager.getCategories();

      // Sort by sortOrder
      const sorted = categories.sort((a, b) => a.sortOrder - b.sortOrder);

      expect(sorted[0].id).toBe(cat3Id);
      expect(sorted[0].sortOrder).toBe(0);

      expect(sorted[1].id).toBe(cat1Id);
      expect(sorted[1].sortOrder).toBe(1);

      expect(sorted[2].id).toBe(cat2Id);
      expect(sorted[2].sortOrder).toBe(2);
    });

    it('should filter out non-existent category IDs', async () => {
      const cat1Id = await manager.addCategory({ name: 'Category 1', color: '#ff0000' });

      // Including a non-existent ID
      await manager.reorderCategories(['non-existent', cat1Id]);

      const categories = await manager.getCategories();
      const existingCategory = categories.find(c => c.id === cat1Id);

      expect(existingCategory).toBeDefined();
      expect(existingCategory!.sortOrder).toBeDefined();
    });

    it('an empty array should throw a validation error', async () => {
      await expect(manager.reorderCategories([])).rejects.toThrow(FavoriteValidationError);
    });
  });

  describe('Category management - getCategoryUsage', () => {
    it('should return the usage count of a category', async () => {
      const catId = await manager.addCategory({ name: 'Test category', color: '#ff0000' });

      // Add 3 favorites using this category
      await manager.addFavorite({
        title: 'Favorite 1',
        content: 'Content 1',
        category: catId,
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.addFavorite({
        title: 'Favorite 2',
        content: 'Content 2',
        category: catId,
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.addFavorite({
        title: 'Favorite 3',
        content: 'Content 3',
        category: catId,
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      const usage = await manager.getCategoryUsage(catId);
      expect(usage).toBe(3);
    });

    it('should return 0 for an unused category', async () => {
      const catId = await manager.addCategory({ name: 'Unused category', color: '#ff0000' });

      const usage = await manager.getCategoryUsage(catId);
      expect(usage).toBe(0);
    });

    it('should return 0 for a non-existent category', async () => {
      const usage = await manager.getCategoryUsage('non-existent-id');
      expect(usage).toBe(0);
    });

    it('different categories should be counted independently', async () => {
      const cat1Id = await manager.addCategory({ name: 'Category 1', color: '#ff0000' });
      const cat2Id = await manager.addCategory({ name: 'Category 2', color: '#00ff00' });

      // Category 1: 2 favorites
      await manager.addFavorite({
        title: 'Favorite 1-1',
        content: 'Content',
        category: cat1Id,
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.addFavorite({
        title: 'Favorite 1-2',
        content: 'Content',
        category: cat1Id,
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      // Category 2: 1 favorite
      await manager.addFavorite({
        title: 'Favorite 2-1',
        content: 'Content',
        category: cat2Id,
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      const usage1 = await manager.getCategoryUsage(cat1Id);
      const usage2 = await manager.getCategoryUsage(cat2Id);

      expect(usage1).toBe(2);
      expect(usage2).toBe(1);
    });
  });

  describe('Category management - deleteCategory', () => {
    it('deleting a category should clear the category field of favorites and return the affected count', async () => {
      const catId = await manager.addCategory({ name: 'Test category', color: '#ff0000' });

      // Add 2 favorites that use this category
      const fav1Id = await manager.addFavorite({
        title: 'Favorite 1',
        content: 'Content 1',
        category: catId,
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      const fav2Id = await manager.addFavorite({
        title: 'Favorite 2',
        content: 'Content 2',
        category: catId,
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      // Delete the category
      const affectedCount = await manager.deleteCategory(catId);

      // It should return the number of affected favorites
      expect(affectedCount).toBe(2);

      // The category field of the favorites should be cleared
      const fav1 = await manager.getFavorite(fav1Id);
      const fav2 = await manager.getFavorite(fav2Id);
      expect(fav1.category).toBeUndefined();
      expect(fav2.category).toBeUndefined();

      // The category should be deleted
      const categories = await manager.getCategories();
      expect(categories.find(c => c.id === catId)).toBeUndefined();
    });

    it('deleting an empty category should return 0', async () => {
      const catId = await manager.addCategory({ name: 'Empty category', color: '#ff0000' });

      const affectedCount = await manager.deleteCategory(catId);

      expect(affectedCount).toBe(0);
    });

    it('deleting a non-existent category should throw an error', async () => {
      await expect(manager.deleteCategory('non-existent-id')).rejects.toThrow();
    });
  });

  describe('ensureDefaultCategories - default category management', () => {
    it('the first call should create the default categories', async () => {
      const customCategories = [
        { name: 'Category 1', description: 'Desc 1', color: '#FF0000' },
        { name: 'Category 2', description: 'Desc 2', color: '#00FF00' }
      ];

      await manager.ensureDefaultCategories(customCategories);
      const categories = await manager.getCategories();

      expect(categories.length).toBe(2);
      expect(categories.find(c => c.name === 'Category 1')).toBeDefined();
      expect(categories.find(c => c.name === 'Category 2')).toBeDefined();
    });

    it('should not be recreated automatically after the user deletes all categories', async () => {
      // First creation
      await manager.ensureDefaultCategories([
        { name: 'Cat1', color: '#FF0000' }
      ]);

      let categories = await manager.getCategories();
      expect(categories.length).toBe(1);

      // The user deletes all categories
      for (const cat of categories) {
        await manager.deleteCategory(cat.id);
      }

      categories = await manager.getCategories();
      expect(categories.length).toBe(0);

      // Calling again should not create them (already marked as initialized)
      await manager.ensureDefaultCategories([
        { name: 'Cat1', color: '#FF0000' }
      ]);

      categories = await manager.getCategories();
      expect(categories.length).toBe(0); // Still 0
    });

    it('should not create duplicates when categories already exist', async () => {
      // Manually create a category first
      await manager.addCategory({ name: 'Existing', color: '#000000' });

      // Calling ensureDefaultCategories should not create new categories
      await manager.ensureDefaultCategories([
        { name: 'New Category', color: '#FFFFFF' }
      ]);

      const categories = await manager.getCategories();
      expect(categories.length).toBe(1); // Still only 1
      expect(categories[0].name).toBe('Existing');
    });

    it('the default categories should have the correct sortOrder', async () => {
      await manager.ensureDefaultCategories([
        { name: 'Cat1', color: '#FF0000' },
        { name: 'Cat2', color: '#00FF00' },
        { name: 'Cat3', color: '#0000FF' }
      ]);

      const categories = await manager.getCategories();
      const sorted = categories.sort((a, b) => a.sortOrder - b.sortOrder);

      // sortOrder should increase consecutively
      sorted.forEach((cat, index) => {
        expect(cat.sortOrder).toBe(index);
      });
    });
  });

  describe('TypeMapper integration test', () => {
    it('the result mapped by TypeMapper should pass addFavorite validation', () => {
      const testTypes = [
        'optimize',
        'userOptimize',
        'conversationMessageOptimize',
        'contextUserOptimize',
        'imageOptimize',
        'text2imageOptimize',
        'image2imageOptimize'
      ] as const;

      testTypes.forEach(type => {
        const mapping = TypeMapper.mapFromRecordType(type);
        // Verify the validity of the mapping result
        expect(TypeMapper.validateMapping(mapping)).toBe(true);
      });
    });

    it('should be able to create a favorite using the TypeMapper mapping result', async () => {
      const mapping = TypeMapper.mapFromRecordType('optimize');

      const id = await manager.addFavorite({
        title: 'Created from a TypeMapper mapping',
        content: 'Test content',
        tags: [],
        ...mapping
      });

      expect(id).toBeTruthy();

      const favorite = await manager.getFavorite(id);
      expect(favorite.functionMode).toBe(mapping.functionMode);
      expect(favorite.optimizationMode).toBe(mapping.optimizationMode);
    });
  });
});
