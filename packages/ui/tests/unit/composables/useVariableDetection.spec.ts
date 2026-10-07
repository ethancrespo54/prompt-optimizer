import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useVariableDetection } from '../../../src/components/variable-extraction/useVariableDetection'

const refRecord = (initial: Record<string, string> = {}) => ref<Record<string, string>>(initial)

describe('useVariableDetection', () => {
  describe('Basic variable extraction', () => {
    it('should extract a single variable', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = 'Hello {{name}}'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(1)
      expect(variables[0].name).toBe('name')
      expect(variables[0].from).toBe(6)
      expect(variables[0].to).toBe(14)
    })

    it('should extract multiple variables', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = 'Hello {{name}}, you are {{age}} years old'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(2)
      expect(variables[0].name).toBe('name')
      expect(variables[1].name).toBe('age')
    })

    it('should extract variables from nested text', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = 'User: {{user}}\nEmail: {{email}}\nPhone: {{phone}}'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(3)
      expect(variables.map(v => v.name)).toEqual(['user', 'email', 'phone'])
    })

    it('should handle multiple occurrences of the same variable correctly', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{name}} is {{name}}'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(2)
      expect(variables[0].name).toBe('name')
      expect(variables[1].name).toBe('name')
      expect(variables[0].from).toBe(0)
      expect(variables[1].from).toBe(12)
    })

    it('should support placeholders with spaces such as {{ foo }}', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = 'Hello {{ name }}'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(1)
      expect(variables[0].name).toBe('name')
      expect(text.substring(variables[0].from, variables[0].to)).toBe('{{ name }}')
    })

    it('should ignore variable names that start with a digit', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = 'Hello {{1name}} {{name}}'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(1)
      expect(variables[0].name).toBe('name')
    })

    it('should ignore Mustache unescaped control tags {{&foo}}', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = 'Hello {{&foo}} {{bar}}'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(1)
      expect(variables[0].name).toBe('bar')
    })
  })

  describe('Variable classification logic', () => {
    it('should identify global variables', () => {
      const globalVariables = refRecord({ username: 'John' })
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = 'Hello {{username}}'
      const variables = extractVariables(text)

      expect(variables[0].source).toBe('global')
      expect(variables[0].value).toBe('John')
    })

    it('should identify temporary variables', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord({ tempVar: 'temp value' })
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = 'Test {{tempVar}}'
      const variables = extractVariables(text)

      expect(variables[0].source).toBe('temporary')
      expect(variables[0].value).toBe('temp value')
    })

    it('should identify predefined variables', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord({ systemVar: 'system value' })

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = 'System {{systemVar}}'
      const variables = extractVariables(text)

      expect(variables[0].source).toBe('predefined')
      expect(variables[0].value).toBe('system value')
    })

    it('should identify missing variables', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = 'Missing {{unknownVar}}'
      const variables = extractVariables(text)

      expect(variables[0].source).toBe('missing')
      expect(variables[0].value).toBe('')
    })

    it('should classify variables by priority (predefined > global > temporary)', () => {
      const globalVariables = refRecord({ var1: 'global' })
      const temporaryVariables = refRecord({ var1: 'temporary', var2: 'temp' })
      const predefinedVariables = refRecord({ var1: 'predefined', var2: 'predef', var3: 'system' })

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{var1}} {{var2}} {{var3}} {{var4}}'
      const variables = extractVariables(text)

      expect(variables[0].source).toBe('predefined') // var1: predefined takes priority
      expect(variables[1].source).toBe('predefined') // var2: predefined takes priority
      expect(variables[2].source).toBe('predefined') // var3: predefined only
      expect(variables[3].source).toBe('missing')    // var4: missing
    })

    it('should handle variables with empty values correctly', () => {
      const globalVariables = refRecord({ emptyVar: '' })
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{emptyVar}}'
      const variables = extractVariables(text)

      expect(variables[0].source).toBe('global')
      expect(variables[0].value).toBe('')
    })
  })

  describe('Edge case handling', () => {
    it('should handle an empty string', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const variables = extractVariables('')
      expect(variables).toHaveLength(0)
    })

    it('should handle text without variables', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = 'This is plain text without variables'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(0)
    })

    it('should ignore incomplete placeholders', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{incomplete or {{name}}'
      const variables = extractVariables(text)

      // Should only extract the complete {{name}}
      expect(variables).toHaveLength(1)
      expect(variables[0].name).toBe('name')
    })

    it('should filter out Mustache control tags', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{#if}} {{name}} {{/if}} {{^else}} {{!comment}} {{>partial}}'
      const variables = extractVariables(text)

      // Should only extract {{name}}
      expect(variables).toHaveLength(1)
      expect(variables[0].name).toBe('name')
    })

    it('should support variable names containing hyphens', () => {
      const globalVariables = refRecord({ 'user-name': 'John' })
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{user-name}}'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(1)
      expect(variables[0].name).toBe('user-name')
      expect(variables[0].source).toBe('global')
    })

    it('should support variable names containing dots', () => {
      const globalVariables = refRecord({ 'user.email': 'john@example.com' })
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{user.email}}'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(1)
      expect(variables[0].name).toBe('user.email')
      expect(variables[0].source).toBe('global')
    })

    it('should support variable names containing underscores', () => {
      const globalVariables = refRecord({ user_id: '123' })
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{user_id}}'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(1)
      expect(variables[0].name).toBe('user_id')
      expect(variables[0].source).toBe('global')
    })

    it('should support Unicode variable names', () => {
      const globalVariables = refRecord({ 'usuário': 'José' })
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{usuário}}'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(1)
      expect(variables[0].name).toBe('usuário')
      expect(variables[0].source).toBe('global')
    })
  })

  describe('Position accuracy', () => {
    it('should return the correct from/to positions', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = 'Start {{var1}} middle {{var2}} end'
      const variables = extractVariables(text)

      expect(variables[0].from).toBe(6)
      expect(variables[0].to).toBe(14)
      expect(variables[1].from).toBe(22)
      expect(variables[1].to).toBe(30)

      // Verify the text at the positions
      expect(text.substring(variables[0].from, variables[0].to)).toBe('{{var1}}')
      expect(text.substring(variables[1].from, variables[1].to)).toBe('{{var2}}')
    })

    it('should return independent positions for multiple identical variables', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{name}} and {{name}} and {{name}}'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(3)
      expect(variables[0].from).toBe(0)
      expect(variables[1].from).toBe(13)
      expect(variables[2].from).toBe(26)

      // Every position should be different
      expect(variables[0].from).not.toBe(variables[1].from)
      expect(variables[1].from).not.toBe(variables[2].from)
    })
  })

  describe('Helper methods', () => {
    it('missingVariables should filter missing variables correctly', () => {
      const globalVariables = refRecord({ global1: 'value1' })
      const temporaryVariables = refRecord({ temp1: 'value2' })
      const predefinedVariables = refRecord({ predef1: 'value3' })

      const { missingVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{global1}} {{temp1}} {{predef1}} {{missing1}} {{missing2}}'
      const missing = missingVariables.value(text)

      expect(missing).toHaveLength(2)
      expect(missing[0].name).toBe('missing1')
      expect(missing[1].name).toBe('missing2')
    })

    it('getVariableStats should return correct statistics', () => {
      const globalVariables = refRecord({ global1: 'v1', global2: 'v2' })
      const temporaryVariables = refRecord({ temp1: 'v3' })
      const predefinedVariables = refRecord({ predef1: 'v4' })

      const { getVariableStats } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{global1}} {{global2}} {{temp1}} {{predef1}} {{missing1}} {{missing2}}'
      const stats = getVariableStats(text)

      expect(stats.total).toBe(6)
      expect(stats.global).toBe(2)
      expect(stats.temporary).toBe(1)
      expect(stats.predefined).toBe(1)
      expect(stats.missing).toBe(2)
    })

    it('getVariableStats should handle empty text', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { getVariableStats } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const stats = getVariableStats('')

      expect(stats.total).toBe(0)
      expect(stats.global).toBe(0)
      expect(stats.temporary).toBe(0)
      expect(stats.predefined).toBe(0)
      expect(stats.missing).toBe(0)
    })
  })

  describe('Reactive updates', () => {
    it('should react to changes in variable data', () => {
      const globalVariables = refRecord()
      const temporaryVariables = refRecord()
      const predefinedVariables = refRecord()

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{dynamicVar}}'

      // Initial state: missing variable
      let variables = extractVariables(text)
      expect(variables[0].source).toBe('missing')

      // Add to global variables
      globalVariables.value = { dynamicVar: 'new value' }
      variables = extractVariables(text)
      expect(variables[0].source).toBe('global')
      expect(variables[0].value).toBe('new value')

      // Add to predefined variables (higher priority)
      predefinedVariables.value = { dynamicVar: 'predefined value' }
      variables = extractVariables(text)
      expect(variables[0].source).toBe('predefined')
      expect(variables[0].value).toBe('predefined value')
    })
  })
})
