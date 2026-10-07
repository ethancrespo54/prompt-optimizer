import { describe, it, expect } from 'vitest';
import { TagTypeConverter } from '../../../src/services/favorite/type-converter';
import type { TagStatistics } from '../../../src/services/favorite/types';

/**
 * Tag type converter unit test
 */
describe('TagTypeConverter', () => {
  describe('toTagStatistics', () => {
    it('should convert API format to TagStatistics format', () => {
      const apiData = [
        { tag: 'tag 1', count: 5 },
        { tag: 'tag 2', count: 3 }
      ];

      const result = TagTypeConverter.toTagStatistics(apiData);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'tag 1',
        count: 5,
        lastUsed: undefined
      });
      expect(result[1]).toEqual({
        name: 'tag 2',
        count: 3,
        lastUsed: undefined
      });
    });

    it('should handle an empty array', () => {
      const result = TagTypeConverter.toTagStatistics([]);
      expect(result).toEqual([]);
    });
  });

  describe('fromTagStatistics', () => {
    it('should convert TagStatistics format to API format', () => {
      const stats: TagStatistics[] = [
        { name: 'tag 1', count: 5, lastUsed: undefined },
        { name: 'tag 2', count: 3, lastUsed: Date.now() }
      ];

      const result = TagTypeConverter.fromTagStatistics(stats);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ tag: 'tag 1', count: 5 });
      expect(result[1]).toEqual({ tag: 'tag 2', count: 3 });
    });

    it('should handle an empty array', () => {
      const result = TagTypeConverter.fromTagStatistics([]);
      expect(result).toEqual([]);
    });
  });

  describe('toAutoCompleteOptions', () => {
    it('should convert to the autocomplete option format', () => {
      const apiData = [
        { tag: 'tag 1', count: 5 },
        { tag: 'tag 2', count: 3 }
      ];

      const result = TagTypeConverter.toAutoCompleteOptions(apiData);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        label: 'tag 1 (5)',
        value: 'tag 1',
        count: 5
      });
      expect(result[1]).toEqual({
        label: 'tag 2 (3)',
        value: 'tag 2',
        count: 3
      });
    });

    it('should handle tags with a usage count of 0', () => {
      const apiData = [{ tag: 'unused tag', count: 0 }];

      const result = TagTypeConverter.toAutoCompleteOptions(apiData);

      expect(result[0]).toEqual({
        label: 'unused tag (0)',
        value: 'unused tag',
        count: 0
      });
    });
  });

  describe('toStringArray', () => {
    it('should convert to a string array', () => {
      const apiData = [
        { tag: 'tag 1', count: 5 },
        { tag: 'tag 2', count: 3 },
        { tag: 'tag 3', count: 0 }
      ];

      const result = TagTypeConverter.toStringArray(apiData);

      expect(result).toEqual(['tag 1', 'tag 2', 'tag 3']);
    });

    it('should handle an empty array', () => {
      const result = TagTypeConverter.toStringArray([]);
      expect(result).toEqual([]);
    });
  });

  describe('sortByCount', () => {
    it('should sort by usage count descending', () => {
      const tags = [
        { count: 3 },
        { count: 10 },
        { count: 1 },
        { count: 5 }
      ];

      const result = TagTypeConverter.sortByCount(tags);

      expect(result.map(t => t.count)).toEqual([10, 5, 3, 1]);
    });

    it('should not modify the original array', () => {
      const tags = [
        { count: 3 },
        { count: 1 }
      ];

      const result = TagTypeConverter.sortByCount(tags);

      expect(tags.map(t => t.count)).toEqual([3, 1]);
      expect(result.map(t => t.count)).toEqual([3, 1]);
    });
  });

  describe('sortByName', () => {
    it('should sort by tag name ascending', () => {
      const tags: TagStatistics[] = [
        { name: 'Zebra', count: 1 },
        { name: 'Apple', count: 2 },
        { name: 'Banana', count: 3 }
      ];

      const result = TagTypeConverter.sortByName(tags);

      expect(result.map(t => t.name)).toEqual(['Apple', 'Banana', 'Zebra']);
    });

    it('should sort names alphabetically', () => {
      const tags: TagStatistics[] = [
        { name: 'Programming', count: 1 },
        { name: 'Design', count: 2 },
        { name: 'Testing', count: 3 }
      ];

      const result = TagTypeConverter.sortByName(tags);

      // Sorted alphabetically
      expect(result.map(t => t.name)).toEqual(['Design', 'Programming', 'Testing']);
    });

    it('should not modify the original array', () => {
      const tags: TagStatistics[] = [
        { name: 'B', count: 1 },
        { name: 'A', count: 2 }
      ];

      const result = TagTypeConverter.sortByName(tags);

      expect(tags.map(t => t.name)).toEqual(['B', 'A']);
      expect(result.map(t => t.name)).toEqual(['A', 'B']);
    });
  });

  describe('sortByCountThenName', () => {
    it('should sort by usage count descending first, then by name ascending', () => {
      const tags: TagStatistics[] = [
        { name: 'Zebra', count: 5 },
        { name: 'Apple', count: 5 },
        { name: 'Banana', count: 3 },
        { name: 'Cat', count: 5 }
      ];

      const result = TagTypeConverter.sortByCountThenName(tags);

      // count=5 sorted by name ascending: Apple, Cat, Zebra
      // count=3: Banana
      expect(result.map(t => t.name)).toEqual(['Apple', 'Cat', 'Zebra', 'Banana']);
    });

    it('should handle the case where all usage counts are the same', () => {
      const tags: TagStatistics[] = [
        { name: 'C', count: 1 },
        { name: 'A', count: 1 },
        { name: 'B', count: 1 }
      ];

      const result = TagTypeConverter.sortByCountThenName(tags);

      expect(result.map(t => t.name)).toEqual(['A', 'B', 'C']);
    });

    it('should not modify the original array', () => {
      const tags: TagStatistics[] = [
        { name: 'B', count: 2 },
        { name: 'A', count: 1 }
      ];

      const result = TagTypeConverter.sortByCountThenName(tags);

      expect(tags[0].name).toBe('B');
      expect(result[0].name).toBe('B');
      expect(result[1].name).toBe('A');
    });
  });
});
