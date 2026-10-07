/**
 * Unified type exports
 */

// Existing types
export * from './variable'
export * from './services'

// Newly added standardized prompt types
export * from './standard-prompt'
export * from './data-converter'

// Advanced module component types
export * from './components'

// Selector option types
export * from './select-options'

// Test area component types
export type {
  ComponentSize,
  LayoutMode,
  ButtonSize,
  TestInputSectionProps,
  TestInputSectionEmits,
  TestControlBarProps,
  TestControlBarEmits,
  TestAreaConfig,
  TestControlLayout,
  TestResultConfig,
  TestAreaPanelInstance,
  TestAreaSlots,
  TestAreaEventCallbacks,
  CreateTestAreaConfig,
  TestAreaPresets
} from '../components/types/test-area'

// Clearly distinguish types with the same name across different modules
export type {
  TestAreaPanelProps as TestAreaPanelLegacyProps,
  TestResultSectionProps as TestResultSectionLegacyProps
} from '../components/types/test-area'