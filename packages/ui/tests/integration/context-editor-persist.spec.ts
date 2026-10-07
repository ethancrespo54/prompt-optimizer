import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import ContextEditor from '../../src/components/context-mode/ContextEditor.vue'
import { createContextRepo, MemoryStorageProvider } from '@prompt-optimizer/core'
import type { ContextRepo } from '@prompt-optimizer/core'

// Mock Naive UI components
vi.mock('naive-ui', () => ({
  NModal: {
    name: 'NModal',
    template: `
      <div v-if="show" class="n-modal" data-testid="modal">
        <div class="n-card">
          <div class="n-card__header">
            <slot name="header" />{{ title }}<slot name="header-extra" />
          </div>
          <div class="n-card__content"><slot /></div>
        </div>
      </div>
    `,
    props: ['show', 'preset', 'title', 'style', 'size', 'bordered', 'segmented', 'maskClosable'],
    emits: ['update:show', 'afterEnter', 'afterLeave']
  },
  NTabs: {
    name: 'NTabs',
    template: '<div class="n-tabs" data-testid="tabs"><slot /></div>',
    props: ['value', 'type', 'size'],
    emits: ['update:value']
  },
  NTabPane: {
    name: 'NTabPane',
    template: '<div class="n-tab-pane" v-if="$parent.value === name || !$parent.value" :data-testid="`tab-${name}`"><slot /></div>',
    props: ['name', 'tab']
  },
  NCard: {
    name: 'NCard',
    template: `<div class="n-card"><div class="n-card__header" v-if="$slots.header"><slot name="header" /></div><div class="n-card__content"><slot /></div></div>`,
    props: ['size', 'bordered', 'embedded', 'hoverable', 'dashed']
  },
  NSpace: {
    name: 'NSpace',
    template: '<div class="n-space"><slot /></div>',
    props: ['justify', 'align', 'size', 'wrap']
  },
  NText: {
    name: 'NText',
    template: '<span class="n-text"><slot /></span>',
    props: ['class', 'depth', 'strong']
  },
  NTag: {
    name: 'NTag',
    template: '<span class="n-tag" :data-type="type"><slot name="icon" /><slot /></span>',
    props: ['size', 'type', 'round']
  },
  NButton: {
    name: 'NButton',
    template: '<button class="n-button" :disabled="disabled" :loading="loading" @click="$emit(\'click\')" :data-testid="$attrs[\'data-testid\'] || \'button\'"><slot name="icon" /><slot /></button>',
    props: ['type', 'disabled', 'loading', 'size', 'dashed', 'block', 'quaternary', 'circle', 'secondary'],
    emits: ['click']
  },
  NEmpty: {
    name: 'NEmpty',
    template: '<div class="n-empty" data-testid="empty"><slot name="icon" /><div><slot /></div><slot name="extra" /></div>',
    props: ['description', 'size']
  },
  NScrollbar: {
    name: 'NScrollbar',
    template: '<div class="n-scrollbar"><slot /></div>',
    props: ['style']
  },
  NList: {
    name: 'NList',
    template: '<div class="n-list"><slot /></div>'
  },
  NListItem: {
    name: 'NListItem',
    template: '<div class="n-list-item"><slot /></div>'
  },
  NInput: {
    name: 'NInput',
    template: '<textarea v-if="type === \'textarea\'" class="n-input" :value="value" :placeholder="placeholder" :disabled="disabled" @input="$emit(\'update:value\', $event.target.value)" data-testid="textarea"></textarea>',
    props: ['value', 'type', 'placeholder', 'autosize', 'size', 'disabled', 'readonly'],
    emits: ['update:value']
  },
  NSelect: {
    name: 'NSelect',
    template: '<select class="n-select" :value="value" @change="$emit(\'update:value\', $event.target.value)" data-testid="select"><option v-for="opt in options" :key="opt.value" :value="opt.value">{{opt.label}}</option></select>',
    props: ['value', 'options', 'size', 'disabled'],
    emits: ['update:value']
  },
  NGrid: {
    name: 'NGrid',
    template: '<div class="n-grid"><slot /></div>',
    props: ['cols', 'xGap', 'yGap']
  },
  NGridItem: {
    name: 'NGridItem',
    template: '<div class="n-grid-item"><slot /></div>'
  }
}))

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: any) => {
      const translations: Record<string, any> = {
        'contextEditor.noMessages': 'No messages yet',
        'contextEditor.addFirstMessage': 'Add the first message',
        'contextEditor.addMessage': 'Add message',
        'contextEditor.noVariables': 'No variables yet',
        'contextEditor.addFirstVariable': 'Add the first variable override',
        'contextEditor.addVariable': 'Add variable',
        'contextEditor.variableOverrides': 'Context variable overrides',
        'contextEditor.globalVariables': `Global: ${params?.count || 0}`,
        'contextEditor.overrideCount': `${params?.count || 0} overrides`,
        'contextEditor.missingVariableHint': 'Click a missing variable to enter edit mode',
        'conversation.clickToCreateVariable': 'Click to create variable',
        'common.edit': 'Edit',
        'common.preview': 'Preview',
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.delete': 'Delete',
        'common.moveUp': 'Move up',
        'common.moveDown': 'Move down'
      }
      return translations[key] || key
    },
    locale: ref('en-US')
  })
}))

// Mock composables
vi.mock('../../src/composables/useResponsive', () => ({
  useResponsive: () => ({
    modalWidth: { value: '90vw' },
    buttonSize: { value: 'medium' },
    inputSize: { value: 'medium' },
    cardSize: { value: 'small' },
    tagSize: { value: 'small' },
    size: { value: 'medium' },
    shouldUseVerticalLayout: { value: false },
    isMobile: { value: false }
  })
}))

vi.mock('../../src/composables/useAccessibility', () => ({
  useAccessibility: () => ({
    aria: {
      getLabel: (key: string, fallback?: string) => fallback || key,
      getDescription: (key: string) => key,
      getLiveRegionText: (key: string) => key
    },
    announce: vi.fn(),
    accessibilityClasses: { value: {} },
    isAccessibilityMode: { value: false },
    liveRegionMessage: { value: '' },
    announcements: { value: [] } // Add the missing announcements property
  })
}))

// Mock useTemporaryVariables (temporary variable manager)
vi.mock('../../src/composables/variable/useTemporaryVariables', () => ({
  useTemporaryVariables: () => ({
    temporaryVariables: { value: {} },
    setVariable: vi.fn(),
    getVariable: vi.fn(() => undefined),
    deleteVariable: vi.fn(),
    clearAll: vi.fn(),
    hasVariable: vi.fn(() => false),
    listVariables: vi.fn(() => ({})),
    batchSet: vi.fn(),
    batchDelete: vi.fn()
  })
}))

// Mock useContextEditor
const mockContextEditor = {
  currentData: { value: null },
  isLoading: { value: false },
  smartImport: vi.fn(),
  convertFromOpenAI: vi.fn(),
  convertFromLangFuse: vi.fn(),
  importFromFile: vi.fn(),
  exportToFile: vi.fn(),
  exportToClipboard: vi.fn(),
  setData: vi.fn()
}

vi.mock('../../src/composables/useContextEditor', () => ({
  useContextEditor: () => mockContextEditor
}))

/**
 * Test component wrapper that integrates ContextRepo for persistence testing
 */
const TestContextEditorWithPersistence = {
  name: 'TestContextEditorWithPersistence',
  props: {
    initialState: {
      type: Object,
      default: () => ({
        messages: [],
        variables: {},
        tools: [],
        showVariablePreview: true,
        showToolManager: false,
        mode: 'edit'
      })
    }
  },
  setup(props: any, { emit }: any) {
    const visible = ref(true)
    const storage = new MemoryStorageProvider()
    const contextRepo = createContextRepo(storage)
    const currentContextId = ref<string | null>(null)

    // Mock the variable scanning function
    const scanVariables = (content: string): string[] => {
      if (!content) return []
      const matches = content.match(/\{\{([^}]+)\}\}/g) || []
      return matches.map(match => match.slice(2, -2))
    }

    // Mock the variable replacement function
    const replaceVariables = (content: string, vars?: Record<string, string>): string => {
      if (!content) return content
      const allVars = { ...vars }
      let result = content
      Object.entries(allVars).forEach(([key, value]) => {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
      })
      return result
    }

    // Check whether this is a predefined variable
    const isPredefinedVariable = (name: string): boolean => {
      const predefined = ['originalPrompt', 'currentPrompt', 'userQuestion', 'conversationContext', 'iterateInput', 'lastOptimizedPrompt', 'toolsContext']
      return predefined.includes(name)
    }

    // Mock variableManager
    const mockVariableManager = {
      variableManager: ref(null),
      isReady: ref(true),
      isAdvancedMode: ref(false),
      customVariables: ref<Record<string, string>>({}),
      allVariables: ref<Record<string, string>>({}),
      statistics: ref({
        customVariableCount: 0,
        predefinedVariableCount: 7,
        totalVariableCount: 7,
        advancedModeEnabled: false
      }),
      setAdvancedMode: vi.fn(),
      addVariable: vi.fn(),
      updateVariable: vi.fn(),
      deleteVariable: vi.fn(),
      getVariable: vi.fn((name: string) => undefined),
      validateVariableName: vi.fn(() => true),
      scanVariablesInContent: vi.fn(scanVariables),
      replaceVariables: vi.fn(replaceVariables),
      detectMissingVariables: vi.fn(() => []),
      getConversationMessages: vi.fn(() => []),
      setConversationMessages: vi.fn(),
      exportVariables: vi.fn(() => '{}'),
      importVariables: vi.fn(),
      refresh: vi.fn()
    }
    
    // Handle state updates and persist them
    const handleStateUpdate = async (newState: any) => {
      if (!currentContextId.value) {
        // Create a new context
        currentContextId.value = await contextRepo.create({ title: 'Test context' })
      }
      
      // Persist to ContextRepo
      await contextRepo.update(currentContextId.value, {
        messages: newState.messages || [],
        variables: newState.variables || {}
      })
      
      emit('stateChanged', newState)
    }
    
    // Handle context changes
    const handleContextChange = async (messages: any[], variables: Record<string, string>) => {
      if (!currentContextId.value) {
        currentContextId.value = await contextRepo.create({ title: 'Test context' })
      }
      
      await contextRepo.update(currentContextId.value, {
        messages: messages || [],
        variables: variables || {}
      })
      
      emit('contextChanged', { messages, variables })
    }
    
    // Simulate data recovery after a refresh
    const simulateRefresh = async () => {
      if (currentContextId.value) {
        const contextData = await contextRepo.get(currentContextId.value)
        return {
          messages: contextData.messages,
          variables: contextData.variables,
          tools: contextData.tools || [],
          showVariablePreview: true,
          showToolManager: false,
          mode: 'edit'
        }
      }
      return props.initialState
    }
    
    return {
      visible,
      contextRepo,
      currentContextId,
      scanVariables,
      replaceVariables,
      isPredefinedVariable,
      handleStateUpdate,
      handleContextChange,
      simulateRefresh,
      mockVariableManager
    }
  },
  template: `
    <div data-testid="context-editor-with-persistence">
      <ContextEditor
        v-model:visible="visible"
        :state="initialState"
        :scan-variables="scanVariables"
        :replace-variables="replaceVariables"
        :is-predefined-variable="isPredefinedVariable"
        :variable-manager="mockVariableManager"
        @update:state="handleStateUpdate"
        @contextChange="handleContextChange"
      />
    </div>
  `,
  components: {
    ContextEditor
  }
}

describe('ContextEditor persistence integration test', () => {
  let wrapper: VueWrapper<any>
  
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })
  
  const createPersistenceWrapper = async (initialState = {}) => {
    const defaultState = {
      messages: [],
      variables: {},
      tools: [],
      showVariablePreview: true,
      showToolManager: false,
      mode: 'edit'
    }
    
    wrapper = mount(TestContextEditorWithPersistence, {
      props: {
        initialState: { ...defaultState, ...initialState }
      },
      global: {
        stubs: {},
        mocks: {
          announcements: []  // Add the mock globally
        }
      }
    })
    
    await nextTick()
    return wrapper
  }

  describe('Core persistence verification', () => {
    it('should create ContextRepo and support basic persistence', async () => {
      wrapper = await createPersistenceWrapper()
      
      // Verify the wrapper component created the storage and repo correctly (via component instance methods)
      expect(wrapper.vm.contextRepo).toBeDefined()
      expect(wrapper.vm.currentContextId).toBeDefined()
      
      // Verify the helper functions are available
      expect(typeof wrapper.vm.scanVariables).toBe('function')
      expect(typeof wrapper.vm.replaceVariables).toBe('function') 
      expect(typeof wrapper.vm.isPredefinedVariable).toBe('function')
      expect(typeof wrapper.vm.simulateRefresh).toBe('function')
    })
    
    it('should support variable scanning and replacement', async () => {
      wrapper = await createPersistenceWrapper()
      
      // Test variable scanning
      const content = 'Hello {{name}}, your task is {{task}}'
      const variables = wrapper.vm.scanVariables(content)
      expect(variables).toEqual(['name', 'task'])
      
      // Test variable replacement
      const values = { name: 'Alice', task: 'testing' }
      const replaced = wrapper.vm.replaceVariables(content, values)
      expect(replaced).toBe('Hello Alice, your task is testing')
      
      // Test predefined variable detection
      expect(wrapper.vm.isPredefinedVariable('originalPrompt')).toBe(true)
      expect(wrapper.vm.isPredefinedVariable('customVar')).toBe(false)
    })
    
    it('should support context data persistence', async () => {
      const testState = {
        messages: [
          { role: 'system', content: 'Test {{mode}} message' }
        ],
        variables: { mode: 'integration' }
      }
      
      wrapper = await createPersistenceWrapper(testState)
      
      // Simulate persisting a state update
      await wrapper.vm.handleStateUpdate({
        messages: [
          ...testState.messages,
          { role: 'user', content: 'User message with {{param}}' }
        ],
        variables: { ...testState.variables, param: 'value' }
      })
      
      // Verify the context was created
      expect(wrapper.vm.currentContextId).toBeTruthy()
      
      // Verify the state update event was emitted
      expect(wrapper.emitted('stateChanged')).toBeTruthy()
    })
    
    it('should support data recovery after a refresh', async () => {
      const initialData = {
        messages: [
          { role: 'user', content: 'Initial message with {{var}}' }
        ],
        variables: { var: 'initial' }
      }
      
      wrapper = await createPersistenceWrapper(initialData)
      
      // Simulate a data modification
      await wrapper.vm.handleContextChange(
        [
          ...initialData.messages,
          { role: 'assistant', content: 'Response with {{response}}' }
        ],
        { ...initialData.variables, response: 'result' }
      )
      
      // Verify the context was created and has data
      expect(wrapper.vm.currentContextId).toBeTruthy()
      
      // Simulate recovery after a refresh
      const restoredState = await wrapper.vm.simulateRefresh()
      
      // Verify the data was recovered correctly
      expect(restoredState.messages).toHaveLength(2)
      expect(restoredState.messages[1].content).toBe('Response with {{response}}')
      expect(restoredState.variables.response).toBe('result')
      expect(restoredState.variables.var).toBe('initial')
    })
    
    it('should ensure variable preview consistency', async () => {
      wrapper = await createPersistenceWrapper()
      
      const testContent = 'Processing {{task}} in {{mode}} environment'
      const testVariables = { task: 'analysis', mode: 'production' }
      
      // Verify the variable scanning result
      const detectedVars = wrapper.vm.scanVariables(testContent)
      expect(detectedVars).toEqual(['task', 'mode'])
      
      // Verify full replacement
      const fullyReplaced = wrapper.vm.replaceVariables(testContent, testVariables)
      expect(fullyReplaced).toBe('Processing analysis in production environment')
      
      // Verify missing variable handling
      const partialVars = { task: 'analysis' } // mode is missing
      const partiallyReplaced = wrapper.vm.replaceVariables(testContent, partialVars)
      expect(partiallyReplaced).toBe('Processing analysis in {{mode}} environment')
      
      // Verify missing variable detection
      const availableVars = Object.keys(partialVars)
      const missingVars = detectedVars.filter(v => !availableVars.includes(v))
      expect(missingVars).toEqual(['mode'])
    })
  })
})
