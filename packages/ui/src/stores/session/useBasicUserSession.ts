/**
 * Basic-User Session Store
 *
 * Manages the session state of the User sub-mode under Basic mode
 * Same structure as BasicSystemSession
 */

import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { getPiniaServices } from '../../plugins/pinia'
import { TEMPLATE_SELECTION_KEYS } from '@prompt-optimizer/core'
import {
  createDefaultEvaluationResults,
  type PersistedEvaluationResults,
} from '../../types/evaluation'

/**
 * Test result structure
 */
export interface TestResults {
  originalResult: string
  originalReasoning: string
  optimizedResult: string
  optimizedReasoning: string
}

/**
 * Version selection of the basic-user test panel:
 * - 0: v0 (original prompt)
 * - >=1: v1..vn (history chain version number)
 * - 'latest': follows the latest vn
 */
export type TestPanelVersionValue = 0 | number | 'latest'

export type TestVariantId = 'a' | 'b' | 'c' | 'd'

export type TestColumnCount = 2 | 3 | 4

export interface TestVariantResult {
  result: string
  reasoning: string
}

export type TestVariantResults = Record<TestVariantId, TestVariantResult>

export type TestVariantLastRunFingerprint = Record<TestVariantId, string>

export interface TestVariantConfig {
  id: TestVariantId
  version: TestPanelVersionValue
  modelKey: string
}

export interface BasicUserLayoutConfig {
  /** main split: left pane width percent (25..50) */
  mainSplitLeftPct: number

  /** test area: visible result columns */
  testColumnCount: TestColumnCount
}

/**
 * Basic-User session state
 */
export interface BasicUserSessionState {
  // Prompt-related
  prompt: string
  optimizedPrompt: string
  reasoning: string

  // History-related (only the ID is stored)
  chainId: string
  versionId: string

  // Test area content
  testContent: string

  // Test results
  testResults: TestResults | null

  // Test layout and column config (basic-user only: up to 4 columns)
  layout: BasicUserLayoutConfig
  testVariants: TestVariantConfig[]

  // Test results (persisted per column, supports up to 4 columns)
  testVariantResults: TestVariantResults
  testVariantLastRunFingerprint: TestVariantLastRunFingerprint

  // Evaluation results (persisted by type, used for restore after a restart)
  evaluationResults: PersistedEvaluationResults

  // Model and template selection (only the ID/key is stored, not objects)
  selectedOptimizeModelKey: string
  selectedTestModelKey: string
  selectedTemplateId: string | null
  selectedIterateTemplateId: string | null

  // Compare mode
  isCompareMode: boolean

  // Last active time
  lastActiveAt: number
}

/**
 * Default state
 */
const createDefaultState = (): BasicUserSessionState => ({
  prompt: '',
  optimizedPrompt: '',
  reasoning: '',
  chainId: '',
  versionId: '',
  testContent: '',
  testResults: null,
  layout: {
    mainSplitLeftPct: 50,
    testColumnCount: 2,
  },
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

export const useBasicUserSession = defineStore('basicUserSession', () => {
  // ========== State definitions (uses independent refs rather than wrapping them in a state object) ==========

  // Prompt-related
  const prompt = ref('')
  const optimizedPrompt = ref('')
  const reasoning = ref('')

  // History-related (only the ID is stored)
  const chainId = ref('')
  const versionId = ref('')

  // Test area content
  const testContent = ref('')

  // Test results
  const testResults = ref<TestResults | null>(null)

  // Test layout and column config
  const layout = ref<BasicUserLayoutConfig>({
    mainSplitLeftPct: 50,
    testColumnCount: 2,
  })

  const testVariants = ref<TestVariantConfig[]>([
    { id: 'a', version: 0, modelKey: '' },
    { id: 'b', version: 'latest', modelKey: '' },
    { id: 'c', version: 'latest', modelKey: '' },
    { id: 'd', version: 'latest', modelKey: '' },
  ])

  // Test results (persisted per column)
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

  // Evaluation results
  const evaluationResults = ref<PersistedEvaluationResults>(createDefaultEvaluationResults())

  // Model and template selection (only the ID/key is stored, not objects)
  const selectedOptimizeModelKey = ref('')
  const selectedTestModelKey = ref('')
  const selectedTemplateId = ref<string | null>(null)
  const selectedIterateTemplateId = ref<string | null>(null)

  // Compare mode
  const isCompareMode = ref(true)

  // Last active time
  const lastActiveAt = ref(Date.now())

  /**
   * Update the prompt
   */
  const updatePrompt = (promptValue: string) => {
    if (prompt.value === promptValue) return
    prompt.value = promptValue
    lastActiveAt.value = Date.now()
  }

  /**
   * Update the optimization result
   */
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

  /**
   * Update the test results
   */
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

  /**
   * Set the number of test area columns
   */
  const setTestColumnCount = (count: TestColumnCount) => {
    if (layout.value.testColumnCount === count) return
    layout.value = { ...layout.value, testColumnCount: count }
    lastActiveAt.value = Date.now()
    saveSession()
  }

  /**
   * Set the left width of the main layout (percentage)
   */
  const setMainSplitLeftPct = (pct: number) => {
    const normalized = Number.isFinite(pct) ? Math.round(pct) : layout.value.mainSplitLeftPct
    const next = Math.min(50, Math.max(25, normalized))
    if (layout.value.mainSplitLeftPct === next) return
    layout.value = { ...layout.value, mainSplitLeftPct: next }
    lastActiveAt.value = Date.now()
    saveSession()
  }

  /**
   * Update the version/model config of a column (variant)
   */
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

  /**
   * Update the test content
   */
  const updateTestContent = (content: string) => {
    if (testContent.value === content) return
    testContent.value = content
    lastActiveAt.value = Date.now()
  }

  /**
   * Update the optimize model selection
   */
  const updateOptimizeModel = (modelKey: string) => {
    if (selectedOptimizeModelKey.value === modelKey) return
    selectedOptimizeModelKey.value = modelKey
    lastActiveAt.value = Date.now()
    // Save the full state asynchronously (best-effort)
    saveSession()
  }

  /**
   * Update the test model selection
   */
  const updateTestModel = (modelKey: string) => {
    if (selectedTestModelKey.value === modelKey) return
    selectedTestModelKey.value = modelKey
    lastActiveAt.value = Date.now()
    saveSession()
  }

  /**
   * Update the template selection
   */
  const updateTemplate = (templateId: string | null) => {
    if (selectedTemplateId.value === templateId) return
    selectedTemplateId.value = templateId
    lastActiveAt.value = Date.now()
    saveSession()
  }

  /**
   * Update the iterate template selection
   */
  const updateIterateTemplate = (templateId: string | null) => {
    if (selectedIterateTemplateId.value === templateId) return
    selectedIterateTemplateId.value = templateId
    lastActiveAt.value = Date.now()
    saveSession()
  }

  /**
   * Toggle compare mode
   */
  const toggleCompareMode = (enabled?: boolean) => {
    const nextValue = enabled ?? !isCompareMode.value
    if (isCompareMode.value === nextValue) return
    isCompareMode.value = nextValue
    lastActiveAt.value = Date.now()
  }

  /**
   * Reset the state
   */
  const reset = () => {
    const defaultState = createDefaultState()
    prompt.value = defaultState.prompt
    optimizedPrompt.value = defaultState.optimizedPrompt
    reasoning.value = defaultState.reasoning
    chainId.value = defaultState.chainId
    versionId.value = defaultState.versionId
    testContent.value = defaultState.testContent
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
    lastActiveAt.value = Date.now()
  }

  /**
   * Save the session to persistent storage
   * Uses PreferenceService (Codex requirement)
   */
  const saveSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[BasicUserSession] PreferenceService is unavailable, cannot save the session')
      return
    }

    try {
      const sessionState = {
        prompt: prompt.value,
        optimizedPrompt: optimizedPrompt.value,
        reasoning: reasoning.value,
        chainId: chainId.value,
        versionId: versionId.value,
        testContent: testContent.value,
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
        'session/v1/basic-user',
        sessionState
      )
    } catch (error) {
      console.error('[BasicUserSession] Failed to save the session:', error)
    }
  }

  /**
   * Restore the session from persistent storage
   * Uses PreferenceService (Codex requirement)
   */
  const restoreSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[BasicUserSession] PreferenceService is unavailable, cannot restore the session')
      return
    }

    try {
      const saved = await $services.preferenceService.get<unknown>(
        'session/v1/basic-user',
        null
      )

      if (saved) {
        const parsed =
          typeof saved === 'string'
            ? (JSON.parse(saved) as BasicUserSessionState)
            : (saved as BasicUserSessionState)
        prompt.value = parsed.prompt
        optimizedPrompt.value = parsed.optimizedPrompt
        reasoning.value = parsed.reasoning
        chainId.value = parsed.chainId
        versionId.value = parsed.versionId
        testContent.value = parsed.testContent
        testResults.value = parsed.testResults

        // Compatible with old data: use the defaults when layout/testVariants is missing
        const defaultState = createDefaultState()
        const coerceVersionValue = (value: unknown): TestPanelVersionValue | null => {
          if (value === 'latest') return 'latest'
          if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.floor(value)
          return null
        }

        const legacyModelKey = typeof parsed.selectedTestModelKey === 'string' ? parsed.selectedTestModelKey : ''

        // variant results (v2): prefer reading from saved; otherwise migrate a/b from the old testResults
        const savedVariantResults = (parsed as Partial<BasicUserSessionState>).testVariantResults
        const savedFingerprint = (parsed as Partial<BasicUserSessionState>).testVariantLastRunFingerprint
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
          // legacy: a/b only
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
        const savedLayout = (parsed as Partial<BasicUserSessionState>).layout
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
        const fromSavedVariants = (parsed as Partial<BasicUserSessionState>).testVariants
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
          // v1 migration: migrate to a/b from the old testPanels
          type LegacyPanel = { version?: unknown; modelKey?: unknown }
          type LegacyPanels = { original?: LegacyPanel; optimized?: LegacyPanel }
          const legacyPanels = (parsed as { testPanels?: LegacyPanels }).testPanels
          const originalSaved = legacyPanels?.original
          const optimizedSaved = legacyPanels?.optimized

          testVariants.value = [
            {
              id: 'a',
              version: coerceVersionValue(originalSaved?.version) ?? 0,
              modelKey: typeof originalSaved?.modelKey === 'string' ? originalSaved.modelKey : legacyModelKey,
            },
            {
              id: 'b',
              version: coerceVersionValue(optimizedSaved?.version) ?? 'latest',
              modelKey: typeof optimizedSaved?.modelKey === 'string' ? optimizedSaved.modelKey : legacyModelKey,
            },
            { id: 'c', version: 'latest', modelKey: legacyModelKey },
            { id: 'd', version: 'latest', modelKey: legacyModelKey },
          ]
        }
        // Compatible with old data: use the defaults when evaluationResults was not saved
        evaluationResults.value = {
          ...createDefaultEvaluationResults(),
          ...(parsed.evaluationResults && typeof parsed.evaluationResults === 'object'
            ? (parsed.evaluationResults as PersistedEvaluationResults)
            : {}),
        }
        selectedOptimizeModelKey.value = parsed.selectedOptimizeModelKey
        selectedTestModelKey.value = parsed.selectedTestModelKey
        selectedTemplateId.value = parsed.selectedTemplateId
        selectedIterateTemplateId.value = parsed.selectedIterateTemplateId
        isCompareMode.value = parsed.isCompareMode
        lastActiveAt.value = Date.now()
      }

      // Compatibility migration: template selection (migrated once from the old TEMPLATE_SELECTION_KEYS)
      if (!selectedTemplateId.value) {
        const legacyTemplateId = await $services.preferenceService.get(
          TEMPLATE_SELECTION_KEYS.USER_OPTIMIZE_TEMPLATE,
          ''
        )
        if (legacyTemplateId) {
          selectedTemplateId.value = legacyTemplateId
        }
      }
      if (!selectedIterateTemplateId.value) {
        const legacyIterateTemplateId = await $services.preferenceService.get(
          TEMPLATE_SELECTION_KEYS.ITERATE_TEMPLATE,
          ''
        )
        if (legacyIterateTemplateId) {
          selectedIterateTemplateId.value = legacyIterateTemplateId
        }
      }
    } catch (error) {
      console.error('[BasicUserSession] Failed to restore the session:', error)
      // On a restore failure, keep the current state or reset to the defaults
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
    setTestColumnCount,
    setMainSplitLeftPct,
    updateTestVariant,
    updateOptimizeModel,
    updateTestModel,
    updateTemplate,
    updateIterateTemplate,
    toggleCompareMode,
    reset,

    // ========== Persistence methods ==========
    saveSession,
    restoreSession,
  }
})

export type BasicUserSessionApi = ReturnType<typeof useBasicUserSession>
