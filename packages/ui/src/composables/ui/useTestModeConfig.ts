import { computed, readonly, type Ref, type ComputedRef } from 'vue'

import type { OptimizationMode } from '@prompt-optimizer/core'

export interface TestModeConfigOptions {
  // Whether to enable advanced mode features
  enableAdvancedFeatures?: boolean
  
  // Custom mode config
  customModeConfig?: Partial<TestModeConfigMap>
  
  // Default config overrides
  defaultOverrides?: {
    showTestInput?: boolean
    enableCompareMode?: boolean
    enableConversationManager?: boolean
  }
}

export interface TestModeConfig {
  // Display control
  showTestInput: boolean
  showConversationManager: boolean
  
  // Feature toggles
  enableCompareMode: boolean
  enableFullscreen: boolean
  
  // UI config
  inputMode: 'compact' | 'normal'
  controlBarLayout: 'default' | 'compact' | 'minimal'
  
  // Text config
  inputLabel: string
  inputPlaceholder: string
  inputHelpText: string
  primaryButtonText: string
  
  // Validation config
  requiresTestContent: boolean
  canStartTest: (testContent: string, hasPrompt: boolean) => boolean
}

interface TestModeConfigMap {
  system: TestModeConfig
  user: TestModeConfig
}

type OptimizationModeSource = Ref<OptimizationMode> | ComputedRef<OptimizationMode>

export function useTestModeConfig(
  optimizationMode: OptimizationModeSource, 
  options: TestModeConfigOptions = {}
) {
  const {
    enableAdvancedFeatures = true,
    customModeConfig,
    defaultOverrides
  } = options

  // Default mode config
  const defaultModeConfigs: TestModeConfigMap = {
    system: {
      // Display control
      showTestInput: true, // System prompt mode needs test input
      showConversationManager: enableAdvancedFeatures,
      
      // Feature toggles
      enableCompareMode: true,
      enableFullscreen: true,
      
      // UI config
      inputMode: 'normal',
      controlBarLayout: 'default',
      
      // Text config
      inputLabel: 'test.content',
      inputPlaceholder: 'test.placeholder', 
      inputHelpText: 'test.simpleMode.help',
      primaryButtonText: 'test.startTest',
      
      // Validation config
      requiresTestContent: true,
      canStartTest: (testContent: string, hasPrompt: boolean) => {
        return hasPrompt && testContent.trim() !== ''
      }
    },
    
    user: {
      // Display control
      showTestInput: false, // User prompt mode needs no extra test input
      showConversationManager: enableAdvancedFeatures,
      
      // Feature toggles
      enableCompareMode: true,
      enableFullscreen: true,
      
      // UI config
      inputMode: 'normal',
      controlBarLayout: 'default',
      
      // Text config
      inputLabel: 'test.userPromptTest',
      inputPlaceholder: '',
      inputHelpText: '',
      primaryButtonText: 'test.startTest',
      
      // Validation config
      requiresTestContent: false,
      canStartTest: (testContent: string, hasPrompt: boolean) => {
        return hasPrompt // Only a prompt is required
      }
    }
  }

  // Merge the custom config
  const modeConfigs = computed(() => {
    const merged = { ...defaultModeConfigs }
    
    if (customModeConfig) {
      Object.keys(customModeConfig).forEach(mode => {
        const modeKey = mode as keyof TestModeConfigMap
        if (merged[modeKey]) {
          merged[modeKey] = { ...merged[modeKey], ...customModeConfig[modeKey] }
        }
      })
    }
    
    // Apply the default overrides
    if (defaultOverrides) {
      Object.keys(merged).forEach(mode => {
        const modeKey = mode as keyof TestModeConfigMap
        merged[modeKey] = { ...merged[modeKey], ...defaultOverrides }
      })
    }
    
    return merged
  })

  // Current mode config
  const currentModeConfig = computed<TestModeConfig>(() => {
    return modeConfigs.value[optimizationMode.value] || modeConfigs.value.system
  })

  // Key computed property: solves the interface redundancy problem
  const showTestInput = computed(() => currentModeConfig.value.showTestInput)
  
  const showConversationManager = computed(() => currentModeConfig.value.showConversationManager)
  
  const enableCompareMode = computed(() => currentModeConfig.value.enableCompareMode)
  
  const enableFullscreen = computed(() => currentModeConfig.value.enableFullscreen)

  // UI config
  const inputMode = computed(() => currentModeConfig.value.inputMode)
  
  const controlBarLayout = computed(() => currentModeConfig.value.controlBarLayout)

  // Text config
  const inputLabel = computed(() => currentModeConfig.value.inputLabel)
  
  const inputPlaceholder = computed(() => currentModeConfig.value.inputPlaceholder)
  
  const inputHelpText = computed(() => currentModeConfig.value.inputHelpText)
  
  const primaryButtonText = computed(() => currentModeConfig.value.primaryButtonText)

  // Validation-related
  const requiresTestContent = computed(() => currentModeConfig.value.requiresTestContent)

  // Test start validation
  const canStartTest = computed(() => {
    return (testContent: string, hasPrompt: boolean) => {
      return currentModeConfig.value.canStartTest(testContent, hasPrompt)
    }
  })

  // Mode-specific help info
  const getModeHelpInfo = computed(() => {
    switch (optimizationMode.value) {
      case 'system':
        return {
          title: 'System Prompt Test Mode',
          description: 'In this mode, the original/optimized prompt is used as the system message, and you need to provide a user question for testing.',
          requirements: ['Test content must be provided as the user question', 'Supports comparing the original and optimized versions'],
          features: ['Smart input box', 'Compare mode', 'Fullscreen editing', 'Advanced conversation management']
        }
      case 'user':
        return {
          title: 'User Prompt Test Mode',
          description: 'In this mode, the original/optimized prompt is tested directly as the user message.',
          requirements: ['No extra test content needed', 'Test the prompt effect directly'],
          features: ['Simplified interface', 'Compare mode', 'Fullscreen editing', 'Advanced conversation management']
        }
      default:
        return {
          title: 'Unknown Mode',
          description: 'The current mode configuration is incorrect',
          requirements: [],
          features: []
        }
    }
  })

  // Dynamic button text
  const getDynamicButtonText = (isCompareMode: boolean, isLoading: boolean) => {
    if (isLoading) return 'test.testing'
    
    const baseText = primaryButtonText.value
    if (isCompareMode && enableCompareMode.value) {
      return 'test.startCompare'
    }
    return baseText
  }

  // Validation helper function
  const validateTestSetup = (testContent: string, hasPrompt: boolean) => {
    const errors: string[] = []
    
    if (!hasPrompt) {
      errors.push('A prompt is required')
    }
    
    if (requiresTestContent.value && !testContent.trim()) {
      errors.push('Test content is required')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // Get the config of a specific mode
  const getModeConfig = (mode: OptimizationMode): TestModeConfig => {
    return modeConfigs.value[mode] || modeConfigs.value.system
  }

  // Check the compatibility of a mode switch
  const checkModeCompatibility = (fromMode: OptimizationMode, toMode: OptimizationMode) => {
    const fromConfig = getModeConfig(fromMode)
    const toConfig = getModeConfig(toMode)
    
    return {
      requiresTestContentChange: fromConfig.requiresTestContent !== toConfig.requiresTestContent,
      requiresUIReset: fromConfig.showTestInput !== toConfig.showTestInput,
      compatibilityWarnings: [] as string[]
    }
  }

  return {
    // Core config
    currentModeConfig: readonly(currentModeConfig),
    modeConfigs: readonly(modeConfigs),
    
    // Key computed properties
    showTestInput: readonly(showTestInput),
    showConversationManager: readonly(showConversationManager),
    enableCompareMode: readonly(enableCompareMode),
    enableFullscreen: readonly(enableFullscreen),
    
    // UI config
    inputMode: readonly(inputMode),
    controlBarLayout: readonly(controlBarLayout),
    
    // Text config
    inputLabel: readonly(inputLabel),
    inputPlaceholder: readonly(inputPlaceholder), 
    inputHelpText: readonly(inputHelpText),
    primaryButtonText: readonly(primaryButtonText),
    
    // Validation config
    requiresTestContent: readonly(requiresTestContent),
    canStartTest: readonly(canStartTest),
    
    // Help info
    getModeHelpInfo: readonly(getModeHelpInfo),
    
    // Utility functions
    getDynamicButtonText,
    validateTestSetup,
    getModeConfig,
    checkModeCompatibility
  }
}
