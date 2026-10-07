import { describe, it, expect, beforeEach } from 'vitest'
import { mergeOverrides } from '../../../src/services/model/parameter-utils'
import type { UnifiedParameterDefinition } from '../../../src/services/model/parameter-schema'

describe('Custom parameter migration test', () => {
  const schema: UnifiedParameterDefinition[] = [
    {
      name: 'temperature',
      type: 'number',
      minValue: 0,
      maxValue: 2,
      defaultValue: 1
    },
    {
      name: 'max_tokens',
      type: 'integer',
      minValue: 1,
      maxValue: 40000
    }
  ]

  describe('Backward compatibility with the legacy customParamOverrides format', () => {
    it('should merge customParamOverrides and paramOverrides', () => {
      // Simulate the legacy data format: built-in params in paramOverrides, custom params in customParamOverrides
      const paramOverrides = { temperature: 0.7 }
      const customParamOverrides = { custom_flag: 'test_value', api_version: '2024-01' }

      const merged = mergeOverrides({
        schema,
        includeDefaults: false,
        customOverrides: customParamOverrides,
        requestOverrides: paramOverrides
      })

      // Verify the built-in params are handled correctly
      expect(merged.temperature).toBe(0.7)

      // Verify the custom params are not lost
      expect(merged.custom_flag).toBe('test_value')
      expect(merged.api_version).toBe('2024-01')
    })

    it('requestOverrides should override customOverrides', () => {
      const customParamOverrides = { custom_flag: 'old_value' }
      const paramOverrides = { custom_flag: 'new_value', temperature: 0.8 }

      const merged = mergeOverrides({
        schema,
        includeDefaults: false,
        customOverrides: customParamOverrides,
        requestOverrides: paramOverrides
      })

      // requestOverrides has higher priority
      expect(merged.custom_flag).toBe('new_value')
      expect(merged.temperature).toBe(0.8)
    })

    it('should filter out custom params with empty values', () => {
      const customParamOverrides = {
        valid_param: 'value',
        empty_string: '',
        null_value: null,
        undefined_value: undefined
      }

      const merged = mergeOverrides({
        schema,
        includeDefaults: false,
        customOverrides: customParamOverrides as any
      })

      // Only non-empty values should be kept
      expect(merged.valid_param).toBe('value')
      expect(merged.empty_string).toBeUndefined()
      expect(merged.null_value).toBeUndefined()
      expect(merged.undefined_value).toBeUndefined()
    })

    it('should reject dangerous custom param key names', () => {
      const customParamOverrides = {
        '__proto__': 'dangerous',
        'apiKey': 'should_reject',
        'safe_param': 'ok'
      }

      const merged = mergeOverrides({
        schema,
        includeDefaults: false,
        customOverrides: customParamOverrides
      })

      // Dangerous params should be filtered (they do not exist as own properties)
      expect(Object.hasOwn(merged, '__proto__')).toBe(false)
      expect(Object.hasOwn(merged, 'apiKey')).toBe(false)

      // Safe params should be kept
      expect(merged.safe_param).toBe('ok')
    })
  })

  describe('LLM Service runtime config preparation', () => {
    it('should simulate the behavior of prepareRuntimeConfig', () => {
      // Simulate a legacy-format TextModelConfig
      const modelConfig = {
        id: 'test',
        name: 'Test Model',
        enabled: true,
        providerMeta: { id: 'test', name: 'Test' } as any,
        modelMeta: {
          id: 'test-model',
          name: 'Test Model',
          providerId: 'test',
          capabilities: {},
          parameterDefinitions: schema
        } as any,
        connectionConfig: {},
        paramOverrides: { temperature: 0.7, max_tokens: 1000 },
        customParamOverrides: {
          custom_header: 'X-Custom-Value',
          extra_param: 'important_value'
        }
      }

      // Simulate the prepareRuntimeConfig logic
      const mergedOverrides = mergeOverrides({
        schema: modelConfig.modelMeta.parameterDefinitions,
        includeDefaults: false,
        customOverrides: modelConfig.customParamOverrides,
        requestOverrides: modelConfig.paramOverrides
      })

      // Verify the runtime config contains all params
      expect(mergedOverrides.temperature).toBe(0.7)
      expect(mergedOverrides.max_tokens).toBe(1000)
      expect(mergedOverrides.custom_header).toBe('X-Custom-Value')
      expect(mergedOverrides.extra_param).toBe('important_value')
    })

    it('should handle an already-migrated new-format config', () => {
      // Simulate an already-migrated config: all params are in paramOverrides
      const modelConfig = {
        id: 'test',
        name: 'Test Model',
        enabled: true,
        providerMeta: { id: 'test', name: 'Test' } as any,
        modelMeta: {
          id: 'test-model',
          name: 'Test Model',
          providerId: 'test',
          capabilities: {},
          parameterDefinitions: schema
        } as any,
        connectionConfig: {},
        paramOverrides: {
          temperature: 0.7,
          max_tokens: 1000,
          custom_header: 'X-Custom-Value',
          extra_param: 'important_value'
        },
        customParamOverrides: undefined // Migrated
      }

      const mergedOverrides = mergeOverrides({
        schema: modelConfig.modelMeta.parameterDefinitions,
        includeDefaults: false,
        customOverrides: modelConfig.customParamOverrides,
        requestOverrides: modelConfig.paramOverrides
      })

      // The new format should also work correctly
      expect(mergedOverrides.temperature).toBe(0.7)
      expect(mergedOverrides.max_tokens).toBe(1000)
      expect(mergedOverrides.custom_header).toBe('X-Custom-Value')
      expect(mergedOverrides.extra_param).toBe('important_value')
    })
  })
})
