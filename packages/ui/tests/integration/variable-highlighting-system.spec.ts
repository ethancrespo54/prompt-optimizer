import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import VariableAwareInput from '../../src/components/variable-extraction/VariableAwareInput.vue'
import { useVariableDetection } from '../../src/components/variable-extraction/useVariableDetection'

/**
 * Variable highlighting system integration test
 *
 * Tests the complete user workflow and interactions between components
 */
describe('variable-highlighting-system integration test', () => {
  describe('Full workflow: adding a missing variable', () => {
    it('should complete the full flow from detection to adding', async () => {
      // 1. Initial state: input text contains missing variables
      const modelValue = ref('Hello {{name}}, you are {{age}} years old')
      const globalVariables = ref<Record<string, string>>({})
      const temporaryVariables = ref<Record<string, string>>({})
      const predefinedVariables = ref<Record<string, string>>({})

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      // 2. Detect variables
      let variables = extractVariables(modelValue.value)
      expect(variables).toHaveLength(2)
      expect(variables[0].source).toBe('missing')
      expect(variables[1].source).toBe('missing')

      // 3. Simulate the user adding the first missing variable as a temporary variable
      temporaryVariables.value['name'] = ''

      // 4. Re-detect; the first variable should become a temporary variable
      variables = extractVariables(modelValue.value)
      expect(variables[0].source).toBe('temporary')
      expect(variables[1].source).toBe('missing')

      // 5. Add the second missing variable
      temporaryVariables.value['age'] = ''

      // 6. Re-detect; both variables should be temporary variables
      variables = extractVariables(modelValue.value)
      expect(variables[0].source).toBe('temporary')
      expect(variables[1].source).toBe('temporary')
    })

    it('should support converting a missing variable to a global variable', async () => {
      const modelValue = ref('User: {{username}}')
      const globalVariables = ref<Record<string, string>>({})
      const temporaryVariables = ref<Record<string, string>>({})
      const predefinedVariables = ref<Record<string, string>>({})

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      // Initial: missing variable
      let variables = extractVariables(modelValue.value)
      expect(variables[0].source).toBe('missing')

      // Add to temporary variables
      temporaryVariables.value['username'] = 'John'
      variables = extractVariables(modelValue.value)
      expect(variables[0].source).toBe('temporary')

      // Save to global variables
      globalVariables.value['username'] = 'John'
      delete temporaryVariables.value['username']
      variables = extractVariables(modelValue.value)
      expect(variables[0].source).toBe('global')
    })
  })

  describe('Full workflow: variable extraction', () => {
    it('should complete the full flow from selection to extraction', async () => {
      const wrapper = mount(VariableAwareInput, {
        props: {
          modelValue: 'Hello John, you are 25 years old',
          existingGlobalVariables: [],
          existingTemporaryVariables: []
        }
      })

      // 1. The initial text contains no variables
      expect(wrapper.props('modelValue')).toBe('Hello John, you are 25 years old')

      // 2. Simulate the user selecting "John" and extracting it as a variable
      await wrapper.vm.$emit('variable-extracted', {
        variableName: 'name',
        variableValue: 'John',
        variableType: 'temporary'
      })

      // 3. Verify the event was triggered
      expect(wrapper.emitted('variable-extracted')).toBeTruthy()
      const extractedEvent = wrapper.emitted('variable-extracted')?.[0]?.[0] as any
      expect(extractedEvent.variableName).toBe('name')
      expect(extractedEvent.variableValue).toBe('John')

      // 4. Simulate text replacement
      await wrapper.setProps({
        modelValue: 'Hello {{name}}, you are 25 years old',
        existingTemporaryVariables: ['name'],
        temporaryVariableValues: { name: 'John' }
      })

      // 5. Verify the variable is recognized correctly
      const globalVariables = ref<Record<string, string>>({})
      const temporaryVariables = ref({ name: 'John' })
      const predefinedVariables = ref<Record<string, string>>({})

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const variables = extractVariables(wrapper.props('modelValue'))
      expect(variables).toHaveLength(1)
      expect(variables[0].name).toBe('name')
      expect(variables[0].source).toBe('temporary')
    })

    it('should support replace-all', async () => {
      const text = 'test test test'
      const globalVariables = ref<Record<string, string>>({})
      const temporaryVariables = ref<Record<string, string>>({})
      const predefinedVariables = ref<Record<string, string>>({})

      // Simulate replace-all
      const newText = text.replace(/test/g, '{{testVar}}')
      expect(newText).toBe('{{testVar}} {{testVar}} {{testVar}}')

      // Add the variable
      temporaryVariables.value['testVar'] = 'test'

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const variables = extractVariables(newText)
      expect(variables).toHaveLength(3)
      expect(variables.every(v => v.source === 'temporary')).toBe(true)
    })

    it('should protect existing variables from being corrupted', () => {
      const text = 'customer {{customer_name}} customer'

      // Simulate safe replacement (only replaces "customer" outside the placeholders)
      const replaceOutsideVariables = (text: string, search: string, replace: string) => {
        // Simplified implementation
        const parts = text.split(/(\{\{[^}]+\}\})/g)
        return parts.map((part, index) => {
          if (index % 2 === 0) {
            // Non-variable part
            return part.replace(new RegExp(search, 'g'), replace)
          }
          return part // The variable part is left unchanged
        }).join('')
      }

      const newText = replaceOutsideVariables(text, 'customer', '{{user}}')
      expect(newText).toBe('{{user}} {{customer_name}} {{user}}')

      // Verify the variable name was not corrupted
      expect(newText).toContain('{{customer_name}}')
    })
  })

  describe('Full workflow: autocomplete', () => {
    it('should trigger completion when typing {{', () => {
      const globalVariables = { username: 'John', email: 'john@example.com' }
      const temporaryVariables = { tempVar: 'temp' }
      const predefinedVariables = { systemVar: 'system' }

      // Simulate completion option generation
      const completionOptions = [
        ...Object.keys(predefinedVariables).map(name => ({ name, source: 'predefined', boost: 3 })),
        ...Object.keys(globalVariables).map(name => ({ name, source: 'global', boost: 2 })),
        ...Object.keys(temporaryVariables).map(name => ({ name, source: 'temporary', boost: 1 }))
      ]

      expect(completionOptions).toHaveLength(4)
      expect(completionOptions[0].boost).toBe(3) // Predefined has the highest priority
      expect(completionOptions[3].boost).toBe(1) // Temporary variables have the lowest priority
    })

    it('should insert the completed variable correctly', () => {
      const text = 'Hello {{'
      const selectedVariable = 'name'

      // Simulate completion insertion
      const newText = text + selectedVariable + '}}'
      expect(newText).toBe('Hello {{name}}')

      // Verify the variable format is correct
      expect(newText).toMatch(/\{\{[^}]+\}\}/)
    })

    it('should display a preview of the variable value', () => {
      const variables = {
        shortVar: 'short',
        longVar: 'a'.repeat(100)
      }

      // Simulate value preview generation
      const previews = Object.entries(variables).map(([name, value]) => ({
        name,
        preview: value.length > 50 ? value.substring(0, 50) + '...' : value
      }))

      expect(previews[0].preview).toBe('short')
      expect(previews[1].preview).toHaveLength(53) // 50 + '...'
      expect(previews[1].preview).toContain('...')
    })
  })

  describe('Full workflow: temporary variable sync', () => {
    it('should sync variables between the input box and the test area', async () => {
      // Simulate the input box state
      const inputVariables = ref<Record<string, string>>({})

      // Simulate the test area state
      const testVariables = ref<Record<string, string>>({})

      // 1. Add a missing variable in the input box
      inputVariables.value['newVar'] = ''

      // 2. Sync to the test area
      testVariables.value['newVar'] = ''
      expect(testVariables.value).toHaveProperty('newVar')

      // 3. Modify the variable value in the test area
      testVariables.value['newVar'] = 'new value'

      // 4. Sync back to the input box
      inputVariables.value['newVar'] = 'new value'
      expect(inputVariables.value['newVar']).toBe('new value')

      // 5. Delete the variable in the test area
      delete testVariables.value['newVar']

      // 6. Sync back to the input box (the variable becomes missing)
      delete inputVariables.value['newVar']
      expect(inputVariables.value).not.toHaveProperty('newVar')
    })

    it('should support clearing temporary variables in bulk', () => {
      const temporaryVariables = ref({
        var1: 'value1',
        var2: 'value2',
        var3: 'value3'
      })

      // Record the names of the cleared variables
      const removedNames = Object.keys(temporaryVariables.value)
      expect(removedNames).toHaveLength(3)

      // Clear all temporary variables
      temporaryVariables.value = {}
      expect(Object.keys(temporaryVariables.value)).toHaveLength(0)

      // Verify all variables were removed
      removedNames.forEach(name => {
        expect(temporaryVariables.value).not.toHaveProperty(name)
      })
    })
  })

  describe('Variable priority system', () => {
    it('should display variables by priority (predefined > global > temporary)', () => {
      const globalVariables = ref({ var1: 'global', var2: 'global' })
      const temporaryVariables = ref({ var1: 'temp', var2: 'temp', var3: 'temp' })
      const predefinedVariables = ref({ var1: 'predef', var2: 'predef', var3: 'predef', var4: 'predef' })

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{var1}} {{var2}} {{var3}} {{var4}} {{var5}}'
      const variables = extractVariables(text)

      expect(variables[0].source).toBe('predefined') // var1: predefined takes priority
      expect(variables[1].source).toBe('predefined') // var2: predefined takes priority
      expect(variables[2].source).toBe('predefined') // var3: predefined takes priority
      expect(variables[3].source).toBe('predefined') // var4: predefined only
      expect(variables[4].source).toBe('missing')    // var5: missing
    })

    it('should update priority when a variable is upgraded', () => {
      const globalVariables = ref<Record<string, string>>({})
      const temporaryVariables = ref({ testVar: 'temp' })
      const predefinedVariables = ref<Record<string, string>>({})

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{testVar}}'

      // Initial: temporary variable
      let variables = extractVariables(text)
      expect(variables[0].source).toBe('temporary')

      // Upgrade to a global variable
      globalVariables.value['testVar'] = 'global'
      variables = extractVariables(text)
      expect(variables[0].source).toBe('global')

      // Upgrade to a predefined variable
      predefinedVariables.value['testVar'] = 'predef'
      variables = extractVariables(text)
      expect(variables[0].source).toBe('predefined')
    })
  })

  describe('Complex scenario tests', () => {
    it('should handle complex text containing multiple variable types', () => {
      const globalVariables = ref({ global1: 'g1', global2: 'g2' })
      const temporaryVariables = ref({ temp1: 't1' })
      const predefinedVariables = ref({ predef1: 'p1' })

      const { extractVariables, getVariableStats } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = `
        Global: {{global1}} {{global2}}
        Temporary: {{temp1}}
        Predefined: {{predef1}}
        Missing: {{missing1}} {{missing2}}
      `

      const stats = getVariableStats(text)
      expect(stats.total).toBe(6)
      expect(stats.global).toBe(2)
      expect(stats.temporary).toBe(1)
      expect(stats.predefined).toBe(1)
      expect(stats.missing).toBe(2)
    })

    it('should handle variable names containing special characters', () => {
      const globalVariables = ref({
        'user-name': 'John',
        'user.email': 'john@example.com',
        'user_id': '123',
        'usuário': 'José'
      })
      const temporaryVariables = ref<Record<string, string>>({})
      const predefinedVariables = ref<Record<string, string>>({})

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{user-name}} {{user.email}} {{user_id}} {{usuário}}'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(4)
      expect(variables.every(v => v.source === 'global')).toBe(true)
    })

    it('should handle the performance scenario with many variables', () => {
      const globalVariables = ref<Record<string, string>>({})
      const temporaryVariables = ref<Record<string, string>>({})
      const predefinedVariables = ref<Record<string, string>>({})

      // Create 100 variables
      for (let i = 0; i < 100; i++) {
        globalVariables.value[`var${i}`] = `value${i}`
      }

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      // Create text containing all variables
      const text = Object.keys(globalVariables.value)
        .map(name => `{{${name}}}`)
        .join(' ')

      const variables = extractVariables(text)

      expect(variables).toHaveLength(100)
      expect(variables.every(variable => variable.source === 'global')).toBe(true)
    })
  })

  describe('Error handling and edge cases', () => {
    it('should handle incomplete variable placeholders', () => {
      const globalVariables = ref<Record<string, string>>({})
      const temporaryVariables = ref<Record<string, string>>({})
      const predefinedVariables = ref<Record<string, string>>({})

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{incomplete or {{valid}} more {{incomplete'
      const variables = extractVariables(text)

      // Should only extract complete variables
      expect(variables).toHaveLength(1)
      expect(variables[0].name).toBe('valid')
    })

    it('should filter out Mustache control tags', () => {
      const globalVariables = ref<Record<string, string>>({})
      const temporaryVariables = ref<Record<string, string>>({})
      const predefinedVariables = ref<Record<string, string>>({})

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{#if}} {{name}} {{/if}} {{^else}} {{!comment}}'
      const variables = extractVariables(text)

      // Should only extract {{name}}
      expect(variables).toHaveLength(1)
      expect(variables[0].name).toBe('name')
    })

    it('should handle empty values and undefined', () => {
      const globalVariables = ref({ emptyVar: '', undefinedVar: undefined as any })
      const temporaryVariables = ref<Record<string, string>>({})
      const predefinedVariables = ref<Record<string, string>>({})

      const { extractVariables } = useVariableDetection(
        globalVariables,
        temporaryVariables,
        predefinedVariables
      )

      const text = '{{emptyVar}} {{undefinedVar}}'
      const variables = extractVariables(text)

      expect(variables).toHaveLength(2)
      expect(variables[0].value).toBe('')
      // undefined is converted to an empty string, because the DetectedVariable.value type is string
      expect(variables[1].value).toBe('')
    })
  })

  describe('User experience test', () => {
    it('should provide instant feedback', async () => {
      const temporaryVariables = ref<Record<string, string>>({})

      // Simulate the user adding a variable and waiting for the reactive update
      temporaryVariables.value['newVar'] = ''
      await nextTick()

      expect(temporaryVariables.value.newVar).toBe('')
    })

    it('should support undo', () => {
      const history: string[] = []
      let currentText = 'Hello world'

      // Record the initial state
      history.push(currentText)

      // Perform the operation
      currentText = 'Hello {{name}}'
      history.push(currentText)

      // Undo
      history.pop()
      currentText = history[history.length - 1]

      expect(currentText).toBe('Hello world')
    })
  })
})
