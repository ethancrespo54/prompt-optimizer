import type { PromptRecordType } from '../history/types';

/**
 * Function mode mapping interface
 * Corresponds to the three-level classification system in FavoritePrompt
 */
export interface FunctionModeMapping {
  /** Function mode (first-level category) */
  functionMode: 'basic' | 'context' | 'image';
  /** Optimization mode (second-level category, only for basic/context modes) */
  optimizationMode?: 'system' | 'user';
  /** Image sub-mode (second-level category, only for image mode) */
  imageSubMode?: 'text2image' | 'image2image';
}

/**
 * Type mapping utility class
 * Responsible for mapping history record types (PromptRecordType) to favorite function mode categories
 */
export class TypeMapper {
  /**
   * Map from a history record type to a function mode category
   * @param recordType History record type
   * @returns Function mode mapping
   */
  static mapFromRecordType(recordType: PromptRecordType): FunctionModeMapping {
    // Image mode mapping
    if (recordType === 'imageOptimize' || recordType === 'contextImageOptimize' || recordType === 'imageIterate') {
      return {
        functionMode: 'image',
        imageSubMode: 'text2image' // Defaults to text-to-image mode
      };
    }

    if (recordType === 'text2imageOptimize') {
      return {
        functionMode: 'image',
        imageSubMode: 'text2image'
      };
    }

    if (recordType === 'image2imageOptimize') {
      return {
        functionMode: 'image',
        imageSubMode: 'image2image'
      };
    }

    // Context mode mapping (context)
    if (recordType === 'conversationMessageOptimize' || recordType === 'contextIterate') {
      return {
        functionMode: 'context',
        optimizationMode: 'system'
      };
    }

    if (recordType === 'contextUserOptimize') {
      return {
        functionMode: 'context',
        optimizationMode: 'user'
      };
    }

    // Basic mode mapping (basic)
    if (recordType === 'optimize' || recordType === 'iterate') {
      return {
        functionMode: 'basic',
        optimizationMode: 'system'
      };
    }

    if (recordType === 'userOptimize') {
      return {
        functionMode: 'basic',
        optimizationMode: 'user'
      };
    }

    // Test types fall back to basic system mode
    if (recordType === 'test') {
      return {
        functionMode: 'basic',
        optimizationMode: 'system'
      };
    }

    // Fallback: unknown types fall back to basic system mode
    console.warn(`[TypeMapper] Unknown record type: ${recordType}, falling back to basic/system`);
    return {
      functionMode: 'basic',
      optimizationMode: 'system'
    };
  }

  /**
   * Validate the completeness and legality of a function mode mapping
   * @param mapping Function mode mapping
   * @returns Whether it is valid
   */
  static validateMapping(mapping: Partial<FunctionModeMapping>): boolean {
    // Function mode is required
    if (!mapping.functionMode) {
      return false;
    }

    // Check that the function mode value is valid
    if (!['basic', 'context', 'image'].includes(mapping.functionMode)) {
      return false;
    }

    // Basic mode and context mode must have an optimization mode
    if (mapping.functionMode === 'basic' || mapping.functionMode === 'context') {
      if (!mapping.optimizationMode) {
        return false;
      }
      if (!['system', 'user'].includes(mapping.optimizationMode)) {
        return false;
      }
      // These two modes should not have an imageSubMode
      if (mapping.imageSubMode) {
        return false;
      }
    }

    // Image mode must have an image sub-mode
    if (mapping.functionMode === 'image') {
      if (!mapping.imageSubMode) {
        return false;
      }
      if (!['text2image', 'image2image'].includes(mapping.imageSubMode)) {
        return false;
      }
      // Image mode should not have an optimizationMode
      if (mapping.optimizationMode) {
        return false;
      }
    }

    return true;
  }

  /**
   * Infer the corresponding history record types from a function mode mapping
   * Mainly used for reverse mapping and validation
   * @param mapping Function mode mapping
   * @returns Possible history record types
   */
  static inferRecordTypes(mapping: FunctionModeMapping): PromptRecordType[] {
    const { functionMode, optimizationMode, imageSubMode } = mapping;

    // Basic mode
    if (functionMode === 'basic') {
      if (optimizationMode === 'system') {
        return ['optimize', 'iterate'];
      }
      if (optimizationMode === 'user') {
        return ['userOptimize'];
      }
    }

    // Context mode
    if (functionMode === 'context') {
      if (optimizationMode === 'system') {
        return ['conversationMessageOptimize', 'contextIterate'];
      }
      if (optimizationMode === 'user') {
        return ['contextUserOptimize'];
      }
    }

    // Image mode
    if (functionMode === 'image') {
      if (imageSubMode === 'text2image') {
        return ['imageOptimize', 'contextImageOptimize', 'imageIterate', 'text2imageOptimize'];
      }
      if (imageSubMode === 'image2image') {
        return ['image2imageOptimize'];
      }
    }

    return [];
  }
}
