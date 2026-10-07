import { describe, it, expect } from 'vitest';
import { TypeMapper, type FunctionModeMapping } from '../../../src/services/favorite/type-mapper';
import type { PromptRecordType } from '../../../src/services/history/types';

/**
 * TypeMapper unit test
 * Tests the mapping logic from history record types to function modes
 */
describe('TypeMapper', () => {
  describe('mapFromRecordType - basic mode mapping', () => {
    it('should map optimize to basic/system', () => {
      const result = TypeMapper.mapFromRecordType('optimize');
      expect(result).toEqual({
        functionMode: 'basic',
        optimizationMode: 'system'
      });
    });

    it('should map iterate to basic/system', () => {
      const result = TypeMapper.mapFromRecordType('iterate');
      expect(result).toEqual({
        functionMode: 'basic',
        optimizationMode: 'system'
      });
    });

    it('should map userOptimize to basic/user', () => {
      const result = TypeMapper.mapFromRecordType('userOptimize');
      expect(result).toEqual({
        functionMode: 'basic',
        optimizationMode: 'user'
      });
    });

    it('should map test to basic/system', () => {
      const result = TypeMapper.mapFromRecordType('test');
      expect(result).toEqual({
        functionMode: 'basic',
        optimizationMode: 'system'
      });
    });
  });

  describe('mapFromRecordType - context mode mapping', () => {
    it('should map conversationMessageOptimize to context/system', () => {
      const result = TypeMapper.mapFromRecordType('conversationMessageOptimize');
      expect(result).toEqual({
        functionMode: 'context',
        optimizationMode: 'system'
      });
    });

    it('should map contextIterate to context/system', () => {
      const result = TypeMapper.mapFromRecordType('contextIterate');
      expect(result).toEqual({
        functionMode: 'context',
        optimizationMode: 'system'
      });
    });

    it('should map contextUserOptimize to context/user', () => {
      const result = TypeMapper.mapFromRecordType('contextUserOptimize');
      expect(result).toEqual({
        functionMode: 'context',
        optimizationMode: 'user'
      });
    });
  });

  describe('mapFromRecordType - image mode mapping', () => {
    it('should map imageOptimize to image/text2image', () => {
      const result = TypeMapper.mapFromRecordType('imageOptimize');
      expect(result).toEqual({
        functionMode: 'image',
        imageSubMode: 'text2image'
      });
    });

    it('should map contextImageOptimize to image/text2image', () => {
      const result = TypeMapper.mapFromRecordType('contextImageOptimize');
      expect(result).toEqual({
        functionMode: 'image',
        imageSubMode: 'text2image'
      });
    });

    it('should map imageIterate to image/text2image', () => {
      const result = TypeMapper.mapFromRecordType('imageIterate');
      expect(result).toEqual({
        functionMode: 'image',
        imageSubMode: 'text2image'
      });
    });

    it('should map text2imageOptimize to image/text2image', () => {
      const result = TypeMapper.mapFromRecordType('text2imageOptimize');
      expect(result).toEqual({
        functionMode: 'image',
        imageSubMode: 'text2image'
      });
    });

    it('should map image2imageOptimize to image/image2image', () => {
      const result = TypeMapper.mapFromRecordType('image2imageOptimize');
      expect(result).toEqual({
        functionMode: 'image',
        imageSubMode: 'image2image'
      });
    });
  });

  describe('mapFromRecordType - unknown type handling', () => {
    it('should map an unknown type to basic/system and log a warning', () => {
      // Use a spy on console.warn
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = TypeMapper.mapFromRecordType('unknown' as PromptRecordType);

      expect(result).toEqual({
        functionMode: 'basic',
        optimizationMode: 'system'
      });
      expect(warnSpy).toHaveBeenCalledWith(
        '[TypeMapper] Unknown record type: unknown, falling back to basic/system'
      );

      warnSpy.mockRestore();
    });
  });

  describe('validateMapping - valid mapping validation', () => {
    it('should accept a valid basic/system mapping', () => {
      const mapping: FunctionModeMapping = {
        functionMode: 'basic',
        optimizationMode: 'system'
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(true);
    });

    it('should accept a valid basic/user mapping', () => {
      const mapping: FunctionModeMapping = {
        functionMode: 'basic',
        optimizationMode: 'user'
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(true);
    });

    it('should accept a valid context/system mapping', () => {
      const mapping: FunctionModeMapping = {
        functionMode: 'context',
        optimizationMode: 'system'
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(true);
    });

    it('should accept a valid context/user mapping', () => {
      const mapping: FunctionModeMapping = {
        functionMode: 'context',
        optimizationMode: 'user'
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(true);
    });

    it('should accept a valid image/text2image mapping', () => {
      const mapping: FunctionModeMapping = {
        functionMode: 'image',
        imageSubMode: 'text2image'
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(true);
    });

    it('should accept a valid image/image2image mapping', () => {
      const mapping: FunctionModeMapping = {
        functionMode: 'image',
        imageSubMode: 'image2image'
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(true);
    });
  });

  describe('validateMapping - invalid mapping validation', () => {
    it('should reject a mapping missing functionMode', () => {
      const mapping: Partial<FunctionModeMapping> = {
        optimizationMode: 'system'
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(false);
    });

    it('should reject an invalid functionMode value', () => {
      const mapping = {
        functionMode: 'invalid' as any,
        optimizationMode: 'system'
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(false);
    });

    it('should reject basic mode missing optimizationMode', () => {
      const mapping: Partial<FunctionModeMapping> = {
        functionMode: 'basic'
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(false);
    });

    it('should reject context mode missing optimizationMode', () => {
      const mapping: Partial<FunctionModeMapping> = {
        functionMode: 'context'
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(false);
    });

    it('should reject an invalid optimizationMode value in basic mode', () => {
      const mapping = {
        functionMode: 'basic' as const,
        optimizationMode: 'invalid' as any
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(false);
    });

    it('should reject basic mode containing imageSubMode', () => {
      const mapping = {
        functionMode: 'basic' as const,
        optimizationMode: 'system' as const,
        imageSubMode: 'text2image' as const
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(false);
    });

    it('should reject context mode containing imageSubMode', () => {
      const mapping = {
        functionMode: 'context' as const,
        optimizationMode: 'system' as const,
        imageSubMode: 'text2image' as const
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(false);
    });

    it('should reject image mode missing imageSubMode', () => {
      const mapping: Partial<FunctionModeMapping> = {
        functionMode: 'image'
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(false);
    });

    it('should reject an invalid imageSubMode value in image mode', () => {
      const mapping = {
        functionMode: 'image' as const,
        imageSubMode: 'invalid' as any
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(false);
    });

    it('should reject image mode containing optimizationMode', () => {
      const mapping = {
        functionMode: 'image' as const,
        imageSubMode: 'text2image' as const,
        optimizationMode: 'system' as const
      };
      expect(TypeMapper.validateMapping(mapping)).toBe(false);
    });
  });

  describe('inferRecordTypes - reverse inference', () => {
    it('should infer optimize and iterate from basic/system', () => {
      const mapping: FunctionModeMapping = {
        functionMode: 'basic',
        optimizationMode: 'system'
      };
      const result = TypeMapper.inferRecordTypes(mapping);
      expect(result).toEqual(['optimize', 'iterate']);
    });

    it('should infer userOptimize from basic/user', () => {
      const mapping: FunctionModeMapping = {
        functionMode: 'basic',
        optimizationMode: 'user'
      };
      const result = TypeMapper.inferRecordTypes(mapping);
      expect(result).toEqual(['userOptimize']);
    });

    it('should infer conversationMessageOptimize and contextIterate from context/system', () => {
      const mapping: FunctionModeMapping = {
        functionMode: 'context',
        optimizationMode: 'system'
      };
      const result = TypeMapper.inferRecordTypes(mapping);
      expect(result).toEqual(['conversationMessageOptimize', 'contextIterate']);
    });

    it('should infer contextUserOptimize from context/user', () => {
      const mapping: FunctionModeMapping = {
        functionMode: 'context',
        optimizationMode: 'user'
      };
      const result = TypeMapper.inferRecordTypes(mapping);
      expect(result).toEqual(['contextUserOptimize']);
    });

    it('should infer all text-to-image types from image/text2image', () => {
      const mapping: FunctionModeMapping = {
        functionMode: 'image',
        imageSubMode: 'text2image'
      };
      const result = TypeMapper.inferRecordTypes(mapping);
      expect(result).toEqual([
        'imageOptimize',
        'contextImageOptimize',
        'imageIterate',
        'text2imageOptimize'
      ]);
    });

    it('should infer image2imageOptimize from image/image2image', () => {
      const mapping: FunctionModeMapping = {
        functionMode: 'image',
        imageSubMode: 'image2image'
      };
      const result = TypeMapper.inferRecordTypes(mapping);
      expect(result).toEqual(['image2imageOptimize']);
    });

    it('should return an empty array for an invalid mapping', () => {
      const mapping = {
        functionMode: 'basic' as const,
        optimizationMode: undefined as any
      };
      const result = TypeMapper.inferRecordTypes(mapping);
      expect(result).toEqual([]);
    });
  });

  describe('Mapping and validation completeness test', () => {
    it('the results of mapping every PromptRecordType should be valid', () => {
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

      allTypes.forEach(type => {
        const mapping = TypeMapper.mapFromRecordType(type);
        expect(TypeMapper.validateMapping(mapping)).toBe(true);
      });
    });

    it('mapping and reverse inference should be consistent', () => {
      const testCases: Array<{
        recordType: PromptRecordType;
        mapping: FunctionModeMapping;
      }> = [
        {
          recordType: 'optimize',
          mapping: { functionMode: 'basic', optimizationMode: 'system' }
        },
        {
          recordType: 'userOptimize',
          mapping: { functionMode: 'basic', optimizationMode: 'user' }
        },
        {
          recordType: 'conversationMessageOptimize',
          mapping: { functionMode: 'context', optimizationMode: 'system' }
        },
        {
          recordType: 'contextUserOptimize',
          mapping: { functionMode: 'context', optimizationMode: 'user' }
        },
        {
          recordType: 'text2imageOptimize',
          mapping: { functionMode: 'image', imageSubMode: 'text2image' }
        },
        {
          recordType: 'image2imageOptimize',
          mapping: { functionMode: 'image', imageSubMode: 'image2image' }
        }
      ];

      testCases.forEach(({ recordType, mapping }) => {
        // Forward mapping
        const mappedResult = TypeMapper.mapFromRecordType(recordType);
        expect(mappedResult).toEqual(mapping);

        // Reverse inference
        const inferredTypes = TypeMapper.inferRecordTypes(mapping);
        expect(inferredTypes).toContain(recordType);
      });
    });
  });
});
