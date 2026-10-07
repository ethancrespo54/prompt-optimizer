/**
 * Aggregated variable management composable
 *
 * Description:
 * - Aggregates three types of variables: predefined, global, and temporary
 * - Handles variable priority automatically: temporary > global > predefined
 * - Provides a unified variable access interface
 * - Reactive updates: a change in any layer is reflected automatically
 *
 * Variable priority (high to low):
 * 1. Temporary variables (temporary) - sub-mode level: persisted to the session for Pro/Image; in-memory only for Basic
 * 2. Global variables (global) - persisted storage, kept across sessions
 * 3. Predefined variables (predefined) - built into the system, not modifiable
 *
 * Use cases:
 * - Preview feature: needs to show the substitution results of all available variables
 * - Variable detection: check which variables are missing and what their sources are
 * - Unified variable access: no need to care about the variable source, just get the final value
 */

import { computed, type ComputedRef, type Ref } from 'vue'
import { useTemporaryVariables } from './useTemporaryVariables'
import type { VariableManagerHooks } from '../prompt/useVariableManager'
import { PREDEFINED_VARIABLES } from '../../types/variable'

/**
 * Variable source type
 */
export type AggregatedVariableSource = 'predefined' | 'global' | 'temporary'

/**
 * Variables grouped by source
 */
export interface VariablesBySource {
  /** Predefined variables (built into the system) */
  predefined: Record<string, string>
  /** Global variables (persisted) */
  global: Record<string, string>
  /** Temporary variables (session level) */
  temporary: Record<string, string>
}

/**
 * Aggregated variable manager interface
 */
export interface AggregatedVariablesManager {
  /** All aggregated variables (merged by priority) */
  readonly allVariables: ComputedRef<Record<string, string>>

  /** Variables grouped by source */
  readonly variablesBySource: ComputedRef<VariablesBySource>

  /** Query the variable source */
  getVariableSource: (name: string) => AggregatedVariableSource | null

  /** Get the variable value (by priority) */
  getVariable: (name: string) => string | undefined

  /** Check whether a variable exists in any source */
  hasVariable: (name: string) => boolean

  /** List all variable names */
  listVariableNames: () => string[]
}

/**
 * Use the aggregated variable manager
 *
 * Features:
 * - Automatically aggregates the three layers of variables
 * - Priority handled automatically
 * - Reactive updates
 * - Provides source queries
 *
 * @param variableManager Global variable manager (from useVariableManager)
 * @param predefinedVariables Predefined variables (optional, defaults to the system built-ins)
 * @returns Aggregated variable manager
 *
 * @example
 * ```typescript
 * // Use in a component
 * const variableManager = useVariableManager(services)
 * const aggregatedVars = useAggregatedVariables(variableManager)
 *
 * // Get all variables (aggregated automatically)
 * const allVars = aggregatedVars.allVariables.value
 *
 * // Query the variable source
 * const source = aggregatedVars.getVariableSource('userName')
 * // Returns: 'temporary' | 'global' | 'predefined' | null
 *
 * // Check whether a variable exists
 * if (aggregatedVars.hasVariable('userName')) {
 *   console.log('Variable exists')
 * }
 * ```
 */
export function useAggregatedVariables(
  variableManager?: VariableManagerHooks,
  predefinedVariables?: Record<string, string>
): AggregatedVariablesManager {

  // Get the temporary variable manager
  const tempVars = useTemporaryVariables()

  // Predefined variables (system built-ins or custom)
  const predefinedVarsMap = computed<Record<string, string>>(() => {
    if (predefinedVariables) {
      return predefinedVariables
    }

    const map: Record<string, string> = {}

    // Prefer taking the value from the variableManager's allVariables, to keep the dynamic context
    const resolved = variableManager?.allVariables?.value || {}
    PREDEFINED_VARIABLES.forEach(varName => {
      if (resolved[varName] !== undefined) {
        map[varName] = resolved[varName]
      } else {
        map[varName] = ''
      }
    })

    return map
  })

  // Global variables
  const globalVarsMap = computed<Record<string, string>>(() => {
    if (!variableManager) return {}
    return variableManager.customVariables?.value || {}
  })

  // Temporary variables
  const temporaryVarsMap = computed<Record<string, string>>(() => {
    return tempVars.listVariables()
  })

  /**
   * Variables grouped by source
   */
  const variablesBySource = computed<VariablesBySource>(() => ({
    predefined: predefinedVarsMap.value,
    global: globalVarsMap.value,
    temporary: temporaryVarsMap.value
  }))

  /**
   * Aggregate all variables (merged by priority)
   *
   * Priority: temporary > global > predefined
   * Later ones override earlier variables with the same name
   */
  const allVariables = computed<Record<string, string>>(() => {
    return {
      ...predefinedVarsMap.value,  // Lowest priority
      ...globalVarsMap.value,       // Medium priority
      ...temporaryVarsMap.value     // Highest priority
    }
  })

  /**
   * Query the variable source
   * @param name Variable name
   * @returns The variable source, or null if it does not exist
   */
  const getVariableSource = (name: string): AggregatedVariableSource | null => {
    // Check from the highest priority to the lowest
    if (name in temporaryVarsMap.value) {
      return 'temporary'
    }
    if (name in globalVarsMap.value) {
      return 'global'
    }
    if (name in predefinedVarsMap.value) {
      return 'predefined'
    }
    return null
  }

  /**
   * Get the variable value (by priority)
   * @param name Variable name
   * @returns The variable value, or undefined if it does not exist
   */
  const getVariable = (name: string): string | undefined => {
    return allVariables.value[name]
  }

  /**
   * Check whether a variable exists in any source
   * @param name Variable name
   * @returns Whether it exists
   */
  const hasVariable = (name: string): boolean => {
    return name in allVariables.value
  }

  /**
   * List all variable names
   * @returns Array of all variable names
   */
  const listVariableNames = (): string[] => {
    return Object.keys(allVariables.value)
  }

  return {
    allVariables,
    variablesBySource,
    getVariableSource,
    getVariable,
    hasVariable,
    listVariableNames
  }
}
