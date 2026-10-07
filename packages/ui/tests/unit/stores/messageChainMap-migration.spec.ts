/**
 * messageChainMap key format migration test
 *
 * Verifies the migration logic from the legacy format (mode:messageId) to the new format (messageId)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { useProMultiMessageSession } from '../../../src/stores/session/useProMultiMessageSession'
import { useConversationOptimization } from '../../../src/composables/prompt/useConversationOptimization'
import type { AppServices } from '../../../src/types/services'

// Mock dependencies
vi.mock('../../../src/stores/session/useProMultiMessageSession', () => ({
  useProMultiMessageSession: vi.fn()
}))

vi.mock('../../../src/composables/ui/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn()
  })
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

describe('messageChainMap migration logic test', () => {
  let mockSession: any
  let services: any
  let conversationMessages: any
  let optimizationMode: any
  let selectedOptimizeModel: any
  let selectedTemplate: any
  let selectedIterateTemplate: any

  beforeEach(() => {
    // Mock the session store (standard mode, fields exposed directly)
    mockSession = {
      selectedMessageId: '',
      messageChainMap: {},
      selectMessage: vi.fn(),
      setMessageChainMap: vi.fn()
    }

    vi.mocked(useProMultiMessageSession).mockReturnValue(mockSession)

    // Mock services
    services = ref<AppServices | null>({
      historyManager: {
        getChain: vi.fn(),
        createNewChain: vi.fn(),
        addIteration: vi.fn()
      },
      promptService: {}
    } as any)

    conversationMessages = ref([])
    optimizationMode = ref('system')
    selectedOptimizeModel = ref('test-model')
    selectedTemplate = ref({ id: 'test-template', name: 'Test Template' })
    selectedIterateTemplate = ref({ id: 'test-iterate-template', name: 'Test Iterate Template' })
  })

  it('should migrate legacy keys (system:messageId) to the new format (messageId)', () => {
    // Prepare legacy-format data
    mockSession.messageChainMap = {
      'system:msg-123': 'chain-abc',
      'system:msg-456': 'chain-def',
      'user:msg-789': 'chain-ghi'
    }

    // Create the composable
    const composable = useConversationOptimization(
      services,
      conversationMessages,
      optimizationMode,
      selectedOptimizeModel,
      selectedTemplate,
      selectedIterateTemplate
    )

    // Trigger restore (simulates session restore on app startup)
    composable.restoreFromSessionStore()

    // Verify messageChainMap uses the new format
    expect(composable.messageChainMap.value.get('msg-123')).toBe('chain-abc')
    expect(composable.messageChainMap.value.get('msg-456')).toBe('chain-def')
    expect(composable.messageChainMap.value.get('msg-789')).toBe('chain-ghi')

    // Verify legacy keys no longer exist
    expect(composable.messageChainMap.value.has('system:msg-123')).toBe(false)
    expect(composable.messageChainMap.value.has('system:msg-456')).toBe(false)
    expect(composable.messageChainMap.value.has('user:msg-789')).toBe(false)

    // Verify the session store is saved automatically after migration
    expect(mockSession.setMessageChainMap).toHaveBeenCalledWith({
      'msg-123': 'chain-abc',
      'msg-456': 'chain-def',
      'msg-789': 'chain-ghi'
    })
  })

  it('should handle new-format keys correctly (no migration needed)', () => {
    // Prepare new-format data
    mockSession.messageChainMap = {
      'msg-123': 'chain-abc',
      'msg-456': 'chain-def'
    }

    const composable = useConversationOptimization(
      services,
      conversationMessages,
      optimizationMode,
      selectedOptimizeModel,
      selectedTemplate,
      selectedIterateTemplate
    )

    composable.restoreFromSessionStore()

    // Verify the data is restored correctly
    expect(composable.messageChainMap.value.get('msg-123')).toBe('chain-abc')
    expect(composable.messageChainMap.value.get('msg-456')).toBe('chain-def')

    // Verify no migration save was triggered (since everything is in the new format)
    expect(mockSession.setMessageChainMap).not.toHaveBeenCalled()
  })

  it('should handle mixed-format data correctly (some legacy, some new)', () => {
    // Prepare mixed-format data
    mockSession.messageChainMap = {
      'system:msg-old-1': 'chain-old-1',
      'msg-new-1': 'chain-new-1',
      'user:msg-old-2': 'chain-old-2',
      'msg-new-2': 'chain-new-2'
    }

    const composable = useConversationOptimization(
      services,
      conversationMessages,
      optimizationMode,
      selectedOptimizeModel,
      selectedTemplate,
      selectedIterateTemplate
    )

    composable.restoreFromSessionStore()

    // Verify all data uses the new format
    expect(composable.messageChainMap.value.get('msg-old-1')).toBe('chain-old-1')
    expect(composable.messageChainMap.value.get('msg-new-1')).toBe('chain-new-1')
    expect(composable.messageChainMap.value.get('msg-old-2')).toBe('chain-old-2')
    expect(composable.messageChainMap.value.get('msg-new-2')).toBe('chain-new-2')

    // Verify the save after migration
    expect(mockSession.setMessageChainMap).toHaveBeenCalledWith({
      'msg-old-1': 'chain-old-1',
      'msg-new-1': 'chain-new-1',
      'msg-old-2': 'chain-old-2',
      'msg-new-2': 'chain-new-2'
    })
  })

  it('should handle empty data correctly', () => {
    mockSession.messageChainMap = {}

    const composable = useConversationOptimization(
      services,
      conversationMessages,
      optimizationMode,
      selectedOptimizeModel,
      selectedTemplate,
      selectedIterateTemplate
    )

    composable.restoreFromSessionStore()

    // Verify the Map is empty
    expect(composable.messageChainMap.value.size).toBe(0)

    // Verify no save was triggered
    expect(mockSession.setMessageChainMap).not.toHaveBeenCalled()
  })

  it('should ignore migration for non-system modes (only triggered in Pro-system mode)', () => {
    mockSession.messageChainMap = {
      'system:msg-123': 'chain-abc'
    }

    // Switch to user mode
    optimizationMode.value = 'user'

    const composable = useConversationOptimization(
      services,
      conversationMessages,
      optimizationMode,
      selectedOptimizeModel,
      selectedTemplate,
      selectedIterateTemplate
    )

    composable.restoreFromSessionStore()

    // Verify the Map is still empty (because it is not system mode)
    expect(composable.messageChainMap.value.size).toBe(0)

    // Verify no save was triggered
    expect(mockSession.setMessageChainMap).not.toHaveBeenCalled()
  })

  it('should use strict prefix matching and not wrongly migrate messageIds containing :', () => {
    // Prepare mixed data: legacy format, new format, and messageIds containing : that are not legacy format
    mockSession.messageChainMap = {
      'system:msg-123': 'chain-abc',         // Legacy format, should be migrated
      'msg-with:colon': 'chain-def',         // New format but contains :, should not be migrated
      'random:prefix:msg': 'chain-ghi',      // New format but contains multiple :, should not be migrated
      'user:msg-456': 'chain-jkl'            // Legacy format, should be migrated
    }

    const composable = useConversationOptimization(
      services,
      conversationMessages,
      optimizationMode,
      selectedOptimizeModel,
      selectedTemplate,
      selectedIterateTemplate
    )

    composable.restoreFromSessionStore()

    // Verify the legacy format was migrated correctly
    expect(composable.messageChainMap.value.get('msg-123')).toBe('chain-abc')
    expect(composable.messageChainMap.value.get('msg-456')).toBe('chain-jkl')

    // Verify new-format messageIds containing : are kept as-is (not wrongly migrated)
    expect(composable.messageChainMap.value.get('msg-with:colon')).toBe('chain-def')
    expect(composable.messageChainMap.value.get('random:prefix:msg')).toBe('chain-ghi')

    // Verify legacy keys no longer exist
    expect(composable.messageChainMap.value.has('system:msg-123')).toBe(false)
    expect(composable.messageChainMap.value.has('user:msg-456')).toBe(false)

    // Verify the save after migration
    expect(mockSession.setMessageChainMap).toHaveBeenCalledWith({
      'msg-123': 'chain-abc',
      'msg-with:colon': 'chain-def',
      'random:prefix:msg': 'chain-ghi',
      'msg-456': 'chain-jkl'
    })
  })

  it('should support all known legacy format prefixes (system, user, basic, pro, image)', () => {
    // Prepare data with all legacy format prefixes
    mockSession.messageChainMap = {
      'system:msg-1': 'chain-1',
      'user:msg-2': 'chain-2',
      'basic:msg-3': 'chain-3',
      'pro:msg-4': 'chain-4',
      'image:msg-5': 'chain-5'
    }

    const composable = useConversationOptimization(
      services,
      conversationMessages,
      optimizationMode,
      selectedOptimizeModel,
      selectedTemplate,
      selectedIterateTemplate
    )

    composable.restoreFromSessionStore()

    // Verify all prefixes were migrated correctly
    expect(composable.messageChainMap.value.get('msg-1')).toBe('chain-1')
    expect(composable.messageChainMap.value.get('msg-2')).toBe('chain-2')
    expect(composable.messageChainMap.value.get('msg-3')).toBe('chain-3')
    expect(composable.messageChainMap.value.get('msg-4')).toBe('chain-4')
    expect(composable.messageChainMap.value.get('msg-5')).toBe('chain-5')

    // Verify the save after migration
    expect(mockSession.setMessageChainMap).toHaveBeenCalled()
  })
})
