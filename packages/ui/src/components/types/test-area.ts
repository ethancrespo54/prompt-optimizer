import type { Slot } from 'vue'

import type { OptimizationMode, ToolCallResult } from '@prompt-optimizer/core'

// Base size types
export type ComponentSize = 'small' | 'medium' | 'large'
export type LayoutMode = 'compact' | 'normal' | 'minimal'
export type ButtonSize = 'small' | 'medium' | 'large'

// TestInputSection component types
export interface TestInputSectionProps {
  modelValue: string
  label: string
  placeholder?: string
  helpText?: string
  disabled?: boolean
  size?: ComponentSize
  mode?: 'compact' | 'normal'
  enableFullscreen?: boolean
  minRows?: number
  maxRows?: number

  /** E2E: stable selector for the textarea input */
  testId?: string
}

export interface TestInputSectionEmits {
  'update:modelValue': [value: string]
}

// TestControlBar component types
export interface TestControlBarProps {
  // Model selection-related
  modelLabel: string
  
  // Compare mode control
  showCompareToggle?: boolean
  isCompareMode?: boolean
  
  // Primary action button
  primaryActionText: string
  primaryActionDisabled?: boolean
  primaryActionLoading?: boolean

  /** E2E: stable selector for compare toggle */
  compareToggleTestId?: string

  /** E2E: stable selector for primary action button */
  primaryActionTestId?: string
  
  // Layout config
  layout?: 'default' | 'compact' | 'minimal'
  buttonSize?: ButtonSize
  
  // Responsive config
  modelSelectSpan?: number
  controlButtonsSpan?: number
}

export interface TestControlBarEmits {
  'compare-toggle': []
  'primary-action': []
}

// TestResultSection component types
export interface TestResultSectionProps {
  // Layout mode
  isCompareMode?: boolean
  verticalLayout?: boolean
  showOriginal?: boolean
  
  // Title config
  originalTitle?: string
  optimizedTitle?: string
  singleResultTitle?: string
  
  // Size config
  cardSize?: ComponentSize
  
  // Spacing config
  gap?: string | number
}

// TestAreaPanel main container component types
export interface TestAreaPanelProps {
  // Core state
  optimizationMode: OptimizationMode
  isTestRunning?: boolean
  advancedModeEnabled?: boolean
  
  // Test content
  testContent?: string
  isCompareMode?: boolean
  
  // Feature toggles
  enableCompareMode?: boolean
  enableFullscreen?: boolean

  /** E2E: stable selector prefix, e.g. "basic-system" */
  testIdPrefix?: string
  
  // Layout config
  inputMode?: 'compact' | 'normal'
  controlBarLayout?: 'default' | 'compact' | 'minimal'
  buttonSize?: ButtonSize
  conversationMaxHeight?: string
  
  // Result display config
  showOriginalResult?: boolean
  resultVerticalLayout?: boolean
  originalResultTitle?: string
  optimizedResultTitle?: string
  singleResultTitle?: string
}

export interface TestAreaPanelEmits {
  'update:testContent': [value: string]
  'update:isCompareMode': [value: boolean]
  'test': []
  'compare-toggle': []
}

// Config object types
export interface TestAreaConfig {
  // Global layout config
  layout: {
    inputMode: 'compact' | 'normal'
    controlBarLayout: 'default' | 'compact' | 'minimal'
    buttonSize: ButtonSize
    enableFullscreen: boolean
  }
  
  // Feature toggles
  features: {
    compareMode: boolean
    conversationManager: boolean
    advancedMode: boolean
  }
  
  // Height config
  heights: {
    testInputMin: number
    testInputMax: number
    conversationMax: string
  }
  
  // Responsive breakpoint config
  responsive: {
    modelSelectSpan: {
      xs: number
      sm: number
      md: number
      lg: number
    }
    controlButtonsSpan: {
      xs: number
      sm: number
      md: number
      lg: number
    }
  }
}

// Control layout config types
export interface TestControlLayout {
  modelSelect: {
    span: number
    responsive: Record<string, number>
  }
  controls: {
    span: number
    responsive: Record<string, number>
    justification: 'start' | 'center' | 'end' | 'space-between'
  }
  buttons: {
    size: ButtonSize
    spacing: number
    primary: {
      type: 'primary' | 'default' | 'tertiary'
      ghost: boolean
    }
    secondary: {
      type: 'primary' | 'default' | 'tertiary'
      ghost: boolean
    }
  }
}

// Test result config types
export interface TestResultConfig {
  compareMode: {
    enabled: boolean
    layout: 'horizontal' | 'vertical'
    showOriginal: boolean
  }
  singleMode: {
    title: string
    showToolbar: boolean
  }
  display: {
    cardSize: ComponentSize
    gap: string | number
    enableDiff: boolean
    enableFullscreen: boolean
  }
}

// Tool call state exposed by TestAreaPanel
export interface TestAreaToolCallState {
  original: ToolCallResult[]
  optimized: ToolCallResult[]
}

// Component instance types
// TestAreaPanelInstance is compatible with both TestAreaPanel and ConversationTestPanel
export interface TestAreaPanelInstance {
  clearToolCalls: (testType?: 'original' | 'optimized' | 'both') => void
  handleToolCall: (toolCall: ToolCallResult, testType: 'original' | 'optimized') => void
  getToolCalls: () => TestAreaToolCallState
  getVariableValues: () => Record<string, string>
  setVariableValues: (values: Record<string, string>) => void
  showPreview: () => void
  hidePreview: () => void
}

// Slot type definitions
export interface TestAreaSlots {
  'model-select'?: Slot
  'secondary-controls'?: Slot
  'custom-actions'?: Slot
  'conversation-manager'?: Slot
  'original-result'?: Slot
  'optimized-result'?: Slot
  'single-result'?: Slot
}

// Event callback types
export type TestAreaEventCallbacks = {
  onTest?: () => void | Promise<void>
  onCompareToggle?: (isCompareMode: boolean) => void
  onTestContentChange?: (content: string) => void
  onModelChange?: (modelKey: string) => void
}

// Factory function types
export type CreateTestAreaConfig = (options?: Partial<TestAreaConfig>) => TestAreaConfig

// Preset config types
export interface TestAreaPresets {
  basic: TestAreaConfig
  advanced: TestAreaConfig
  compact: TestAreaConfig
  minimal: TestAreaConfig
}
