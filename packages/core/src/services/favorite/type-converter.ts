import type { TagStatistics } from './types';

/**
 * Tag type conversion utilities
 * Handles tag data conversion between different formats in one place
 */
export class TagTypeConverter {
  private static readonly collator = new Intl.Collator(
    ['zh-Hans-u-co-pinyin', 'zh-Hans', 'zh', 'en'],
    { sensitivity: 'accent', numeric: true }
  );

  private static compareNames(a: string, b: string): number {
    try {
      return TagTypeConverter.collator.compare(a, b);
    } catch {
      return a.localeCompare(b);
    }
  }

  /**
   * Convert tag data returned by the API into TagStatistics format
   * @param apiData Tag data returned by the API { tag: string; count: number }[]
   * @returns Tag statistics data in TagStatistics[] format
   */
  static toTagStatistics(apiData: Array<{ tag: string; count: number }>): TagStatistics[] {
    return apiData.map(item => ({
      name: item.tag,
      count: item.count,
      lastUsed: undefined
    }));
  }

  /**
   * Convert TagStatistics back to the API format
   * @param stats Tag statistics data in TagStatistics[] format
   * @returns Tag data in API format { tag: string; count: number }[]
   */
  static fromTagStatistics(stats: TagStatistics[]): Array<{ tag: string; count: number }> {
    return stats.map(item => ({
      tag: item.name,
      count: item.count
    }));
  }

  /**
   * Convert tag data into the autocomplete option format
   * @param apiData Tag data returned by the API
   * @returns Autocomplete option format { label: string; value: string; count: number }[]
   */
  static toAutoCompleteOptions(apiData: Array<{ tag: string; count: number }>): Array<{
    label: string;
    value: string;
    count: number;
  }> {
    return apiData.map(item => ({
      label: `${item.tag} (${item.count})`,
      value: item.tag,
      count: item.count
    }));
  }

  /**
   * Convert tag data into a simple string array
   * @param apiData Tag data returned by the API
   * @returns Array of tag names
   */
  static toStringArray(apiData: Array<{ tag: string; count: number }>): string[] {
    return apiData.map(item => item.tag);
  }

  /**
   * Sort tags by usage count descending
   * @param tags Tag data
   * @returns Sorted tag data
   */
  static sortByCount<T extends { count: number }>(tags: T[]): T[] {
    return [...tags].sort((a, b) => b.count - a.count);
  }

  /**
   * Sort tags by name ascending
   * @param tags Tag data
   * @returns Sorted tag data
   */
  static sortByName(tags: TagStatistics[]): TagStatistics[] {
    return [...tags].sort((a, b) => TagTypeConverter.compareNames(a.name, b.name));
  }

  /**
   * Hybrid sort: usage count descending first, ties by name ascending
   * @param tags Tag data
   * @returns Sorted tag data
   */
  static sortByCountThenName(tags: TagStatistics[]): TagStatistics[] {
    return [...tags].sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return TagTypeConverter.compareNames(a.name, b.name);
    });
  }

  /**
   * Expose the name sorting rule so other modules can stay consistent
   */
  static compareTagNames(a: string, b: string): number {
    return TagTypeConverter.compareNames(a, b);
  }
}
