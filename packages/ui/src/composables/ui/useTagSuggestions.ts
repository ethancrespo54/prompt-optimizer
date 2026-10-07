import { ref, computed, inject, type Ref } from 'vue'

import type { AppServices } from '../../types/services';
import { TagTypeConverter } from '@prompt-optimizer/core';

export interface TagSuggestion {
  label: string;
  value: string;
  count: number;
}

/**
 * Tag suggestions composable
 * Provides tag autocomplete based on tag usage in existing favorites
 */
export function useTagSuggestions() {
  const services = inject<Ref<AppServices | null>>('services');
  const allTags = ref<TagSuggestion[]>([]);
  const loading = ref(false);

  /**
   * Load all tag statistics data
   */
  const loadTags = async () => {
    if (!services?.value?.favoriteManager) {
      return;
    }

    loading.value = true;
    try {
      const tagStats = await services.value.favoriteManager.getAllTags();
      // Use the unified type converter to convert to the autocomplete option format
      allTags.value = TagTypeConverter.toAutoCompleteOptions(tagStats);
    } catch (error) {
      console.error('Failed to load tags:', error);
      allTags.value = [];
    } finally {
      loading.value = false;
    }
  };

  /**
   * Filter tag suggestions based on the input query
   * @param query Query string
   * @param excludeTags Tags to exclude (already selected tags)
   * @returns Filtered list of tag suggestions
   */
  const filterTags = (query: string, excludeTags: string[] = []): TagSuggestion[] => {
    if (!query) {
      // If there is no input, return all unselected tags, sorted by usage count
      return allTags.value
        .filter(tag => !excludeTags.includes(tag.value))
        .sort((a, b) => b.count - a.count);
    }

    // Fuzzy search matching
    const lowerQuery = query.toLowerCase();
    return allTags.value
      .filter(tag => {
        // Exclude already selected tags
        if (excludeTags.includes(tag.value)) {
          return false;
        }
        // Contains the query string
        return tag.value.toLowerCase().includes(lowerQuery);
      })
      .sort((a, b) => {
        // Prefer prefix matches
        const aStartsWith = a.value.toLowerCase().startsWith(lowerQuery);
        const bStartsWith = b.value.toLowerCase().startsWith(lowerQuery);
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        // Then sort by usage count
        return b.count - a.count;
      });
  };

  /**
   * Get popular tags (the top N most used)
   * @param limit Limit on the number returned
   * @param excludeTags Tags to exclude
   */
  const getPopularTags = computed(() => {
    return (limit = 10, excludeTags: string[] = []): TagSuggestion[] => {
      return allTags.value
        .filter(tag => !excludeTags.includes(tag.value))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    };
  });

  /**
   * Get recently used tags (currently the same as popular tags; can be optimized by timestamp in the future)
   * @param limit Limit on the number returned
   * @param excludeTags Tags to exclude
   */
  const getRecentTags = computed(() => {
    return (limit = 10, excludeTags: string[] = []): TagSuggestion[] => {
      // TODO: in the future this logic can be optimized based on the favorites' update time
      return getPopularTags.value(limit, excludeTags);
    };
  });

  return {
    allTags,
    loading,
    loadTags,
    filterTags,
    getPopularTags,
    getRecentTags
  };
}
