import type { IStorageProvider } from '../storage/types';
import type {
  FavoritePrompt,
  FavoriteCategory,
  FavoriteStats,
  FavoriteTag,
  IFavoriteManager
} from './types';
import {
  FavoriteError,
  FavoriteNotFoundError,
  FavoriteCategoryNotFoundError,
  FavoriteValidationError,
  FavoriteStorageError,
  FavoriteMigrationError,
  FavoriteImportExportError
} from './errors';
import { TypeMapper } from './type-mapper';
import { TagTypeConverter } from './type-converter';

/**
 * Favorites manager implementation
 */
export class FavoriteManager implements IFavoriteManager {
  private readonly STORAGE_KEYS = {
    FAVORITES: 'favorites',
    CATEGORIES: 'favorite_categories',
    STATS: 'favorite_stats',
    TAGS: 'favorite_tags'
  } as const;

  private initPromise: Promise<void>;
  private initialized = false;
  /**
   * Initialization state flag
   * - 'pending': initialization has not started
   * - 'initializing': initialization in progress
   * - 'initialized': initialization complete
   */
  private initState: 'pending' | 'initializing' | 'initialized' = 'pending';

  constructor(private storageProvider: IStorageProvider) {
    // Start async initialization immediately
    this.initPromise = this.initialize();
  }

  /**
   * Explicit initialization method
   * Ensures both default categories and data migration are complete
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.initState = 'initializing';
      // ❌ Removed automatic creation of default categories - the UI layer now calls ensureDefaultCategories
      // await this.initializeDefaultCategories();
      await this.migrateLegacyData();
      this.initialized = true;
      this.initState = 'initialized';
    } catch (error) {
      console.error('[FavoriteManager] Initialization failed:', error);
      // Even if initialization fails, mark it as initialized to avoid blocking subsequent operations
      this.initialized = true;
      this.initState = 'initialized';
    }
  }

  /**
   * Ensure initialization is complete
   * All public methods should call this first
   *
   * 🔒 Deadlock protection:
   * If initialization is currently in progress, return directly without waiting, allowing the initialization logic to call its own methods
   */
  private async ensureInitialized(): Promise<void> {
    // If initialization is in progress, return directly to avoid deadlock
    if (this.initState === 'initializing') {
      return;
    }

    // Otherwise wait for initialization to complete
    await this.initPromise;
  }

  /**
   * Migrate legacy data
   * Add default values to legacy favorites that lack functionMode
   */
  private async migrateLegacyData(): Promise<void> {
    try {
      let migrated = false;

      await this.storageProvider.updateData(this.STORAGE_KEYS.FAVORITES, (favorites: any[] | null) => {
        // If there is no data, return an empty array
        if (!favorites || favorites.length === 0) return favorites || [];

        const migratedFavorites = favorites.map((favorite: any) => {
          // Check whether this is legacy data (no functionMode field)
          if (!favorite.functionMode) {
            migrated = true;

            // Remove the deprecated isPublic field
            const { isPublic, originalContent, ...rest } = favorite;

            // Add the new required fields
            return {
              ...rest,
              functionMode: 'basic',  // Defaults to basic mode
              optimizationMode: 'system',  // Defaults to system optimization mode
              metadata: {
                ...(favorite.metadata || {}),
                // If originalContent exists, migrate it into metadata
                ...(originalContent ? { originalContent } : {})
              }
            };
          }

          return favorite;
        });

        return migratedFavorites;
      });

      if (migrated) {
        // Update statistics after migration
        await this.updateStats();
        console.info('[FavoriteManager] Data migration complete, favorite item format updated');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const migrationError = new FavoriteMigrationError(
        `Legacy data migration failed: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
      console.warn('[FavoriteManager]', migrationError);
      // A migration failure should not block service initialization; only log a warning
    }
  }

  /**
   * Ensure default categories exist (first time only)
   * Called by the UI layer, passing in the internationalized category config
   *
   * @param defaultCategories Array of default category configs
   */
  async ensureDefaultCategories(
    defaultCategories: Array<{
      name: string;
      description?: string;
      color: string;
    }>
  ): Promise<void> {
    await this.ensureInitialized();

    try {
      // ✅ Check whether default categories have already been initialized
      const hasInitialized = await this.storageProvider.getItem('favorite_categories_initialized');
      if (hasInitialized === 'true') {
        return; // Already initialized; do not auto-create again even if the user deleted them all
      }

      // ✅ Check whether categories already exist
      const existingCategories = await this.getCategories();

      if (existingCategories.length === 0) {
        // ✅ First use: create default categories
        for (let i = 0; i < defaultCategories.length; i++) {
          const category = defaultCategories[i];
          await this.addCategory({
            name: category.name,
            description: category.description,
            color: category.color,
            sortOrder: i
          });
        }

        // ✅ Mark as initialized
        await this.storageProvider.setItem('favorite_categories_initialized', 'true');
      }
    } catch (error) {
      console.warn('[FavoriteManager] Failed to ensure default categories:', error);
    }
  }

  async addFavorite(favorite: Omit<FavoritePrompt, 'id' | 'createdAt' | 'updatedAt' | 'useCount'>): Promise<string> {
    await this.ensureInitialized();

    // Validate input
    if (!favorite.content?.trim()) {
      throw new FavoriteValidationError('Prompt content cannot be empty');
    }

    // Validate that functionMode is provided
    if (!favorite.functionMode) {
      throw new FavoriteValidationError('Function mode (functionMode) cannot be empty');
    }

    // Validate the completeness of function-mode categories
    if (favorite.functionMode === 'basic' || favorite.functionMode === 'context') {
      if (!favorite.optimizationMode) {
        throw new FavoriteValidationError(`${favorite.functionMode} mode must specify optimizationMode`);
      }
    }

    if (favorite.functionMode === 'image') {
      if (!favorite.imageSubMode) {
        throw new FavoriteValidationError('Image mode must specify imageSubMode');
      }
    }

    const favoriteData = {
      title: favorite.title?.trim() || favorite.content.slice(0, 50) + (favorite.content.length > 50 ? '...' : ''),
      content: favorite.content,
      description: favorite.description,
      category: favorite.category,
      tags: favorite.tags || [],
      functionMode: favorite.functionMode,
      optimizationMode: favorite.optimizationMode,
      imageSubMode: favorite.imageSubMode,
      metadata: favorite.metadata
    };

    const now = Date.now();
    const id = `fav_${now}_${Math.random().toString(36).substr(2, 9)}`;

    const newFavorite: FavoritePrompt = {
      ...favoriteData,
      id,
      createdAt: now,
      updatedAt: now,
      useCount: 0
    };

    try {
      await this.storageProvider.updateData(this.STORAGE_KEYS.FAVORITES, (favorites: FavoritePrompt[] | null) => {
        const favoritesList = favorites || [];
        // 🔧 Removed duplicate content check - allow favoriting the same content with different attributes
        // Users may need to set different titles, categories, tags, etc. for the same content
        return [...favoritesList, newFavorite];
      });

      await this.updateStats();
      return id;
    } catch (error) {
      if (error instanceof FavoriteError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to add favorite: ${errorMessage}`);
    }
  }

  async getFavorites(options: {
    categoryId?: string;
    tags?: string[];
    keyword?: string;
    sortBy?: 'createdAt' | 'updatedAt' | 'useCount' | 'title';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  } = {}): Promise<FavoritePrompt[]> {
    await this.ensureInitialized();

    try {
      const favorites = await this.storageProvider.getItem(this.STORAGE_KEYS.FAVORITES);
      let favoritesList: FavoritePrompt[] = favorites ? JSON.parse(favorites) : [];

      // Filter
      if (options.categoryId) {
        favoritesList = favoritesList.filter(f => f.category === options.categoryId);
      }

      if (options.tags && options.tags.length > 0) {
        favoritesList = favoritesList.filter(f =>
          options.tags!.some(tag => f.tags.includes(tag))
        );
      }

      if (options.keyword) {
        const keyword = options.keyword.toLowerCase();
        favoritesList = favoritesList.filter(f =>
          f.title.toLowerCase().includes(keyword) ||
          f.content.toLowerCase().includes(keyword) ||
          f.description?.toLowerCase().includes(keyword)
        );
      }

      // Sort
      const sortBy = options.sortBy || 'updatedAt';
      const sortOrder = options.sortOrder || 'desc';

      favoritesList.sort((a, b) => {
        let aValue: any = a[sortBy];
        let bValue: any = b[sortBy];

        if (sortBy === 'title') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }

        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });

      // Paginate
      if (options.offset) {
        favoritesList = favoritesList.slice(options.offset);
      }

      if (options.limit) {
        favoritesList = favoritesList.slice(0, options.limit);
      }

      return favoritesList;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to get favorites: ${errorMessage}`);
    }
  }

  async getFavorite(id: string): Promise<FavoritePrompt> {
    try {
      const favorites = await this.getFavorites();
      const favorite = favorites.find(f => f.id === id);

      if (!favorite) {
        throw new FavoriteNotFoundError(id);
      }

      return favorite;
    } catch (error) {
      if (error instanceof FavoriteError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to get favorite details: ${errorMessage}`);
    }
  }

  async updateFavorite(id: string, updates: Partial<FavoritePrompt>): Promise<void> {
    await this.ensureInitialized();

    try {
      await this.storageProvider.updateData(this.STORAGE_KEYS.FAVORITES, (favorites: FavoritePrompt[] | null) => {
        const favoritesList = favorites || [];
        const index = favoritesList.findIndex(f => f.id === id);
        if (index === -1) {
          throw new FavoriteNotFoundError(id);
        }

        favoritesList[index] = {
          ...favoritesList[index],
          ...updates,
          updatedAt: Date.now()
        };

        return favoritesList;
      });

      await this.updateStats();
    } catch (error) {
      if (error instanceof FavoriteError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to update favorite: ${errorMessage}`);
    }
  }

  async deleteFavorite(id: string): Promise<void> {
    await this.ensureInitialized();

    try {
      await this.storageProvider.updateData(this.STORAGE_KEYS.FAVORITES, (favorites: FavoritePrompt[] | null) => {
        const favoritesList = favorites || [];
        const index = favoritesList.findIndex(f => f.id === id);
        if (index === -1) {
          throw new FavoriteNotFoundError(id);
        }

        return favoritesList.filter(f => f.id !== id);
      });

      await this.updateStats();
    } catch (error) {
      if (error instanceof FavoriteError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to delete favorite: ${errorMessage}`);
    }
  }

  async deleteFavorites(ids: string[]): Promise<void> {
    try {
      await this.storageProvider.updateData(this.STORAGE_KEYS.FAVORITES, (favorites: FavoritePrompt[] | null) => {
        const favoritesList = favorites || [];
        const deletedCount = favoritesList.filter(f => ids.includes(f.id)).length;
        if (deletedCount === 0) {
          throw new FavoriteNotFoundError('Favorite to delete not found');
        }

        return favoritesList.filter(f => !ids.includes(f.id));
      });

      await this.updateStats();
    } catch (error) {
      if (error instanceof FavoriteError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to batch delete favorites: ${errorMessage}`);
    }
  }

  async incrementUseCount(id: string): Promise<void> {
    try {
      await this.updateFavorite(id, { useCount: (await this.getFavorite(id)).useCount + 1 });
    } catch (error) {
      // Silently handle usage-count increment failures; they do not affect the main functionality
      console.warn('Failed to increment usage count:', error);
    }
  }

  async getCategories(): Promise<FavoriteCategory[]> {
    await this.ensureInitialized();

    try {
      const categories = await this.storageProvider.getItem(this.STORAGE_KEYS.CATEGORIES);
      return categories ? JSON.parse(categories) : [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to get categories: ${errorMessage}`);
    }
  }

  async addCategory(category: Omit<FavoriteCategory, 'id' | 'createdAt'>): Promise<string> {
    await this.ensureInitialized();

    if (!category.name?.trim()) {
      throw new FavoriteValidationError('Category name cannot be empty');
    }

    const now = Date.now();
    const id = `cat_${now}_${Math.random().toString(36).substr(2, 9)}`;

    const newCategory: FavoriteCategory = {
      ...category,
      id,
      createdAt: now,
      sortOrder: category.sortOrder || 0
    };

    try {
      await this.storageProvider.updateData(this.STORAGE_KEYS.CATEGORIES, (categories: FavoriteCategory[] | null) => {
        const categoriesList = categories || [];
        // Check whether a category with the same name already exists
        const existing = categoriesList.find(c => c.name === category.name);
        if (existing) {
          throw new FavoriteValidationError(`Category already exists: ${category.name}`);
        }
        return [...categoriesList, newCategory];
      });

      return id;
    } catch (error) {
      if (error instanceof FavoriteError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to add category: ${errorMessage}`);
    }
  }

  async updateCategory(id: string, updates: Partial<FavoriteCategory>): Promise<void> {
    try {
      await this.storageProvider.updateData(this.STORAGE_KEYS.CATEGORIES, (categories: FavoriteCategory[] | null) => {
        const categoriesList = categories || [];
        const index = categoriesList.findIndex(c => c.id === id);
        if (index === -1) {
          throw new FavoriteCategoryNotFoundError(id);
        }

        categoriesList[index] = {
          ...categoriesList[index],
          ...updates
        };

        return categoriesList;
      });
    } catch (error) {
      if (error instanceof FavoriteError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to update category: ${errorMessage}`);
    }
  }

  /**
   * Delete category
   * Automatically clears the category field of all favorites under this category
   *
   * @param id Category ID
   * @returns Number of affected favorites
   */
  async deleteCategory(id: string): Promise<number> {
    await this.ensureInitialized();

    try {
      // ✅ Get all favorites under this category
      const allFavorites = await this.getFavorites();
      const favoritesInCategory = allFavorites.filter(f => f.category === id);

      // ✅ Clear the category field of these favorites (does not depend on whether "Uncategorized" exists)
      for (const favorite of favoritesInCategory) {
        await this.updateFavorite(favorite.id, {
          ...favorite,
          category: undefined // Clear category
        });
      }

      // ✅ Delete category
      await this.storageProvider.updateData(this.STORAGE_KEYS.CATEGORIES, (categories: FavoriteCategory[] | null) => {
        const categoriesList = categories || [];
        const index = categoriesList.findIndex(c => c.id === id);
        if (index === -1) {
          throw new FavoriteCategoryNotFoundError(id);
        }

        return categoriesList.filter(c => c.id !== id);
      });

      return favoritesInCategory.length;
    } catch (error) {
      if (error instanceof FavoriteError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to delete category: ${errorMessage}`);
    }
  }

  async getStats(): Promise<FavoriteStats> {
    try {
      const stats = await this.storageProvider.getItem(this.STORAGE_KEYS.STATS);
      if (stats) {
        return JSON.parse(stats);
      }

      // If there is no cached statistics data, compute and cache it
      return await this.updateStats();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to get statistics: ${errorMessage}`);
    }
  }

  private async updateStats(): Promise<FavoriteStats> {
    const favorites = await this.getFavorites();
    const categories = await this.getCategories();

    const categoryStats = categories.map(category => ({
      categoryId: category.id,
      categoryName: category.name,
      count: favorites.filter(f => f.category === category.id).length
    }));

    const tagCounts = new Map<string, number>();
    favorites.forEach(favorite => {
      favorite.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    const tagStats = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    const stats: FavoriteStats = {
      totalFavorites: favorites.length,
      categoryStats,
      tagStats,
      lastUsedAt: Math.max(...favorites.map(f => f.updatedAt), 0)
    };

    // Cache the statistics data
    try {
      await this.storageProvider.setItem(this.STORAGE_KEYS.STATS, JSON.stringify(stats));
    } catch (error) {
      console.warn('Failed to cache statistics data:', error);
    }

    return stats;
  }

  async searchFavorites(keyword: string, options?: {
    categoryId?: string;
    tags?: string[];
  }): Promise<FavoritePrompt[]> {
    return this.getFavorites({
      keyword,
      categoryId: options?.categoryId,
      tags: options?.tags,
      sortBy: 'updatedAt',
      sortOrder: 'desc'
    });
  }

  /**
   * Get all tag names from the standalone tag library
   * @private
   */
  private async getAllIndependentTags(): Promise<string[]> {
    try {
      const storedTags = await this.storageProvider.getItem(this.STORAGE_KEYS.TAGS);
      const independentTags: FavoriteTag[] = storedTags ? JSON.parse(storedTags) : [];
      return independentTags.map(t => t.tag);
    } catch (error) {
      console.warn('Failed to get standalone tags:', error);
      return [];
    }
  }

  async exportFavorites(ids?: string[]): Promise<string> {
    try {
      let favorites: FavoritePrompt[];

      if (ids) {
        favorites = await Promise.all(ids.map(id => this.getFavorite(id)));
      } else {
        favorites = await this.getFavorites();
      }

      const categories = await this.getCategories();
      const tags = await this.getAllIndependentTags();

      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        favorites,
        categories,
        tags  // Export the standalone tag library (includes all tags: in use + pre-created)
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteImportExportError(
        `Failed to export favorites: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Compute tag usage statistics
   * @private
   * @returns Map containing tag names and usage counts
   */
  private async computeTagCounts(): Promise<Map<string, number>> {
    // 1. Get standalone tags
    const storedTags = await this.storageProvider.getItem(this.STORAGE_KEYS.TAGS);
    const independentTags: FavoriteTag[] = storedTags ? JSON.parse(storedTags) : [];

    // 2. Count tags used in favorite items
    const favorites = await this.getFavorites();
    const tagCounts = new Map<string, number>();

    favorites.forEach(favorite => {
      favorite.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    // 3. Merge standalone tags and tags in use
    // Standalone tags that are not used have a count of 0
    independentTags.forEach(({ tag }) => {
      if (!tagCounts.has(tag)) {
        tagCounts.set(tag, 0);
      }
    });

    return tagCounts;
  }

  async getAllTags(): Promise<Array<{ tag: string; count: number }>> {
    try {
      const tagCounts = await this.computeTagCounts();

      // Return sorted results (usage count descending, ties by tag name ascending)
      return Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => {
          if (b.count !== a.count) {
            return b.count - a.count; // Descending by usage count
          }
          return TagTypeConverter.compareTagNames(a.tag, b.tag); // Ties ascending by tag name
        });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to get tags: ${errorMessage}`);
    }
  }

  async addTag(tag: string): Promise<void> {
    await this.ensureInitialized();

    const trimmedTag = tag.trim();
    if (!trimmedTag) {
      throw new FavoriteValidationError('Tag name cannot be empty');
    }

    let added = false;

    try {
      await this.storageProvider.updateData(this.STORAGE_KEYS.TAGS, (tags: FavoriteTag[] | null) => {
        const tagsList = tags || [];

        // Check whether it already exists
        const existing = tagsList.find(t => t.tag === trimmedTag);
        if (existing) {
          // The tag already exists; stay idempotent and do not throw
          return tagsList;
        }

        const now = Date.now();
        const newTag: FavoriteTag = {
          tag: trimmedTag,
          createdAt: now
        };

        added = true;
        return [...tagsList, newTag];
      });

      // Only update statistics when a new tag is added
      if (added) {
        await this.updateStats();
      }
    } catch (error) {
      if (error instanceof FavoriteError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(
        `Failed to add tag: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async renameTag(oldTag: string, newTag: string): Promise<number> {
    if (!oldTag || !newTag) {
      throw new FavoriteValidationError('Tag name cannot be empty');
    }

    if (oldTag === newTag) {
      return 0; // Nothing to do
    }

    let affectedCount = 0;
    let oldTagExistedInIndependentLib = false;

    try {
      // 1. Update the standalone tag library: delete the old tag and record whether it existed
      await this.storageProvider.updateData(this.STORAGE_KEYS.TAGS, (tags: FavoriteTag[] | null) => {
        const tagsList = tags || [];

        // Check whether the old tag exists
        oldTagExistedInIndependentLib = tagsList.some(t => t.tag === oldTag);

        // Delete the old tag
        return tagsList.filter(t => t.tag !== oldTag);
      });

      // 2. Update the tags in the favorites list
      await this.storageProvider.updateData(this.STORAGE_KEYS.FAVORITES, (favorites: FavoritePrompt[] | null) => {
        const favoritesList = favorites || [];

        favoritesList.forEach(favorite => {
          const oldTagIndex = favorite.tags.indexOf(oldTag);
          if (oldTagIndex !== -1) {
            // Remove the old tag
            favorite.tags.splice(oldTagIndex, 1);
            // Add the new tag (if it does not exist)
            if (!favorite.tags.includes(newTag)) {
              favorite.tags.push(newTag);
            }
            favorite.updatedAt = Date.now();
            affectedCount++;
          }
        });

        return favoritesList;
      });

      // 3. Only add the new tag to the standalone library if the old tag existed in the library or was used by favorites
      if (oldTagExistedInIndependentLib || affectedCount > 0) {
        await this.storageProvider.updateData(this.STORAGE_KEYS.TAGS, (tags: FavoriteTag[] | null) => {
          const tagsList = tags || [];

          // Add the new tag (if it does not exist)
          const hasNewTag = tagsList.some(t => t.tag === newTag);
          if (!hasNewTag) {
            tagsList.push({
              tag: newTag,
              createdAt: Date.now()
            });
          }

          return tagsList;
        });
      }

      await this.updateStats();
      return affectedCount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to rename tag: ${errorMessage}`);
    }
  }

  async mergeTags(sourceTags: string[], targetTag: string): Promise<number> {
    if (!sourceTags || sourceTags.length === 0) {
      throw new FavoriteValidationError('Source tag list cannot be empty');
    }

    if (!targetTag) {
      throw new FavoriteValidationError('Target tag cannot be empty');
    }

    let affectedCount = 0;

    try {
      // 1. Update the standalone tag library: delete all source tags and make sure the target tag exists
      await this.storageProvider.updateData(this.STORAGE_KEYS.TAGS, (tags: FavoriteTag[] | null) => {
        const tagsList = tags || [];

        // Delete all source tags
        const filteredTags = tagsList.filter(t => !sourceTags.includes(t.tag));

        // Make sure the target tag exists
        const hasTargetTag = filteredTags.some(t => t.tag === targetTag);
        if (!hasTargetTag) {
          filteredTags.push({
            tag: targetTag,
            createdAt: Date.now()
          });
        }

        return filteredTags;
      });

      // 2. Update the tags in the favorites list
      await this.storageProvider.updateData(this.STORAGE_KEYS.FAVORITES, (favorites: FavoritePrompt[] | null) => {
        const favoritesList = favorites || [];

        favoritesList.forEach(favorite => {
          let hasSourceTag = false;

          // Remove all source tags
          sourceTags.forEach(sourceTag => {
            const index = favorite.tags.indexOf(sourceTag);
            if (index !== -1) {
              favorite.tags.splice(index, 1);
              hasSourceTag = true;
            }
          });

          // If any source tag exists, add the target tag (if it does not exist)
          if (hasSourceTag) {
            if (!favorite.tags.includes(targetTag)) {
              favorite.tags.push(targetTag);
            }
            favorite.updatedAt = Date.now();
            affectedCount++;
          }
        });

        return favoritesList;
      });

      await this.updateStats();
      return affectedCount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to merge tags: ${errorMessage}`);
    }
  }

  async deleteTag(tag: string): Promise<number> {
    if (!tag) {
      throw new FavoriteValidationError('Tag name cannot be empty');
    }

    let affectedCount = 0;

    try {
      // 1. Delete from the standalone tags
      await this.storageProvider.updateData(this.STORAGE_KEYS.TAGS, (tags: FavoriteTag[] | null) => {
        const tagsList = tags || [];
        return tagsList.filter(t => t.tag !== tag);
      });

      // 2. Delete from all favorite items
      await this.storageProvider.updateData(this.STORAGE_KEYS.FAVORITES, (favorites: FavoritePrompt[] | null) => {
        const favoritesList = favorites || [];

        favoritesList.forEach(favorite => {
          const index = favorite.tags.indexOf(tag);
          if (index !== -1) {
            favorite.tags.splice(index, 1);
            favorite.updatedAt = Date.now();
            affectedCount++;
          }
        });

        return favoritesList;
      });

      await this.updateStats();
      return affectedCount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to delete tag: ${errorMessage}`);
    }
  }

  async reorderCategories(categoryIds: string[]): Promise<void> {
    if (!categoryIds || categoryIds.length === 0) {
      throw new FavoriteValidationError('Category ID list cannot be empty');
    }

    try {
      await this.storageProvider.updateData(this.STORAGE_KEYS.CATEGORIES, (categories: FavoriteCategory[] | null) => {
        const categoriesList = categories || [];

        // Create an ID-to-category map
        const categoryMap = new Map<string, FavoriteCategory>();
        categoriesList.forEach(cat => categoryMap.set(cat.id, cat));

        // Reorder by the provided ID order and update sortOrder
        const reorderedCategories: FavoriteCategory[] = [];
        categoryIds.forEach((id, index) => {
          const category = categoryMap.get(id);
          if (category) {
            reorderedCategories.push({
              ...category,
              sortOrder: index
            });
            categoryMap.delete(id);
          }
        });

        // Append categories not in the ID list to the end
        categoryMap.forEach(category => {
          reorderedCategories.push({
            ...category,
            sortOrder: reorderedCategories.length
          });
        });

        return reorderedCategories;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to reorder categories: ${errorMessage}`);
    }
  }

  async getCategoryUsage(categoryId: string): Promise<number> {
    try {
      const favorites = await this.getFavorites({ categoryId });
      return favorites.length;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to get category usage: ${errorMessage}`);
    }
  }

  async importFavorites(data: string, options?: {
    mergeStrategy?: 'skip' | 'overwrite' | 'merge';
    categoryMapping?: Record<string, string>;
  }): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    const mergeStrategy = options?.mergeStrategy || 'skip';
    const categoryMapping = options?.categoryMapping || {};
    const result = { imported: 0, skipped: 0, errors: [] as string[] };

    try {
      await this.ensureInitialized();
      const importData = JSON.parse(data);

      if (!importData.favorites || !Array.isArray(importData.favorites)) {
        throw new FavoriteValidationError('Invalid import data format');
      }
      // Preprocess categories: avoid repeated fetching
      if (importData.categories && Array.isArray(importData.categories)) {
        const existingCategories = await this.getCategories();
        const existingCategoryIds = new Set(existingCategories.map(c => c.id));
        const existingCategoryNames = new Set(existingCategories.map(c => c.name));

        for (const category of importData.categories) {
          if (!category || typeof category.name !== 'string') continue;
          try {
            const exists =
              (category.id && existingCategoryIds.has(category.id)) ||
              existingCategoryNames.has(category.name);

            if (!exists) {
              await this.addCategory({
                name: category.name,
                description: category.description,
                color: category.color,
                sortOrder: category.sortOrder
              });
              existingCategoryNames.add(category.name);
            }
          } catch (error) {
            console.warn('Failed to import category:', category?.name, error);
          }
        }
      }

      // Preprocess standalone tags: merge once to avoid repeated statistics refreshes
      if (importData.tags && Array.isArray(importData.tags) && importData.tags.length > 0) {
        const tagsToMerge = new Set<string>();
        importData.tags.forEach((tag: unknown) => {
          if (typeof tag === 'string' && tag.trim()) {
            tagsToMerge.add(tag.trim());
          }
        });

        if (tagsToMerge.size > 0) {
          await this.storageProvider.updateData(this.STORAGE_KEYS.TAGS, (tags: FavoriteTag[] | null) => {
            const tagsList = tags ? [...tags] : [];
            const existing = new Set(tagsList.map(t => t.tag));
            const now = Date.now();

            tagsToMerge.forEach((tag: string) => {
              if (!existing.has(tag)) {
                tagsList.push({ tag, createdAt: now });
                existing.add(tag);
              }
            });

            return tagsList;
          });
        }
      }

      const parseTimestamp = (value: unknown, fallback: number): number => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          return value;
        }
        if (typeof value === 'string') {
          const parsed = Date.parse(value);
          if (!Number.isNaN(parsed)) {
            return parsed;
          }
        }
        return fallback;
      };

      const sanitizeTags = (rawTags: unknown): string[] => {
        if (!Array.isArray(rawTags)) return [];
        const tagSet = new Set<string>();
        rawTags.forEach(tag => {
          if (typeof tag === 'string' && tag.trim()) {
            tagSet.add(tag.trim());
          }
        });
        return Array.from(tagSet);
      };

      const baseTimestamp = Date.now();
      let timestampOffset = 0;

      await this.storageProvider.updateData(this.STORAGE_KEYS.FAVORITES, (favorites: FavoritePrompt[] | null) => {
        const favoritesList = favorites ? [...favorites] : [];
        const existingFavoritesMap = new Map<string, FavoritePrompt>();
        const existingIds = new Set<string>();
        favoritesList.forEach(f => {
          existingFavoritesMap.set(f.content, f);
          existingIds.add(f.id);
        });

        const generateId = (preferredId?: unknown) => {
          if (typeof preferredId === 'string' && preferredId.trim() && !existingIds.has(preferredId)) {
            existingIds.add(preferredId);
            return preferredId;
          }
          let newId = '';
          do {
            newId = `fav_${baseTimestamp + timestampOffset}_${Math.random().toString(36).slice(2, 11)}`;
          } while (existingIds.has(newId));
          existingIds.add(newId);
          return newId;
        };

        const buildTitle = (title: unknown, content: string) => {
          if (typeof title === 'string' && title.trim()) {
            return title.trim();
          }
          const trimmed = content.trim();
          return trimmed.length > 50 ? `${trimmed.slice(0, 50)}...` : trimmed;
        };

        const normalizeMetadata = (metadata: unknown) => {
          if (metadata && typeof metadata === 'object') {
            return metadata as Record<string, unknown>;
          }
          return undefined;
        };

        const favoritesToImport = Array.isArray(importData.favorites) ? importData.favorites : [];

        favoritesToImport.forEach((favorite: any) => {
          try {
            if (!favorite || typeof favorite.content !== 'string' || !favorite.content.trim()) {
              throw new FavoriteValidationError('Import data contains favorite with empty content');
            }

            const functionMode = favorite.functionMode || 'basic';
            const optimizationMode =
              favorite.optimizationMode ||
              (functionMode !== 'image' ? 'system' : undefined);
            const imageSubMode =
              favorite.imageSubMode ||
              (functionMode === 'image' ? 'text2image' : undefined);

            const mapping = { functionMode, optimizationMode, imageSubMode };
            if (!TypeMapper.validateMapping(mapping)) {
              throw new FavoriteValidationError(
                `Invalid function mode in import data: functionMode=${functionMode}, optimizationMode=${optimizationMode}, imageSubMode=${imageSubMode}`
              );
            }

            const category = categoryMapping[favorite.category] || favorite.category;
            const tags = sanitizeTags(favorite.tags);
            const createdAt = parseTimestamp(favorite.createdAt, baseTimestamp + timestampOffset);
            const updatedAt = parseTimestamp(favorite.updatedAt, createdAt);
            const useCount = typeof favorite.useCount === 'number' && favorite.useCount >= 0
              ? favorite.useCount
              : 0;

            const existingFavorite = existingFavoritesMap.get(favorite.content);

            if (existingFavorite) {
              if (mergeStrategy === 'skip') {
                result.skipped++;
                return;
              }

              if (mergeStrategy === 'overwrite') {
                existingFavorite.title = buildTitle(favorite.title, favorite.content);
                existingFavorite.content = favorite.content;
                existingFavorite.description = typeof favorite.description === 'string'
                  ? favorite.description
                  : favorite.description ?? existingFavorite.description;
                existingFavorite.tags = tags;
                existingFavorite.category = category;
                existingFavorite.functionMode = functionMode;
                existingFavorite.optimizationMode = optimizationMode;
                existingFavorite.imageSubMode = imageSubMode;
                existingFavorite.metadata = normalizeMetadata(favorite.metadata);
                existingFavorite.createdAt = parseTimestamp(favorite.createdAt, existingFavorite.createdAt);
                existingFavorite.updatedAt = updatedAt;
                existingFavorite.useCount = useCount;
                result.imported++;
                return;
              }
              // The merge strategy falls through to the add logic
            }

            const id = generateId(favorite.id);
            const newFavorite: FavoritePrompt = {
              id,
              title: buildTitle(favorite.title, favorite.content),
              content: favorite.content,
              description: typeof favorite.description === 'string' ? favorite.description : undefined,
              category,
              tags,
              functionMode,
              optimizationMode,
              imageSubMode,
              metadata: normalizeMetadata(favorite.metadata),
              createdAt,
              updatedAt,
              useCount
            };

            favoritesList.push(newFavorite);
            timestampOffset++;
            result.imported++;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            result.errors.push(`Failed to import favorite: ${errorMessage}`);
          }
        });

        return favoritesList;
      });

      await this.updateStats();
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteImportExportError(
        `Failed to import favorites: ${errorMessage}`,
        error instanceof Error ? error : undefined,
        result.errors.length > 0 ? result.errors : undefined
      );
    }
  }
}
