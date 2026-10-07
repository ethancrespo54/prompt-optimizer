/**
 * Favorite prompt record interface
 */
export interface FavoritePrompt {
  /** Favorite ID */
  id: string;
  /** Prompt title */
  title: string;
  /** Prompt content */
  content: string;
  /** Prompt description */
  description?: string;
  /** Favorited time */
  createdAt: number;
  /** Last modified time */
  updatedAt: number;
  /** Tags */
  tags: string[];
  /** Category ID (user-defined category, independent of function mode) */
  category?: string;
  /** Usage count */
  useCount: number;

  // 🆕 New fields - function mode classification system
  /** Function mode (first-level category, required) */
  functionMode: 'basic' | 'context' | 'image';
  /** Optimization mode (second-level category, only for basic/context modes) */
  optimizationMode?: 'system' | 'user';
  /** Image sub-mode (second-level category, only for image mode) */
  imageSubMode?: 'text2image' | 'image2image';

  /** Metadata (system-managed, not editable by the user) */
  metadata?: {
    /** Original content (before optimization) - only set when saved from optimization history */
    originalContent?: string;
    /** Source history record ID - only set when saved from optimization history */
    sourceHistoryId?: string;
    /** Model info */
    modelKey?: string;
    modelName?: string;
    templateId?: string;
    /** Favorite image assets (general favorite capability) */
    media?: {
      /** Cover image asset ID (preferred) */
      coverAssetId?: string;
      /** Cover image fallback URL (used when asset persistence fails) */
      coverUrl?: string;
      /** Image asset ID list */
      assetIds?: string[];
      /** Image fallback URL list */
      urls?: string[];
    };
    [key: string]: any;
  };
}

/**
 * Favorite category interface
 */
export interface FavoriteCategory {
  /** Category ID */
  id: string;
  /** Category name */
  name: string;
  /** Category description */
  description?: string;
  /** Parent category ID (supports hierarchical categories) */
  parentId?: string;
  /** Category color */
  color?: string;
  /** Creation time */
  createdAt: number;
  /** Sort weight */
  sortOrder: number;
}

/**
 * Favorite statistics
 */
export interface FavoriteStats {
  /** Total number of favorites */
  totalFavorites: number;
  /** Number of favorites per category */
  categoryStats: Array<{
    categoryId: string;
    categoryName: string;
    count: number;
  }>;
  /** Tag usage statistics */
  tagStats: Array<{
    tag: string;
    count: number;
  }>;
  /** Last used time */
  lastUsedAt?: number;
}

/**
 * Standalone tag interface
 */
export interface FavoriteTag {
  /** Tag name */
  tag: string;
  /** Creation time */
  createdAt: number;
}

/**
 * Tag statistics interface
 * Used by the tag manager to show tag usage
 */
export interface TagStatistics {
  /** Tag name */
  name: string;
  /** Usage count */
  count: number;
  /** Last used time (optional, not yet implemented) */
  lastUsed?: number;
}

/**
 * Favorites manager interface
 */
export interface IFavoriteManager {
  /** Add a favorite */
  addFavorite(favorite: Omit<FavoritePrompt, 'id' | 'createdAt' | 'updatedAt' | 'useCount'>): Promise<string>;

  /** Get the favorites list */
  getFavorites(options?: {
    categoryId?: string;
    tags?: string[];
    keyword?: string;
    sortBy?: 'createdAt' | 'updatedAt' | 'useCount' | 'title';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): Promise<FavoritePrompt[]>;

  /** Get favorite details */
  getFavorite(id: string): Promise<FavoritePrompt>;

  /** Update a favorite */
  updateFavorite(id: string, updates: Partial<FavoritePrompt>): Promise<void>;

  /** Delete a favorite */
  deleteFavorite(id: string): Promise<void>;

  /** Delete favorites in bulk */
  deleteFavorites(ids: string[]): Promise<void>;

  /** Increment the usage count */
  incrementUseCount(id: string): Promise<void>;

  /** Get the category list */
  getCategories(): Promise<FavoriteCategory[]>;

  /** Add a category */
  addCategory(category: Omit<FavoriteCategory, 'id' | 'createdAt'>): Promise<string>;

  /** Update a category */
  updateCategory(id: string, updates: Partial<FavoriteCategory>): Promise<void>;

  /** Delete a category */
  deleteCategory(id: string): Promise<number>;

  /** Get statistics */
  getStats(): Promise<FavoriteStats>;

  /** Search favorites */
  searchFavorites(keyword: string, options?: {
    categoryId?: string;
    tags?: string[];
  }): Promise<FavoritePrompt[]>;

  /** Export favorites */
  exportFavorites(ids?: string[]): Promise<string>;

  /** Import favorites */
  importFavorites(data: string, options?: {
    mergeStrategy?: 'skip' | 'overwrite' | 'merge';
    categoryMapping?: Record<string, string>;
  }): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }>;

  /** Get all tags with their usage statistics (including standalone tags and tags in use) */
  getAllTags(): Promise<Array<{ tag: string; count: number }>>;

  /** Add a standalone tag */
  addTag(tag: string): Promise<void>;

  /** Rename a tag */
  renameTag(oldTag: string, newTag: string): Promise<number>;

  /** Merge multiple tags into one */
  mergeTags(sourceTags: string[], targetTag: string): Promise<number>;

  /** Delete a tag (removes it from both standalone tags and all favorite items) */
  deleteTag(tag: string): Promise<number>;

  /** Reorder categories */
  reorderCategories(categoryIds: string[]): Promise<void>;

  /** Get category usage statistics */
  getCategoryUsage(categoryId: string): Promise<number>;

  /** Ensure default categories exist (only effective on first run) */
  ensureDefaultCategories(defaultCategories: Array<{
    name: string;
    description?: string;
    color: string;
  }>): Promise<void>;
}
