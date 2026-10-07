import { 
  ICompareService, 
  CompareResult, 
  CompareOptions, 
  TextFragment, 
  ChangeType 
} from './types';
import { CompareValidationError, CompareCalculationError } from './errors';
import { diffChars, diffWords, type Change } from 'diff';

/**
 * Default compare options
 */
const DEFAULT_OPTIONS: CompareOptions = {
  granularity: 'word',
  ignoreWhitespace: false,
  caseSensitive: true
};

/**
 * Text compare service implementation - uses the jsdiff library
 */
export class CompareService implements ICompareService {
  /**
   * Compare two texts
   */
  compareTexts(
    original: string,
    optimized: string,
    options?: Partial<CompareOptions>
  ): CompareResult {
    try {
      // Validate input
      this.validateInput(original, optimized);
      
      // Merge options
      const finalOptions = { ...DEFAULT_OPTIONS, ...options };
      
      // Perform the comparison
      const fragments = this.performTextComparison(original, optimized, finalOptions);
      
      // Generate statistics
      const summary = this.generateSummary(fragments);
      
      return {
        fragments,
        summary
      };
    } catch (error) {
      if (error instanceof CompareValidationError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CompareCalculationError(
        `Text comparison calculation failed: ${errorMessage}`
      );
    }
  }

  /**
   * Validate input parameters
   */
  private validateInput(original: string, optimized: string): void {
    if (typeof original !== 'string') {
      throw new CompareValidationError('Original text must be a string');
    }
    if (typeof optimized !== 'string') {
      throw new CompareValidationError('Optimized text must be a string');
    }
  }

  /**
   * Perform text comparison - uses jsdiff
   */
  private performTextComparison(
    original: string,
    optimized: string,
    options: CompareOptions
  ): TextFragment[] {
    let diffResult: Change[];

    // Preprocess the text according to the config
    let processedOriginal = original;
    let processedOptimized = optimized;

    if (options.ignoreWhitespace) {
      // Normalize whitespace
      processedOriginal = original.replace(/\s+/g, ' ').trim();
      processedOptimized = optimized.replace(/\s+/g, ' ').trim();
    }

    if (!options.caseSensitive) {
      processedOriginal = processedOriginal.toLowerCase();
      processedOptimized = processedOptimized.toLowerCase();
    }

    // Choose a different diff method based on granularity
    switch (options.granularity) {
      case 'char':
        diffResult = diffChars(processedOriginal, processedOptimized);
        break;
      case 'word':
      default:
        diffResult = diffWords(processedOriginal, processedOptimized);
        break;
    }

    // Convert to our TextFragment format
    return this.convertDiffResultToFragments(diffResult, original);
  }

  /**
   * Convert jsdiff results to our TextFragment format
   */
  private convertDiffResultToFragments(
    diffResult: Change[],
    originalText: string
  ): TextFragment[] {
    const fragments: TextFragment[] = [];
    let fragmentIndex = 0;

    for (const change of diffResult) {
      let changeType: ChangeType;

      if (change.added) {
        changeType = ChangeType.ADDED;
      } else if (change.removed) {
        changeType = ChangeType.REMOVED;
      } else {
        changeType = ChangeType.UNCHANGED;
      }

      // Ensure the text content comes from the original input (preserving the original format)
      let text = change.value;
      
      // For unchanged parts, use the original text to preserve formatting
      if (changeType === ChangeType.UNCHANGED) {
        // Find the corresponding part in the original text
        const position = this.findTextPosition(text, originalText);
        if (position !== -1) {
          text = originalText.substring(position, position + text.length);
        }
      }

      fragments.push({
        text,
        type: changeType,
        index: fragmentIndex++
      });
    }

    return this.mergeConsecutiveFragments(fragments);
  }

  /**
   * Find the position of specific content in the text
   */
  private findTextPosition(searchText: string, sourceText: string): number {
    // Simple lookup implementation
    return sourceText.indexOf(searchText);
  }

  /**
   * Merge consecutive fragments of the same type
   */
  private mergeConsecutiveFragments(fragments: TextFragment[]): TextFragment[] {
    if (fragments.length === 0) return fragments;
    
    const merged: TextFragment[] = [];
    let current = { ...fragments[0] };
    
    for (let i = 1; i < fragments.length; i++) {
      const fragment = fragments[i];
      
      if (fragment.type === current.type) {
        // Merge fragments of the same type
        current.text += fragment.text;
      } else {
        // Add the current fragment and start a new one
        merged.push(current);
        current = { ...fragment, index: merged.length };
      }
    }
    
    merged.push(current);
    
    return merged;
  }

  /**
   * Generate statistics
   */
  private generateSummary(fragments: TextFragment[]) {
    const summary = {
      additions: 0,
      deletions: 0,
      unchanged: 0
    };
    
    fragments.forEach(fragment => {
      switch (fragment.type) {
        case ChangeType.ADDED:
          summary.additions++;
          break;
        case ChangeType.REMOVED:
          summary.deletions++;
          break;
        case ChangeType.UNCHANGED:
          summary.unchanged++;
          break;
      }
    });
    
    return summary;
  }
}

/**
 * Create a text compare service instance
 * @returns Text compare service instance
 */
export function createCompareService(): ICompareService {
  return new CompareService();
} 