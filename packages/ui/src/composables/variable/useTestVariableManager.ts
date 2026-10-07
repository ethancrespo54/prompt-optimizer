/**
 * Test variable management composable
 *
 * Used for variable management in the test panel, including UI interaction logic
 */

import { ref, computed, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'

import { VARIABLE_VALIDATION, getVariableNameValidationError } from '../../types/variable'

interface TestVariable {
  value: string
  timestamp: number
}

export interface TestVariableManagerOptions {
  /** Global variables (persisted) */
  globalVariables: Ref<Record<string, string>>
  /** Predefined variables (built in) */
  predefinedVariables: Ref<Record<string, string>>
  /** Temporary variables (synced from outside) */
  temporaryVariables: Ref<Record<string, string>>
  /** Variable value change callback */
  onVariableChange?: (name: string, value: string) => void
  /** Save-to-global callback */
  onSaveToGlobal?: (name: string, value: string) => void
  /** Delete variable callback */
  onVariableRemove?: (name: string) => void
  /** Clear-all-variables callback */
  onVariablesClear?: () => void
}

export function useTestVariableManager(options: TestVariableManagerOptions) {
  const { t } = useI18n()
  const message = useMessage()

  const hasOwn = (obj: Record<string, unknown>, key: string) =>
    Object.prototype.hasOwnProperty.call(obj, key)

  // Add variable dialog state
  const showAddVariableDialog = ref(false)
  const newVariableName = ref('')
  const newVariableValue = ref('')
  const newVariableNameError = ref('')

  // Internal test variables (with timestamps)
  const testVariables = ref<Record<string, TestVariable>>({})

  // Watch external temporary variable changes
  watch(
    () => options.temporaryVariables.value,
    (newVars) => {
      const newVarNames = new Set(Object.keys(newVars))
      for (const name of Object.keys(testVariables.value)) {
        if (!newVarNames.has(name)) {
          delete testVariables.value[name]
        }
      }

      for (const [name, value] of Object.entries(newVars)) {
        if (!testVariables.value[name]) {
          testVariables.value[name] = { value, timestamp: Date.now() }
        } else {
          testVariables.value[name].value = value
        }
      }
    },
    { deep: true, immediate: true }
  )

  // Merge the three layers of variables (priority: global < temporary < predefined)
  const mergedVariables = computed(() => {
    const testVarsFlat: Record<string, string> = {}
    for (const [name, data] of Object.entries(testVariables.value)) {
      testVarsFlat[name] = data.value
    }

    return {
      ...options.globalVariables.value,
      ...testVarsFlat,
      ...options.predefinedVariables.value,
    }
  })

  // Variable list sorted by time
  const sortedVariables = computed(() => {
    return Object.entries(testVariables.value)
      .sort((a, b) => b[1].timestamp - a[1].timestamp)
      .map(([name]) => name)
  })

  // Get the variable source
  const getVariableSource = (
    varName: string
  ): 'predefined' | 'test' | 'global' | 'empty' => {
    // Use key existence (not truthiness) because empty-string values are valid.
    if (hasOwn(options.predefinedVariables.value, varName)) return 'predefined'
    if (hasOwn(testVariables.value as unknown as Record<string, unknown>, varName)) {
      return 'test'
    }
    if (hasOwn(options.globalVariables.value, varName)) return 'global'
    return 'empty'
  }

  // Get the variable display value
  const getVariableDisplayValue = (varName: string): string => {
    return mergedVariables.value[varName] || ''
  }

  // Get the variable placeholder
  const getVariablePlaceholder = (varName: string): string => {
    if (hasOwn(options.predefinedVariables.value, varName)) {
      return t('test.variables.inputPlaceholder') + ` (${t('variables.source.predefined')})`
    }
    // In the temporary variables panel, a name may exist in both temporary and global.
    // Temporary values override global ones, so avoid misleading "(global)" placeholders.
    if (hasOwn(testVariables.value as unknown as Record<string, unknown>, varName)) {
      if (hasOwn(options.globalVariables.value, varName)) {
        return t('test.variables.inputPlaceholder') + ` (${t('test.variables.overridesGlobal')})`
      }
      return t('test.variables.inputPlaceholder')
    }
    if (hasOwn(options.globalVariables.value, varName)) {
      return t('test.variables.inputPlaceholder') + ` (${t('variables.source.global')})`
    }
    return t('test.variables.inputPlaceholder')
  }

  // Validate the variable name
  const validateVariableName = (name: string): string => {
    if (!name) return ''

    const trimmedName = name.trim()
    if (!trimmedName) return ''

    const baseError = getVariableNameValidationError(trimmedName)
    if (baseError) {
      switch (baseError) {
        case 'required':
          return t('variableExtraction.validation.required')
        case 'tooLong':
          return t('variableExtraction.validation.tooLong', { max: VARIABLE_VALIDATION.MAX_NAME_LENGTH })
        case 'forbiddenPrefix':
          return t('variableExtraction.validation.forbiddenPrefix')
        case 'noNumberStart':
          return t('variableExtraction.validation.noNumberStart')
        case 'reservedName':
          return t('variableExtraction.validation.reservedName')
        case 'invalidCharacters':
          return t('variableExtraction.validation.invalidCharacters')
      }
    }

    // Prevent creating a temporary variable that would be shadowed by predefined variables.
    if (hasOwn(options.predefinedVariables.value, trimmedName)) {
      return t('variableExtraction.validation.predefinedVariable')
    }

    if (testVariables.value[trimmedName]) {
      return t('variableExtraction.validation.duplicateVariable')
    }

    return ''
  }

  // Validate the new variable name
  const validateNewVariableName = () => {
    const name = newVariableName.value.trim()
    newVariableNameError.value = validateVariableName(name)
    return !newVariableNameError.value
  }

  // Variable value change
  const handleVariableValueChange = (varName: string, value: string) => {
    if (testVariables.value[varName]) {
      testVariables.value[varName].value = value
    } else {
      testVariables.value[varName] = { value, timestamp: Date.now() }
    }
    options.onVariableChange?.(varName, value)
  }

  // Add a variable
  const handleAddVariable = () => {
    if (!validateNewVariableName()) {
      if (!newVariableName.value.trim()) {
        message.warning(t('test.variables.nameRequired'))
      }
      return false
    }

    const name = newVariableName.value.trim()
    handleVariableValueChange(name, newVariableValue.value)
    message.success(t('test.variables.addSuccess'))

    newVariableName.value = ''
    newVariableValue.value = ''
    newVariableNameError.value = ''
    showAddVariableDialog.value = false
    return true
  }

  // Delete a variable
  const handleDeleteVariable = (varName: string) => {
    delete testVariables.value[varName]

    // Prefer explicit remove callback; fallback to onVariableChange(name, '') for legacy callers.
    if (options.onVariableRemove) {
      options.onVariableRemove(varName)
    } else {
      options.onVariableChange?.(varName, '')
    }

    message.success(t('test.variables.deleteSuccess', { name: varName }))
  }

  // Clear all variables
  const handleClearAllVariables = () => {
    const removedNames = Object.keys(testVariables.value)
    testVariables.value = {}

    // Prefer explicit clear callback; otherwise best-effort remove for callers.
    if (options.onVariablesClear) {
      options.onVariablesClear()
    } else if (options.onVariableRemove) {
      removedNames.forEach((name) => options.onVariableRemove?.(name))
    } else {
      removedNames.forEach((name) => options.onVariableChange?.(name, ''))
    }

    message.success(t('test.variables.clearSuccess'))
  }

  // Save to global
  const handleSaveToGlobal = (varName: string) => {
    const varData = testVariables.value[varName]
    if (!varData || !varData.value.trim()) {
      message.warning(t('test.variables.emptyValueWarning'))
      return
    }

    if (!options.onSaveToGlobal) return

    try {
      options.onSaveToGlobal(varName, varData.value)
      message.success(t('test.variables.savedToGlobal'))
    } catch (err) {
      console.warn('[useTestVariableManager] onSaveToGlobal failed:', err)

      const errMessage = err instanceof Error ? err.message : ''
      if (/not\s+ready/i.test(errMessage)) {
        message.error(t('variableExtraction.managerNotReady'))
      } else {
        message.error(t('variableExtraction.saveFailed', { name: varName }))
      }
    }
  }

  // Get all variable values
  const getVariableValues = () => {
    return { ...mergedVariables.value }
  }

  // Set a variable value
  const setVariableValues = (values: Record<string, string>) => {
    for (const [name, value] of Object.entries(values)) {
      options.onVariableChange?.(name, value)
    }
  }

  return {
    // State
    showAddVariableDialog,
    newVariableName,
    newVariableValue,
    newVariableNameError,
    sortedVariables,
    mergedVariables,

    // Methods
    getVariableSource,
    getVariableDisplayValue,
    getVariablePlaceholder,
    validateNewVariableName,
    handleVariableValueChange,
    handleAddVariable,
    handleDeleteVariable,
    handleClearAllVariables,
    handleSaveToGlobal,
    getVariableValues,
    setVariableValues,
  }
}

export type TestVariableManager = ReturnType<typeof useTestVariableManager>
