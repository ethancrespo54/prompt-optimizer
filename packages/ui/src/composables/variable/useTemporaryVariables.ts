/**
 * Temporary variable management composable
 *
 * Features:
 * - Pro/Image: persisted per sub-mode session store (survives refresh; isolated between sub-modes)
 * - Basic: keeps the old behavior, in-memory only (lost on refresh)
 * - The external interface stays unchanged (compatible with old callers)
 * - The state is held by a Pinia store underneath
 */
 
import { readonly, computed, type Ref } from 'vue'
import { storeToRefs, getActivePinia } from 'pinia'
import { useTemporaryVariablesStore } from '../../stores/temporaryVariables'
import { useSessionManager } from '../../stores/session/useSessionManager'
import { useProVariableSession } from '../../stores/session/useProVariableSession'
import { useProMultiMessageSession } from '../../stores/session/useProMultiMessageSession'
import { useImageText2ImageSession } from '../../stores/session/useImageText2ImageSession'
import { useImageImage2ImageSession } from '../../stores/session/useImageImage2ImageSession'

/**
 * Temporary variable manager interface
 */
export interface TemporaryVariablesManager {
  /** Temporary variable storage (read-only) */
  readonly temporaryVariables: Readonly<Ref<Record<string, string>>>

  /** Set a temporary variable */
  setVariable: (name: string, value: string) => void

  /** Get the value of a temporary variable */
  getVariable: (name: string) => string | undefined

  /** Delete a temporary variable */
  deleteVariable: (name: string) => void

  /** Clear all temporary variables */
  clearAll: () => void

  /** Check whether a variable exists */
  hasVariable: (name: string) => boolean

  /** List all temporary variables */
  listVariables: () => Record<string, string>

  /** Set variables in batch */
  batchSet: (variables: Record<string, string>) => void

  /** Delete variables in batch */
  batchDelete: (names: string[]) => void
}

/**
 * Use the temporary variable manager
 *
 * ⚠️ Precondition:
 * It must be called after `installPinia(app)` has run at the app entry.
 * Using it in a non-component context (such as a pure function / service layer) throws an error.
 *
 * @throws {Error} If Pinia is not installed or there is no active pinia instance
 *
 * @example
 * ```typescript
 * // ✅ Correct: use it in a component or setup function
 * export default defineComponent({
 *   setup() {
 *     const tempVars = useTemporaryVariables()
 *     tempVars.setVariable('name', 'value')
 *   }
 * })
 *
 * // ❌ Wrong: use it at module top level or in a pure function
 * const tempVars = useTemporaryVariables()  // Throws an error
 * ```
 */
export function useTemporaryVariables(): TemporaryVariablesManager {
  // ✅ Codex suggestion: explicitly detect an active pinia
  // Avoid try-catch swallowing a config error, which would cause "silently not taking effect"
  const activePinia = getActivePinia()
  if (!activePinia) {
    throw new Error(
      '[useTemporaryVariables] Pinia not installed or no active pinia instance. ' +
      'Make sure you have called installPinia(app) before using this composable, ' +
      'and you are calling it within a component setup or after app is mounted.'
    )
  }

  const globalStore = useTemporaryVariablesStore()
  const { temporaryVariables: globalTempVars } = storeToRefs(globalStore)

  const sessionManager = useSessionManager()
  const proVariableSession = useProVariableSession()
  const proMultiSession = useProMultiMessageSession()
  const imageText2ImageSession = useImageText2ImageSession()
  const imageImage2ImageSession = useImageImage2ImageSession()

  const { temporaryVariables: proVariableTempVars } = storeToRefs(proVariableSession)
  const { temporaryVariables: proMultiTempVars } = storeToRefs(proMultiSession)
  const { temporaryVariables: imageText2ImageTempVars } = storeToRefs(imageText2ImageSession)
  const { temporaryVariables: imageImage2ImageTempVars } = storeToRefs(imageImage2ImageSession)

  const activeSubModeKey = computed(() => sessionManager.getActiveSubModeKey())

  const getActiveSessionTempRef = () => {
    switch (activeSubModeKey.value) {
      case 'pro-variable':
        return proVariableTempVars
      case 'pro-multi':
        return proMultiTempVars
      case 'image-text2image':
        return imageText2ImageTempVars
      case 'image-image2image':
        return imageImage2ImageTempVars
      default:
        return null
    }
  }

  const temporaryVariables = computed<Record<string, string>>(() => {
    const sessionRef = getActiveSessionTempRef()
    return sessionRef ? sessionRef.value : globalTempVars.value
  })

  const hasOwn = (obj: Record<string, unknown>, key: string) =>
    Object.prototype.hasOwnProperty.call(obj, key)

  const setVariable = (name: string, value: string) => {
    switch (activeSubModeKey.value) {
      case 'pro-variable':
        proVariableSession.setTemporaryVariable(name, value)
        return
      case 'pro-multi':
        proMultiSession.setTemporaryVariable(name, value)
        return
      case 'image-text2image':
        imageText2ImageSession.setTemporaryVariable(name, value)
        return
      case 'image-image2image':
        imageImage2ImageSession.setTemporaryVariable(name, value)
        return
      default:
        globalStore.setVariable(name, value)
    }
  }

  const getVariable = (name: string): string | undefined => {
    switch (activeSubModeKey.value) {
      case 'pro-variable':
        return proVariableSession.getTemporaryVariable(name)
      case 'pro-multi':
        return proMultiSession.getTemporaryVariable(name)
      case 'image-text2image':
        return imageText2ImageSession.getTemporaryVariable(name)
      case 'image-image2image':
        return imageImage2ImageSession.getTemporaryVariable(name)
      default:
        return globalStore.getVariable(name)
    }
  }

  const deleteVariable = (name: string) => {
    switch (activeSubModeKey.value) {
      case 'pro-variable':
        proVariableSession.deleteTemporaryVariable(name)
        return
      case 'pro-multi':
        proMultiSession.deleteTemporaryVariable(name)
        return
      case 'image-text2image':
        imageText2ImageSession.deleteTemporaryVariable(name)
        return
      case 'image-image2image':
        imageImage2ImageSession.deleteTemporaryVariable(name)
        return
      default:
        globalStore.deleteVariable(name)
    }
  }

  const clearAll = () => {
    switch (activeSubModeKey.value) {
      case 'pro-variable':
        proVariableSession.clearTemporaryVariables()
        return
      case 'pro-multi':
        proMultiSession.clearTemporaryVariables()
        return
      case 'image-text2image':
        imageText2ImageSession.clearTemporaryVariables()
        return
      case 'image-image2image':
        imageImage2ImageSession.clearTemporaryVariables()
        return
      default:
        globalStore.clearAll()
    }
  }

  const hasVariable = (name: string) => {
    return hasOwn(temporaryVariables.value, name)
  }

  const listVariables = () => {
    return { ...temporaryVariables.value }
  }

  const batchSet = (variables: Record<string, string>) => {
    for (const [name, value] of Object.entries(variables)) {
      setVariable(name, value)
    }
  }

  const batchDelete = (names: string[]) => {
    for (const name of names) {
      deleteVariable(name)
    }
  }

  return {
    temporaryVariables: readonly(temporaryVariables) as Readonly<Ref<Record<string, string>>>,
    setVariable,
    getVariable,
    deleteVariable,
    clearAll,
    hasVariable,
    listVariables,
    batchSet,
    batchDelete,
  }
}
