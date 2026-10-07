/**
 * Pro-Variable Session Store (Pro-user, variable mode)
 *
 * Manages the session state of the User sub-mode under Pro mode
 * Similar structure to BasicSystemSession, but focused on the variable optimization scenario
 *
 * Note: temporary variables are persisted to each session store within the Pro/Image sub-modes (Basic is still global in-memory state)
 */

import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { getPiniaServices } from '../../plugins/pinia'
import { TEMPLATE_SELECTION_KEYS } from '@prompt-optimizer/core'
import { isValidVariableName, sanitizeVariableRecord } from '../../types/variable'
import {
  createDefaultEvaluationResults,
  type PersistedEvaluationResults,
} from '../../types/evaluation'

export interface TestResults {
  originalResult: string
  originalReasoning: string
  optimizedResult: string
  optimizedReasoning: string
}

/**
 * Version selection of the pro-variable test panel:
 * - 0: v0 (original prompt)
 * - >=1: v1..vn (history chain version number)
 * - 'latest': follows the latest vn
 */
export type TestPanelVersionValue = 0 | number | 'latest'

export type TestVariantId = 'a' | 'b' | 'c' | 'd'

export type TestColumnCount = 2 | 3 | 4

export interface ProVariableLayoutConfig {
  /** Left width of the main layout (percentage, 25..50) */
  mainSplitLeftPct: number
  /** Number of test area columns (2..4) */
  testColumnCount: TestColumnCount
}

export interface TestVariantConfig {
  id: TestVariantId
  version: TestPanelVersionValue
  modelKey: string
}

export interface TestVariantResult {
  result: string
  reasoning: string
}

export type TestVariantResults = Record<TestVariantId, TestVariantResult>

export type TestVariantLastRunFingerprint = Record<TestVariantId, string>

export interface ProVariableSessionState {
  prompt: string
  optimizedPrompt: string
  reasoning: string
  chainId: string
  versionId: string

  // Variable mode needs no separate testContent; the field is kept for compatibility and minimal intrusion
  testContent: string

  /**
   * Temporary variables (sub-mode isolated + persisted)
   * - Persisted at the pro-variable level (survives refresh)
   * - Not shared with pro-multi / image-*
   */
  temporaryVariables: Record<string, string>

  // legacy: old compare test results (A/B only)
  testResults: TestResults | null

  // v2: multi-column testing (up to 4 columns)
  layout: ProVariableLayoutConfig
  testVariants: TestVariantConfig[]
  testVariantResults: TestVariantResults
  testVariantLastRunFingerprint: TestVariantLastRunFingerprint

  evaluationResults: PersistedEvaluationResults
  selectedOptimizeModelKey: string
  selectedTestModelKey: string
  selectedTemplateId: string | null
  selectedIterateTemplateId: string | null
  isCompareMode: boolean
  lastActiveAt: number
}

/**
 * Default state
 */
const createDefaultState = (): ProVariableSessionState => ({
  prompt: '',
  optimizedPrompt: '',
  reasoning: '',
  chainId: '',
  versionId: '',
  testContent: '',
  temporaryVariables: {},
  testResults: null,
  layout: { mainSplitLeftPct: 50, testColumnCount: 2 },
  testVariants: [
    { id: 'a', version: 0, modelKey: '' },
    { id: 'b', version: 'latest', modelKey: '' },
    { id: 'c', version: 'latest', modelKey: '' },
    { id: 'd', version: 'latest', modelKey: '' },
  ],
  testVariantResults: {
    a: { result: '', reasoning: '' },
    b: { result: '', reasoning: '' },
    c: { result: '', reasoning: '' },
    d: { result: '', reasoning: '' },
  },
  testVariantLastRunFingerprint: {
    a: '',
    b: '',
    c: '',
    d: '',
  },
  evaluationResults: createDefaultEvaluationResults(),
  selectedOptimizeModelKey: '',
  selectedTestModelKey: '',
  selectedTemplateId: null,
  selectedIterateTemplateId: null,
  isCompareMode: true,
  lastActiveAt: Date.now(),
})

export const useProVariableSession = defineStore('proVariableSession', () => {
  // ========== State definitions (uses independent refs rather than wrapping them in a state object) ==========

  const prompt = ref('')
  const optimizedPrompt = ref('')
  const reasoning = ref('')
  const chainId = ref('')
  const versionId = ref('')
  const testContent = ref('')
  const temporaryVariables = ref<Record<string, string>>({})
  const testResults = ref<TestResults | null>(null)
  const layout = ref<ProVariableLayoutConfig>({ mainSplitLeftPct: 50, testColumnCount: 2 })
  const testVariants = ref<TestVariantConfig[]>([
    { id: 'a', version: 0, modelKey: '' },
    { id: 'b', version: 'latest', modelKey: '' },
    { id: 'c', version: 'latest', modelKey: '' },
    { id: 'd', version: 'latest', modelKey: '' },
  ])
  const testVariantResults = ref<TestVariantResults>({
    a: { result: '', reasoning: '' },
    b: { result: '', reasoning: '' },
    c: { result: '', reasoning: '' },
    d: { result: '', reasoning: '' },
  })
  const testVariantLastRunFingerprint = ref<TestVariantLastRunFingerprint>({
    a: '',
    b: '',
    c: '',
    d: '',
  })
  const evaluationResults = ref<PersistedEvaluationResults>(createDefaultEvaluationResults())
  const selectedOptimizeModelKey = ref('')
  const selectedTestModelKey = ref('')
  const selectedTemplateId = ref<string | null>(null)
  const selectedIterateTemplateId = ref<string | null>(null)
  const isCompareMode = ref(true)
  const lastActiveAt = ref(Date.now())

  const updatePrompt = (promptValue: string) => {
    if (prompt.value === promptValue) return
    prompt.value = promptValue
    lastActiveAt.value = Date.now()
  }

  const updateOptimizedResult = (payload: {
    optimizedPrompt: string
    reasoning?: string
    chainId: string
    versionId: string
  }) => {
    const nextOptimizedPrompt = payload.optimizedPrompt
    const nextReasoning = payload.reasoning || ''
    const nextChainId = payload.chainId
    const nextVersionId = payload.versionId

    const changed =
      optimizedPrompt.value !== nextOptimizedPrompt ||
      reasoning.value !== nextReasoning ||
      chainId.value !== nextChainId ||
      versionId.value !== nextVersionId

    if (!changed) return

    optimizedPrompt.value = nextOptimizedPrompt
    reasoning.value = nextReasoning
    chainId.value = nextChainId
    versionId.value = nextVersionId
    lastActiveAt.value = Date.now()
  }

  const updateTestResults = (results: TestResults | null) => {
    const prev = testResults.value

    // Check whether they are the same
    const isSame =
      prev === results ||
      (!!prev &&
        !!results &&
        prev.originalResult === results.originalResult &&
        prev.originalReasoning === results.originalReasoning &&
        prev.optimizedResult === results.optimizedResult &&
        prev.optimizedReasoning === results.optimizedReasoning)

    if (isSame) return

    // Assign directly to the ref (now reactive)
    testResults.value = results
    lastActiveAt.value = Date.now()
  }

  const updateTestContent = (content: string) => {
    if (testContent.value === content) return
    testContent.value = content
    lastActiveAt.value = Date.now()
  }

  // Temporary variables (persisted to the session)
  const setTemporaryVariable = (name: string, value: string) => {
    if (!isValidVariableName(name)) {
      console.warn('[ProVariableSession] Ignoring invalid temporary variable name:', name)
      return
    }
    temporaryVariables.value[name] = value
    lastActiveAt.value = Date.now()
  }

  const getTemporaryVariable = (name: string): string | undefined => {
    return Object.prototype.hasOwnProperty.call(temporaryVariables.value, name)
      ? temporaryVariables.value[name]
      : undefined
  }

  const deleteTemporaryVariable = (name: string) => {
    if (!Object.prototype.hasOwnProperty.call(temporaryVariables.value, name)) return
    delete temporaryVariables.value[name]
    lastActiveAt.value = Date.now()
  }

  const clearTemporaryVariables = () => {
    temporaryVariables.value = {}
    lastActiveAt.value = Date.now()
  }

  const updateOptimizeModel = (modelKey: string) => {
    if (selectedOptimizeModelKey.value === modelKey) return
    selectedOptimizeModelKey.value = modelKey
    lastActiveAt.value = Date.now()
    // Save the full state asynchronously (best-effort)
    saveSession()
  }

  const updateTestModel = (modelKey: string) => {
    if (selectedTestModelKey.value === modelKey) return
    selectedTestModelKey.value = modelKey
    lastActiveAt.value = Date.now()
    saveSession()
  }

  const updateTemplate = (templateId: string | null) => {
    if (selectedTemplateId.value === templateId) return
    selectedTemplateId.value = templateId
    lastActiveAt.value = Date.now()
    saveSession()
  }

  const updateIterateTemplate = (templateId: string | null) => {
    if (selectedIterateTemplateId.value === templateId) return
    selectedIterateTemplateId.value = templateId
    lastActiveAt.value = Date.now()
    saveSession()
  }

  const toggleCompareMode = (enabled?: boolean) => {
    const nextValue = enabled ?? !isCompareMode.value
    if (isCompareMode.value === nextValue) return
    isCompareMode.value = nextValue
    lastActiveAt.value = Date.now()
  }

  const setTestColumnCount = (count: TestColumnCount) => {
    if (layout.value.testColumnCount === count) return
    layout.value = { ...layout.value, testColumnCount: count }
    lastActiveAt.value = Date.now()
    saveSession()
  }

  const setMainSplitLeftPct = (pct: number) => {
    const normalized = Number.isFinite(pct) ? Math.round(pct) : layout.value.mainSplitLeftPct
    const next = Math.min(50, Math.max(25, normalized))
    if (layout.value.mainSplitLeftPct === next) return
    layout.value = { ...layout.value, mainSplitLeftPct: next }
    lastActiveAt.value = Date.now()
    saveSession()
  }

  const updateTestVariant = (id: TestVariantId, patch: Partial<Omit<TestVariantConfig, 'id'>>) => {
    const idx = testVariants.value.findIndex(v => v.id === id)
    if (idx < 0) return
    const prev = testVariants.value[idx]
    const next: TestVariantConfig = { ...prev, ...patch, id }
    if (prev.version === next.version && prev.modelKey === next.modelKey) return
    const nextList = testVariants.value.slice()
    nextList[idx] = next
    testVariants.value = nextList
    lastActiveAt.value = Date.now()
    saveSession()
  }

  const reset = () => {
    const defaultState = createDefaultState()
    prompt.value = defaultState.prompt
    optimizedPrompt.value = defaultState.optimizedPrompt
    reasoning.value = defaultState.reasoning
    chainId.value = defaultState.chainId
    versionId.value = defaultState.versionId
    testContent.value = defaultState.testContent
    temporaryVariables.value = defaultState.temporaryVariables
    testResults.value = defaultState.testResults
    layout.value = defaultState.layout
    testVariants.value = defaultState.testVariants
    testVariantResults.value = defaultState.testVariantResults
    testVariantLastRunFingerprint.value = defaultState.testVariantLastRunFingerprint
    evaluationResults.value = defaultState.evaluationResults
    selectedOptimizeModelKey.value = defaultState.selectedOptimizeModelKey
    selectedTestModelKey.value = defaultState.selectedTestModelKey
    selectedTemplateId.value = defaultState.selectedTemplateId
    selectedIterateTemplateId.value = defaultState.selectedIterateTemplateId
    isCompareMode.value = defaultState.isCompareMode
    lastActiveAt.value = defaultState.lastActiveAt
  }

  const saveSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[ProVariableSession] PreferenceService is unavailable, cannot save the session')
      return
    }

    try {
      // Build the full session state object for serialization
      const sessionState = {
        prompt: prompt.value,
        optimizedPrompt: optimizedPrompt.value,
        reasoning: reasoning.value,
        chainId: chainId.value,
        versionId: versionId.value,
        testContent: testContent.value,
        temporaryVariables: sanitizeVariableRecord(temporaryVariables.value),
        testResults: testResults.value,
        layout: layout.value,
        testVariants: testVariants.value,
        testVariantResults: testVariantResults.value,
        testVariantLastRunFingerprint: testVariantLastRunFingerprint.value,
        evaluationResults: evaluationResults.value,
        selectedOptimizeModelKey: selectedOptimizeModelKey.value,
        selectedTestModelKey: selectedTestModelKey.value,
        selectedTemplateId: selectedTemplateId.value,
        selectedIterateTemplateId: selectedIterateTemplateId.value,
        isCompareMode: isCompareMode.value,
        lastActiveAt: lastActiveAt.value,
      }
      await $services.preferenceService.set(
        'session/v1/pro-variable',
        sessionState
      )
    } catch (error) {
      console.error('[ProVariableSession] Failed to save the session:', error)
    }
  }

  const restoreSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[ProVariableSession] PreferenceService is unavailable, cannot restore the session')
      return
    }

    try {
      const saved = await $services.preferenceService.get<unknown>(
        'session/v1/pro-variable',
        null
      )

      if (saved) {
        const parsed =
          typeof saved === 'string'
            ? (JSON.parse(saved) as ProVariableSessionState)
            : (saved as ProVariableSessionState)

        prompt.value = typeof parsed.prompt === 'string' ? parsed.prompt : ''
        optimizedPrompt.value = typeof parsed.optimizedPrompt === 'string' ? parsed.optimizedPrompt : ''
        reasoning.value = typeof parsed.reasoning === 'string' ? parsed.reasoning : ''
        chainId.value = typeof parsed.chainId === 'string' ? parsed.chainId : ''
        versionId.value = typeof parsed.versionId === 'string' ? parsed.versionId : ''
        testContent.value = typeof parsed.testContent === 'string' ? parsed.testContent : ''

        temporaryVariables.value = sanitizeVariableRecord(
          (parsed as Partial<ProVariableSessionState>).temporaryVariables,
        )
        testResults.value = (parsed.testResults && typeof parsed.testResults === 'object')
          ? (parsed.testResults as TestResults)
          : null

        const defaultState = createDefaultState()
        const coerceVersionValue = (value: unknown): TestPanelVersionValue | null => {
          if (value === 'latest') return 'latest'
          if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.floor(value)
          return null
        }

        const legacyModelKey = typeof parsed.selectedTestModelKey === 'string' ? parsed.selectedTestModelKey : ''

        // v2: variant results (prefer saved; else migrate legacy testResults into a/b)
        const savedVariantResults = (parsed as Partial<ProVariableSessionState>).testVariantResults
        const savedFingerprint = (parsed as Partial<ProVariableSessionState>).testVariantLastRunFingerprint

        const nextVariantResults: TestVariantResults = { ...defaultState.testVariantResults }
        const nextFingerprint: TestVariantLastRunFingerprint = { ...defaultState.testVariantLastRunFingerprint }

        const coerceVariantResult = (value: unknown): TestVariantResult | null => {
          if (!value || typeof value !== 'object') return null
          const v = value as { result?: unknown; reasoning?: unknown }
          if (typeof v.result !== 'string') return null
          if (typeof v.reasoning !== 'string') return null
          return { result: v.result, reasoning: v.reasoning }
        }

        const ids: TestVariantId[] = ['a', 'b', 'c', 'd']
        if (savedVariantResults && typeof savedVariantResults === 'object') {
          const obj = savedVariantResults as Record<string, unknown>
          for (const id of ids) {
            const vr = coerceVariantResult(obj[id])
            if (vr) nextVariantResults[id] = vr
          }
        } else if (parsed.testResults) {
          if (typeof parsed.testResults.originalResult === 'string') nextVariantResults.a.result = parsed.testResults.originalResult
          if (typeof parsed.testResults.originalReasoning === 'string') nextVariantResults.a.reasoning = parsed.testResults.originalReasoning
          if (typeof parsed.testResults.optimizedResult === 'string') nextVariantResults.b.result = parsed.testResults.optimizedResult
          if (typeof parsed.testResults.optimizedReasoning === 'string') nextVariantResults.b.reasoning = parsed.testResults.optimizedReasoning
        }

        if (savedFingerprint && typeof savedFingerprint === 'object') {
          const obj = savedFingerprint as Record<string, unknown>
          for (const id of ids) {
            const fp = obj[id]
            if (typeof fp === 'string') nextFingerprint[id] = fp
          }
        }

        testVariantResults.value = nextVariantResults
        testVariantLastRunFingerprint.value = nextFingerprint

        // layout
        const savedLayout = (parsed as Partial<ProVariableSessionState>).layout
        const savedLeftRaw = savedLayout && typeof savedLayout.mainSplitLeftPct === 'number'
          ? savedLayout.mainSplitLeftPct
          : defaultState.layout.mainSplitLeftPct
        const savedLeft = Math.min(50, Math.max(25, Math.round(savedLeftRaw)))
        const savedCols = savedLayout && (savedLayout.testColumnCount === 2 || savedLayout.testColumnCount === 3 || savedLayout.testColumnCount === 4)
          ? savedLayout.testColumnCount
          : defaultState.layout.testColumnCount
        layout.value = {
          mainSplitLeftPct: savedLeft,
          testColumnCount: savedCols,
        }

        // variants
        const fromSavedVariants = (parsed as Partial<ProVariableSessionState>).testVariants
        if (Array.isArray(fromSavedVariants) && fromSavedVariants.length) {
          const normalized: TestVariantConfig[] = defaultState.testVariants.map((d) => {
            const found = fromSavedVariants.find((v) => v?.id === d.id)
            return {
              id: d.id,
              version: coerceVersionValue(found?.version) ?? d.version,
              modelKey: typeof found?.modelKey === 'string' ? found.modelKey : legacyModelKey,
            }
          })
          testVariants.value = normalized
        } else {
          testVariants.value = defaultState.testVariants.map((v) => ({ ...v, modelKey: legacyModelKey }))
        }

        evaluationResults.value = {
          ...createDefaultEvaluationResults(),
          ...(parsed.evaluationResults && typeof parsed.evaluationResults === 'object'
            ? (parsed.evaluationResults as PersistedEvaluationResults)
            : {}),
        }
        selectedOptimizeModelKey.value = typeof parsed.selectedOptimizeModelKey === 'string' ? parsed.selectedOptimizeModelKey : ''
        selectedTestModelKey.value = typeof parsed.selectedTestModelKey === 'string' ? parsed.selectedTestModelKey : ''
        selectedTemplateId.value = typeof parsed.selectedTemplateId === 'string' ? parsed.selectedTemplateId : null
        selectedIterateTemplateId.value = typeof parsed.selectedIterateTemplateId === 'string' ? parsed.selectedIterateTemplateId : null
        isCompareMode.value = typeof parsed.isCompareMode === 'boolean' ? parsed.isCompareMode : true
        lastActiveAt.value = Date.now()
      }
      // else: no saved session, use the default state

      // Compatibility migration: template selection (migrated once from the old TEMPLATE_SELECTION_KEYS)
      if (!selectedTemplateId.value) {
        const legacyTemplateId = await $services.preferenceService.get(
          TEMPLATE_SELECTION_KEYS.CONTEXT_USER_OPTIMIZE_TEMPLATE,
          ''
        )
        if (legacyTemplateId) {
          selectedTemplateId.value = legacyTemplateId
        }
      }
      if (!selectedIterateTemplateId.value) {
        const legacyIterateTemplateId = await $services.preferenceService.get(
          TEMPLATE_SELECTION_KEYS.CONTEXT_ITERATE_TEMPLATE,
          ''
        )
        if (legacyIterateTemplateId) {
          selectedIterateTemplateId.value = legacyIterateTemplateId
        }
      }
    } catch (error) {
      console.error('[ProVariableSession] Failed to restore the session:', error)
      reset()
    }
  }

  return {
    // ========== State (returned directly; Pinia tracks reactivity automatically) ==========
    prompt,
    optimizedPrompt,
    reasoning,
    chainId,
    versionId,
    testContent,
    temporaryVariables,
    testResults,
    layout,
    testVariants,
    testVariantResults,
    testVariantLastRunFingerprint,
    evaluationResults,
    selectedOptimizeModelKey,
    selectedTestModelKey,
    selectedTemplateId,
    selectedIterateTemplateId,
    isCompareMode,
    lastActiveAt,

    // ========== Update methods ==========
    updatePrompt,
    updateOptimizedResult,
    updateTestContent,
    updateTestResults,

    setTemporaryVariable,
    getTemporaryVariable,
    deleteTemporaryVariable,
    clearTemporaryVariables,
    updateOptimizeModel,
    updateTestModel,
    updateTemplate,
    updateIterateTemplate,
    toggleCompareMode,
    setTestColumnCount,
    setMainSplitLeftPct,
    updateTestVariant,
    reset,

    // ========== Persistence methods ==========
    saveSession,
    restoreSession,
  }
})

export type ProVariableSessionApi = ReturnType<typeof useProVariableSession>
