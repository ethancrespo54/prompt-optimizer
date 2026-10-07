/**
 * Text change type
 */
export enum ChangeType {
  UNCHANGED = 'unchanged',
  ADDED = 'added',
  REMOVED = 'removed'
}

/**
 * Text fragment
 */
export interface TextFragment {
  text: string;
  type: ChangeType;
  index: number;
}

/**
 * Compare result
 */
export interface CompareResult {
  fragments: TextFragment[];
  summary: {
    additions: number;
    deletions: number;
    unchanged: number;
  };
}

/**
 * Compare options
 */
export interface CompareOptions {
  /** Compare granularity: word (word level), char (character level) */
  granularity: 'word' | 'char';
  /** Whether to ignore whitespace */
  ignoreWhitespace: boolean;
  /** Whether to be case sensitive */
  caseSensitive: boolean;
}

/**
 * Text compare service interface
 */
export interface ICompareService {
  /**
   * Compare two texts
   * @param original Original text
   * @param optimized Optimized text
   * @param options Compare options
   * @returns Compare result
   */
  compareTexts(
    original: string,
    optimized: string,
    options?: Partial<CompareOptions>
  ): CompareResult;
} 