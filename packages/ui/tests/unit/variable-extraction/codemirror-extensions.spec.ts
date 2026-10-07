import { describe, it, expect, vi } from 'vitest'
import {
  variableHighlighter,
  variableAutocompletion,
  missingVariableTooltip,
  createThemeExtension,
  createVariableCompletionOption,
  type VariableDetectionLabels
} from '../../../src/components/variable-extraction/codemirror-extensions'
import type { DetectedVariable } from '../../../src/components/variable-extraction/useVariableDetection'

describe('codemirror-extensions', () => {
  describe('variableHighlighter', () => {
    it('should create the highlight decorator plugin', () => {
      const getVariables = vi.fn().mockReturnValue([])
      const plugin = variableHighlighter(getVariables)

      expect(plugin).toBeDefined()
      expect(typeof plugin).toBe('object')
    })

    it('should not call getVariables immediately when creating the plugin', () => {
      const mockVariables: DetectedVariable[] = [
        { name: 'var1', source: 'global', value: 'value1', from: 0, to: 8 }
      ]

      const getVariables = vi.fn().mockReturnValue(mockVariables)
      variableHighlighter(getVariables)

      expect(getVariables).not.toHaveBeenCalled()
    })

    it('should create plugins for variables from different sources', () => {
      const sources: Array<DetectedVariable['source']> = ['global', 'temporary', 'predefined', 'missing']

      sources.forEach(source => {
        const mockVariables: DetectedVariable[] = [
          { name: 'test', source, value: 'value', from: 0, to: 8 }
        ]

        const getVariables = vi.fn().mockReturnValue(mockVariables)
        const plugin = variableHighlighter(getVariables)

        expect(plugin).toBeDefined()
      })
    })
  })

  describe('variableAutocompletion', () => {
    const mockLabels: VariableDetectionLabels = {
      sourceGlobal: 'Global variable',
      sourceTemporary: 'Temporary variable',
      sourcePredefined: 'Predefined variable',
      missingVariable: 'Missing variable',
      addToTemporary: 'Add to temporary variables',
      emptyValue: '(empty)',
      valuePreview: (value: string) => `Value: ${value}`
    }

    it('should create the autocomplete extension', () => {
      const extension = variableAutocompletion({}, {}, {}, mockLabels)

      expect(extension).toBeDefined()
      expect(typeof extension).toBe('object')
    })

    it('should handle a config with variables', () => {
      const globalVariables = { username: 'John', email: 'john@example.com' }
      const temporaryVariables = { tempVar1: 'temp value 1' }
      const predefinedVariables = { lastOptimizedPrompt: 'system value' }

      const extension = variableAutocompletion(
        globalVariables,
        temporaryVariables,
        predefinedVariables,
        mockLabels
      )

      expect(extension).toBeDefined()
    })

    it('should handle an empty variable set', () => {
      const extension = variableAutocompletion({}, {}, {}, mockLabels)

      expect(extension).toBeDefined()
    })
  })

  describe('createVariableCompletionOption', () => {
    it('should create completion options with the correct properties', () => {
      const option = createVariableCompletionOption({
        name: 'testVar',
        source: 'global',
        valuePreview: 'preview value',
        boost: 2
      })

      expect(option.label).toBe('testVar')
      expect(option.boost).toBe(2)
      expect((option as any).displayLabel).toBe('testVar: preview value')
      expect((option as any).sourceType).toBe('global')
    })

    it('should set the correct completion options for different sources', () => {
      const sources: Array<'global' | 'temporary' | 'predefined'> = ['global', 'temporary', 'predefined']

      sources.forEach(source => {
        const option = createVariableCompletionOption({
          name: 'var',
          source,
          valuePreview: 'value',
          boost: 1
        })

        expect(option).toBeDefined()
        expect((option as any).sourceType).toBe(source)
      })
    })

    it('the apply function should exist', () => {
      const option = createVariableCompletionOption({
        name: 'testVar',
        source: 'global',
        valuePreview: 'value',
        boost: 1
      })

      expect(option.apply).toBeDefined()
      expect(typeof option.apply).toBe('function')
    })
  })

  describe('missingVariableTooltip', () => {
    const mockLabels: VariableDetectionLabels = {
      sourceGlobal: 'Global variable',
      sourceTemporary: 'Temporary variable',
      sourcePredefined: 'Predefined variable',
      missingVariable: 'This variable is not defined yet',
      addToTemporary: 'Add to temporary variables',
      emptyValue: '(empty)',
      valuePreview: (value: string) => `Value: ${value}`
    }

    it('should create the hover tooltip extension', () => {
      const onAddVariable = vi.fn()
      const extension = missingVariableTooltip(onAddVariable, mockLabels)

      expect(extension).toBeDefined()
      expect(typeof extension).toBe('object')
    })

    it('should accept a custom theme config', () => {
      const onAddVariable = vi.fn()
      const customTheme = {
        backgroundColor: '#ffffff',
        borderColor: '#cccccc',
        borderRadius: '8px',
        textColor: '#333333',
        primaryColor: '#007bff',
        primaryColorHover: '#0056b3'
      }

      const extension = missingVariableTooltip(onAddVariable, mockLabels, customTheme)

      expect(extension).toBeDefined()
    })

    it('should not call the callback function when creating the extension', () => {
      const onAddVariable = vi.fn()
      missingVariableTooltip(onAddVariable, mockLabels)

      expect(onAddVariable).not.toHaveBeenCalled()
    })
  })

  describe('createThemeExtension', () => {
    const mockThemeVars = {
      cardColor: '#ffffff',
      textColor1: '#333333',
      textColor3: '#999999',
      primaryColor: '#18a058',
      primaryColorSuppl: '#36ad6a',
      hoverColor: '#f5f5f5'
    }

    it('should create the theme extension', () => {
      const extension = createThemeExtension(mockThemeVars)

      expect(extension).toBeDefined()
      expect(typeof extension).toBe('object')
    })

    it('should use custom theme variables', () => {
      const customThemeVars = {
        ...mockThemeVars,
        primaryColor: '#ff0000',
        cardColor: '#000000'
      }

      const extension = createThemeExtension(customThemeVars)

      expect(extension).toBeDefined()
    })
  })

  describe('Integration test', () => {
    it('all extension factory functions should be callable without throwing', () => {
      const mockLabels: VariableDetectionLabels = {
        sourceGlobal: 'Global variable',
        sourceTemporary: 'Temporary variable',
        sourcePredefined: 'Predefined variable',
        missingVariable: 'Missing variable',
        addToTemporary: 'Add to temporary variables',
        emptyValue: '(empty)',
        valuePreview: (value: string) => `Value: ${value}`
      }

      const mockThemeVars = {
        cardColor: '#ffffff',
        textColor1: '#333333',
        textColor3: '#999999',
        primaryColor: '#18a058',
        primaryColorSuppl: '#36ad6a',
        hoverColor: '#f5f5f5'
      }

      const getVariables = vi.fn().mockReturnValue([])
      const onAddVariable = vi.fn()

      // Verify all factory functions work correctly
      expect(() => variableHighlighter(getVariables)).not.toThrow()
      expect(() => variableAutocompletion({}, {}, {}, mockLabels)).not.toThrow()
      expect(() => missingVariableTooltip(onAddVariable, mockLabels)).not.toThrow()
      expect(() => createThemeExtension(mockThemeVars)).not.toThrow()
    })
  })
})
