/**
 * Pro-MultiMessage Session Store (Pro-system, multi-message mode)
 *
 * Manages the session state of the System sub-mode under Pro mode
 * Characteristics:
 * - Multi-turn conversation message management
 * - Message-to-history-chain mapping (Codex requires using a Record)
 * - Optimization result of the currently selected message
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getPiniaServices } from '../../plugins/pinia'
import { TEMPLATE_SELECTION_KEYS, type ConversationMessage } from '@prompt-optimizer/core'
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
 * Pro-MultiMessage session state
 */
export interface ProMultiMessageSessionState {
  conversationMessagesSnapshot: ConversationMessage[]
  selectedMessageId: string
  optimizedPrompt: string
  reasoning: string
  chainId: string
  versionId: string

  /**
   * Temporary variables (sub-mode isolated + persisted)
   * - Persisted at the pro-multi level (survives refresh)
   * - Not shared with pro-variable / image-*
   */
  temporaryVariables: Record<string, string>

  messageChainMap: Record<string, string>
  testResults: TestResults | null
  layout: ProMultiLayoutConfig
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
 * Version selection of the pro-multi test panel (for the "currently selected message"):
 * - 0: v0 (original message content)
 * - >=1: v1..vn (history chain version number)
 * - 'latest': follows the latest vn
 */
export type TestPanelVersionValue = 0 | number | 'latest'

export type TestVariantId = 'a' | 'b' | 'c' | 'd'

export type TestColumnCount = 2 | 3 | 4

export interface ProMultiLayoutConfig {
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

/**
 * Default state
 */
const createDefaultState = (): ProMultiMessageSessionState => ({
  conversationMessagesSnapshot: [],
  selectedMessageId: '',
  optimizedPrompt: '',
  reasoning: '',
  chainId: '',
  versionId: '',
  temporaryVariables: {},
  messageChainMap: {},
  testResults: null,
  // v2: multi-column testing (up to 4 columns)
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

export const useProMultiMessageSession = defineStore('proMultiMessageSession', () => {
  // ========== State definitions (uses independent refs rather than wrapping them in a state object) ==========

  // Conversation message snapshot (used for restore only)
  const conversationMessagesSnapshot = ref<ConversationMessage[]>([])

  // Currently selected message ID
  const selectedMessageId = ref('')

  // Optimization result of the current message
  const optimizedPrompt = ref('')

  // 🔧 Codex fix: add the reasoning field, consistent with the other session stores
  const reasoning = ref('')

  // History-related (only the ID is stored)
  const chainId = ref('')
  const versionId = ref('')

  // Message-to-history-chain mapping (Codex requirement: change Map to Record)
  const messageChainMap = ref<Record<string, string>>({})

  // Temporary variables (sub-mode isolated + persisted)
  const temporaryVariables = ref<Record<string, string>>({})

  // Test results
  const testResults = ref<TestResults | null>(null)

  // Multi-column testing (up to 4 columns)
  const layout = ref<ProMultiLayoutConfig>({ mainSplitLeftPct: 50, testColumnCount: 2 })
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

  // Evaluation results
  const evaluationResults = ref<PersistedEvaluationResults>(createDefaultEvaluationResults())

  // Model and template selection (only the ID/key is stored)
  const selectedOptimizeModelKey = ref('')
  const selectedTestModelKey = ref('')
  const selectedTemplateId = ref<string | null>(null)
  const selectedIterateTemplateId = ref<string | null>(null)

  // Compare mode
  const isCompareMode = ref(true)

  // Last active time
  const lastActiveAt = ref(Date.now())

  /**
   * Update the conversation message snapshot
   */
  const updateConversationMessages = (messages: ConversationMessage[]) => {
    conversationMessagesSnapshot.value = messages
    lastActiveAt.value = Date.now()
  }

  /**
   * Select a message
   */
  const selectMessage = (messageId: string) => {
    selectedMessageId.value = messageId
    lastActiveAt.value = Date.now()
  }

  /**
   * Update the optimization result
   * 🔧 Codex fix: add reasoning field support
   */
  const updateOptimizedResult = (payload: {
    optimizedPrompt: string
    reasoning: string
    chainId: string
    versionId: string
  }) => {
    const nextOptimizedPrompt = payload.optimizedPrompt
    const nextReasoning = payload.reasoning
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
   * Update the message-to-history-chain mapping
   */
  const updateMessageChainMap = (messageId: string, chainId: string) => {
    messageChainMap.value[messageId] = chainId
    lastActiveAt.value = Date.now()
  }

  /**
   * Batch update the message-to-history-chain mapping
   */
  const setMessageChainMap = (map: Record<string, string>) => {
    messageChainMap.value = { ...map }
    lastActiveAt.value = Date.now()
  }

  /**
   * Remove the history chain mapping of a message
   */
  const removeMessageChainMapping = (messageId: string) => {
    delete messageChainMap.value[messageId]
    lastActiveAt.value = Date.now()
  }

  // Temporary variables (persisted to the session)
  const setTemporaryVariable = (name: string, value: string) => {
    if (!isValidVariableName(name)) {
      console.warn('[ProMultiMessageSession] Ignoring invalid temporary variable name:', name)
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

  const setTestColumnCount = (count: TestColumnCount) => {
    if (layout.value.testColumnCount === count) return
    layout.value = { ...layout.value, testColumnCount: count }
    lastActiveAt.value = Date.now()
    saveSession()
  }

  const setMainSplitLeftPct = (pct: number) => {
    const clamped = Math.min(50, Math.max(25, Math.round(pct)))
    if (layout.value.mainSplitLeftPct === clamped) return
    layout.value = { ...layout.value, mainSplitLeftPct: clamped }
    lastActiveAt.value = Date.now()
    saveSession()
  }

  const updateTestVariant = (id: TestVariantId, patch: Partial<Omit<TestVariantConfig, 'id'>>) => {
    const idx = testVariants.value.findIndex((v) => v.id === id)
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
   * Reset the state
   */
  const reset = () => {
    const defaultState = createDefaultState()
    conversationMessagesSnapshot.value = defaultState.conversationMessagesSnapshot
    selectedMessageId.value = defaultState.selectedMessageId
    optimizedPrompt.value = defaultState.optimizedPrompt
    reasoning.value = defaultState.reasoning
    chainId.value = defaultState.chainId
    versionId.value = defaultState.versionId
    temporaryVariables.value = defaultState.temporaryVariables
    messageChainMap.value = defaultState.messageChainMap
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

  /**
   * Save the session
   */
  const saveSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[ProMultiMessageSession] PreferenceService is unavailable, cannot save the session')
      return
    }

    try {
      // Build the full session state object for serialization
      const sessionState = {
        conversationMessagesSnapshot: conversationMessagesSnapshot.value,
        selectedMessageId: selectedMessageId.value,
        optimizedPrompt: optimizedPrompt.value,
        reasoning: reasoning.value,
        chainId: chainId.value,
        versionId: versionId.value,
        temporaryVariables: sanitizeVariableRecord(temporaryVariables.value),
        messageChainMap: messageChainMap.value,
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
        'session/v1/pro-multi',
        sessionState
      )
    } catch (error) {
      console.error('[ProMultiMessageSession] Failed to save the session:', error)
    }
  }

  /**
   * Restore the session
   */
  const restoreSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[ProMultiMessageSession] PreferenceService is unavailable, cannot restore the session')
      return
    }

    try {
      const saved = await $services.preferenceService.get<unknown>(
        'session/v1/pro-multi',
        null
      )

      if (saved) {
        const parsed =
          typeof saved === 'string'
            ? (JSON.parse(saved) as Record<string, unknown>)
            : (saved as Record<string, unknown>)
        conversationMessagesSnapshot.value = Array.isArray(parsed.conversationMessagesSnapshot)
          ? (parsed.conversationMessagesSnapshot as ConversationMessage[])
          : []
        selectedMessageId.value = typeof parsed.selectedMessageId === 'string' ? parsed.selectedMessageId : ''
        optimizedPrompt.value = typeof parsed.optimizedPrompt === 'string' ? parsed.optimizedPrompt : ''
        reasoning.value = typeof parsed.reasoning === 'string' ? parsed.reasoning : ''
        chainId.value = typeof parsed.chainId === 'string' ? parsed.chainId : ''
        versionId.value = typeof parsed.versionId === 'string' ? parsed.versionId : ''

        temporaryVariables.value = sanitizeVariableRecord(parsed.temporaryVariables)
        messageChainMap.value = (parsed.messageChainMap && typeof parsed.messageChainMap === 'object')
          ? (parsed.messageChainMap as Record<string, string>)
          : {}
        testResults.value = (parsed.testResults && typeof parsed.testResults === 'object')
          ? (parsed.testResults as TestResults)
          : null

        // ==================== v2: multi-column variants ====================
        // Default state
        const defaultState = createDefaultState()

        // layout
        const rawLayout = parsed.layout
        if (rawLayout && typeof rawLayout === 'object') {
          const layoutRecord = rawLayout as Record<string, unknown>
          const pct =
            typeof layoutRecord['mainSplitLeftPct'] === 'number'
              ? (layoutRecord['mainSplitLeftPct'] as number)
              : defaultState.layout.mainSplitLeftPct
          const countRaw = layoutRecord['testColumnCount']
          const count: TestColumnCount = countRaw === 2 || countRaw === 3 || countRaw === 4 ? countRaw : defaultState.layout.testColumnCount
          layout.value = {
            mainSplitLeftPct: Math.min(50, Math.max(25, Math.round(pct))),
            testColumnCount: count,
          }
        } else {
          layout.value = defaultState.layout
        }

        // testVariants
        const rawVariants = parsed.testVariants
        if (Array.isArray(rawVariants)) {
          const byId = new Map<TestVariantId, TestVariantConfig>()

          const normalizeVersion = (v: unknown): TestPanelVersionValue => {
            if (v === 0) return 0
            if (v === 'latest') return 'latest'
            if (typeof v === 'number' && Number.isFinite(v) && v >= 1) return v
            return 'latest'
          }

          for (const item of rawVariants) {
            if (!item || typeof item !== 'object') continue
            const obj = item as Record<string, unknown>
            const id = obj['id']
            if (id !== 'a' && id !== 'b' && id !== 'c' && id !== 'd') continue
            const modelKey = typeof obj['modelKey'] === 'string' ? (obj['modelKey'] as string) : ''
            const version = normalizeVersion(obj['version'])
            byId.set(id, { id, modelKey, version })
          }

          testVariants.value = defaultState.testVariants.map((v) => {
            const restored = byId.get(v.id)
            return restored ? restored : v
          })
        } else {
          testVariants.value = defaultState.testVariants
        }

        // testVariantResults / migration from legacy testResults
        const rawVariantResults = parsed.testVariantResults
        if (rawVariantResults && typeof rawVariantResults === 'object') {
          const resultRecord = rawVariantResults as Record<string, unknown>
          const pick = (id: TestVariantId) => {
            const one = resultRecord[id]
            if (!one || typeof one !== 'object') return defaultState.testVariantResults[id]
            const oneRecord = one as Record<string, unknown>
            const r = typeof oneRecord['result'] === 'string' ? (oneRecord['result'] as string) : ''
            const reasoning = typeof oneRecord['reasoning'] === 'string' ? (oneRecord['reasoning'] as string) : ''
            return { result: r, reasoning }
          }

          testVariantResults.value = {
            a: pick('a'),
            b: pick('b'),
            c: pick('c'),
            d: pick('d'),
          }
        } else if (testResults.value) {
          // legacy migration: old testResults (original/optimized) → A/B
          testVariantResults.value = {
            ...defaultState.testVariantResults,
            a: {
              result: testResults.value.originalResult || '',
              reasoning: testResults.value.originalReasoning || '',
            },
            b: {
              result: testResults.value.optimizedResult || '',
              reasoning: testResults.value.optimizedReasoning || '',
            },
          }
        } else {
          testVariantResults.value = defaultState.testVariantResults
        }

        // lastRunFingerprint
        const rawFingerprints = parsed.testVariantLastRunFingerprint
        if (rawFingerprints && typeof rawFingerprints === 'object') {
          const fingerprintRecord = rawFingerprints as Record<string, unknown>
          const pick = (id: TestVariantId) => (typeof fingerprintRecord[id] === 'string' ? (fingerprintRecord[id] as string) : '')
          testVariantLastRunFingerprint.value = {
            a: pick('a'),
            b: pick('b'),
            c: pick('c'),
            d: pick('d'),
          }
        } else {
          testVariantLastRunFingerprint.value = defaultState.testVariantLastRunFingerprint
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

        // If the modelKey of a variant is empty, try filling it once with the legacy selectedTestModelKey
        const seedModelKey = selectedTestModelKey.value
        if (seedModelKey) {
          let changed = false
          const next = testVariants.value.map((v) => {
            if (v.modelKey) return v
            changed = true
            return { ...v, modelKey: seedModelKey }
          })
          if (changed) {
            testVariants.value = next
          }
        }
      }
      // else: no saved session, use the default state

      // Compatibility migration: template selection (migrated once from the old TEMPLATE_SELECTION_KEYS)
      if (!selectedTemplateId.value) {
        const legacyTemplateId = await $services.preferenceService.get(
          TEMPLATE_SELECTION_KEYS.CONTEXT_SYSTEM_OPTIMIZE_TEMPLATE,
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
      console.error('[ProMultiMessageSession] Failed to restore the session:', error)
      reset()
    }
  }

  return {
    // ========== State (returned directly; Pinia tracks reactivity automatically) ==========
    conversationMessagesSnapshot,
    selectedMessageId,
    optimizedPrompt,
    reasoning,
    chainId,
    versionId,
    temporaryVariables,
    messageChainMap,
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
    updateConversationMessages,
    selectMessage,
    updateOptimizedResult,
    updateMessageChainMap,
    setMessageChainMap,
    removeMessageChainMapping,

    setTemporaryVariable,
    getTemporaryVariable,
    deleteTemporaryVariable,
    clearTemporaryVariables,
    updateTestResults,
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

export type ProMultiMessageSessionApi = ReturnType<typeof useProMultiMessageSession>
