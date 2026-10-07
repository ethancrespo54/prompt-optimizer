/**
 * Unified type definitions for Naive UI components
 * Provides standardized Props and Events interfaces for the advanced module refactoring components
 */

import type {
  ConversationMessage,
  ToolDefinition,
  ToolCallResult,
  AdvancedTestResult,
  ContextEditorState,
  ComponentVisibility,
  VariableImportOptions,
  VariableExportData
} from '@prompt-optimizer/core'
import type { AppServices } from '../types/services'
import type { VariableManagerHooks } from '../composables/prompt/useVariableManager'

/**
 * Base component Props interface
 */
export interface BaseComponentProps {
  /** Whether the component is disabled */
  disabled?: boolean
  /** Component size */
  size?: 'small' | 'medium' | 'large'
  /** Component theme mode (inherited from global) */
  theme?: 'light' | 'dark'
  /** Whether to show the loading state */
  loading?: boolean
}

/**
 * Base component Events interface
 */
export interface BaseComponentEvents {
  /** Generic error event */
  error: (error: Error) => void
  /** Component ready event */
  ready: () => void
}

/**
 * VariableManagerModal component types
 */
export interface VariableManagerModalProps extends BaseComponentProps {
  /** Whether the dialog is visible */
  visible: boolean
  /** Current variable data */
  variables?: Record<string, string>
  /** Whether read-only mode */
  readonly?: boolean
  /** Dialog title */
  title?: string
  /** Dialog width */
  width?: number | string
  /** Whether to show the import/export buttons */
  showImportExport?: boolean
}

export interface VariableManagerModalEvents extends BaseComponentEvents {
  /** Dialog visibility change */
  'update:visible': (visible: boolean) => void
  /** Variable data change */
  'update:variables': (variables: Record<string, string>) => void
  /** Variable change event */
  variableChange: (name: string, value: string, action: 'add' | 'update' | 'delete') => void
  /** Variable import event */
  import: (data: VariableExportData, options?: VariableImportOptions) => void
  /** Variable export event */
  export: () => void
  /** Confirm event */
  confirm: (variables: Record<string, string>) => void
  /** Cancel event */
  cancel: () => void
}

/**
 * ConversationManager component types (context management)
 */
export interface ConversationManagerProps extends BaseComponentProps {
  /** Message list */
  messages: ConversationMessage[]
  /** Available variable set (used for statistics/highlighting) */
  availableVariables: Record<string, string>
  /** 🆕 Temporary variable value set (used for VariableAwareInput) */
  temporaryVariables?: Record<string, string>
  /** Optimization mode (used for template categorization) */
  optimizationMode?: 'system' | 'user'
  /** Variable scanning function (standardized injection) */
  scanVariables?: (content: string) => string[]
  /** Variable replacement function (standardized injection) */
  replaceVariables?: (content: string, variables?: Record<string, string>) => string
  /** Predefined variable check function (standardized injection) */
  isPredefinedVariable?: (name: string) => boolean
  /** Tool count (display statistics only) */
  toolCount?: number
  /** Whether read-only mode */
  readonly?: boolean
  /** Whether to show the variable preview */
  showVariablePreview?: boolean
  /** Maximum height (pixels) */
  maxHeight?: number
  /** Whether collapsible */
  collapsible?: boolean
  /** Title */
  title?: string
  /** 🆕 Currently selected message ID (used for highlighting) */
  selectedMessageId?: string
  /** 🆕 Whether to enable the message optimization feature */
  enableMessageOptimization?: boolean
  /** 🆕 Message optimizing state */
  isMessageOptimizing?: boolean
  /** 🆕 Whether to enable the tool management feature */
  enableToolManagement?: boolean
}

export interface ConversationManagerEvents extends BaseComponentEvents {
  /** Message list change */
  'update:messages': (messages: ConversationMessage[]) => void
  /** Message change event */
  messageChange: (index: number, message: ConversationMessage, action: 'add' | 'update' | 'delete') => void
  /** Open the context editor */
  openContextEditor: (messages: ConversationMessage[], variables?: Record<string, string>) => void
  /** Variable manager open request */
  openVariableManager: (variableName?: string) => void
  /** Message drag sorting */
  messageReorder: (fromIndex: number, toIndex: number) => void
  /** 🆕 Message selected for optimization */
  messageSelect: (message: ConversationMessage) => void
  /** 🆕 Trigger message optimization */
  optimizeMessage: () => void
  /** 🆕 Open the tool manager */
  'open-tool-manager': () => void
  /** 🆕 Variable extraction event */
  'variable-extracted': (data: {
    variableName: string
    variableValue: string
    variableType: 'global' | 'temporary'
  }) => void
  /** 🆕 Add missing variable event */
  'add-missing-variable': (varName: string) => void
}

/**
 * ContextEditor component types (fullscreen context editor)
 */
export interface ContextEditorProps extends BaseComponentProps {
  /** Whether visible */
  visible: boolean
  /** Editor state */
  state?: ContextEditorState
  /** Service instance (used for variable management) */
  services?: AppServices | null
  /** Variable manager instance (required, used for data sync, shared with the global variable manager) */
  variableManager: VariableManagerHooks
  /** Whether to show the tool management tab */
  showToolManager?: boolean
  /** Tool list */
  tools?: ToolDefinition[]
  /** Optimization mode (used for template categorization) */
  optimizationMode?: 'system' | 'user'
  /** Variable scanning function (standardized injection) */
  scanVariables: (content: string) => string[]
  /** Variable replacement function (standardized injection) */
  replaceVariables: (content: string, variables?: Record<string, string>) => string
  /** Predefined variable check function (standardized injection) */
  isPredefinedVariable: (name: string) => boolean
  /** Dialog title */
  title?: string
  /** Dialog width */
  width?: number | string
  /** Dialog height */
  height?: number | string
  /** Default active tab */
  defaultTab?: 'messages' | 'variables' | 'tools'
  /** Only show the specified tab (hides the other tabs and the tab bar) */
  onlyShowTab?: 'messages' | 'variables' | 'tools' | 'templates'
}

export interface ContextEditorEvents extends BaseComponentEvents {
  /** Visibility change */
  'update:visible': (visible: boolean) => void
  /** State change */
  'update:state': (state: ContextEditorState) => void
  /** Tool list change */
  'update:tools': (tools: ToolDefinition[]) => void
  /** Context change */
  contextChange: (messages: ConversationMessage[], variables: Record<string, string>) => void
  /** Tool change */
  toolChange: (tools: ToolDefinition[], action: 'add' | 'update' | 'delete', index?: number) => void
  /** Save event */
  save: (context: { messages: ConversationMessage[]; variables: Record<string, string>; tools: ToolDefinition[] }) => void
  /** Cancel event */
  cancel: () => void
  /** Preview mode toggle */
  previewToggle: (enabled: boolean) => void
  /** Open the variable manager */
  openVariableManager: (focusVariable?: string) => void
  /** Quick-create a variable */
  createVariable: (name: string, defaultValue?: string) => void
}

/**
 * TestAreaPanel integration component types
 */
export interface TestAreaPanelProps extends BaseComponentProps {
  /** Optimization mode */
  optimizationMode?: 'system' | 'user'
  /** Whether to show the test input */
  showTestInput?: boolean
  /** Whether to enable compare mode */
  enableCompareMode?: boolean
  /** Current compare mode state */
  isCompareMode?: boolean
  /** Whether a test is running */
  isTestRunning?: boolean
  /** Whether advanced mode is enabled */
  advancedModeEnabled?: boolean
  /** Test content */
  testContent?: string

  /** E2E: stable selector prefix, e.g. "basic-system" */
  testIdPrefix?: string

  /** Primary action button text */
  primaryActionText?: string
  /** Whether the primary action is disabled */
  primaryActionDisabled?: boolean
  /** Original test result (supports tool call display) */
  originalResult?: AdvancedTestResult
  /** Optimized test result (supports tool call display) */
  optimizedResult?: AdvancedTestResult
  /** Single test result (supports tool call display) */
  singleResult?: AdvancedTestResult
}

export interface TestAreaPanelEvents extends BaseComponentEvents {
  /** Compare mode toggle */
  'update:isCompareMode': (enabled: boolean) => void
  /** Test content change */
  'update:testContent': (content: string) => void
  /** Compare mode toggle event */
  compareToggle: (enabled: boolean) => void
  /** Primary action (test) event */
  primaryAction: () => void
  /** Show the model config */
  showConfig: () => void
  /** Advanced feature events */
  openVariableManager: () => void
  openContextEditor: () => void
  variableChange: (name: string, value: string) => void
  contextChange: (messages: ConversationMessage[], variables: Record<string, string>) => void
}

/**
 * TestResultSection component types
 */
export interface TestResultSectionProps extends BaseComponentProps {
  /** Test result */
  result?: AdvancedTestResult
  /** Whether to show tool call info */
  showToolCalls?: boolean
  /** Whether to show variable usage info */
  showUsedVariables?: boolean
  /** Whether to show metadata */
  showMetadata?: boolean
  /** Maximum height */
  maxHeight?: number | string
}

export interface TestResultSectionEvents extends BaseComponentEvents {
  /** View tool call details */
  toolCallDetail: (toolCall: ToolCallResult) => void
  /** View variable details */
  variableDetail: (variable: string, value: string) => void
  /** Copy the result */
  copyResult: (content: string) => void
  /** Export the result */
  exportResult: (result: AdvancedTestResult) => void
}

/**
 * Generic toolbar button component types
 */
export interface ToolbarButtonProps extends BaseComponentProps {
  /** Button icon */
  icon?: string
  /** Button text */
  text?: string
  /** Button type */
  type?: 'default' | 'primary' | 'success' | 'warning' | 'error'
  /** Whether a ghost button */
  ghost?: boolean
  /** Tooltip text */
  tooltip?: string
  /** Whether to show the badge */
  badge?: boolean
  /** Badge value */
  badgeValue?: number | string
}

export interface ToolbarButtonEvents extends BaseComponentEvents {
  /** Click event */
  click: (event: MouseEvent) => void
}

/**
 * Global state management-related types
 */
export interface AdvancedModuleConfig {
  /** Default component visibility */
  defaultVisibility: ComponentVisibility
  /** Auto-save interval (milliseconds) */
  autoSaveInterval: number
  /** Variable name validation rules */
  variableNamePattern: RegExp
  /** Whether to enable debug mode */
  debugMode: boolean
  /** Maximum number of variables limit */
  maxVariables: number
  /** Maximum number of tools limit */
  maxTools: number
}

/**
 * Component communication data format
 */
export interface ComponentMessage<T = unknown> {
  /** Message type */
  type: string
  /** Message payload */
  payload: T
  /** Send time */
  timestamp: Date
  /** Sender component ID */
  sender?: string
  /** Target component ID */
  target?: string
}

/**
 * Component communication data format
 */
export interface ComponentError {
  /** Error code */
  code: string
  /** Error message */
  message: string
  /** Error details */
  details?: unknown
  /** Component where the error occurred */
  component: string
  /** Error time */
  timestamp: Date
  /** Whether a fatal error */
  fatal: boolean
}

/**
 * Responsive layout-related types
 */
export interface ResponsiveConfig {
  /** Breakpoint config */
  breakpoints: {
    xs: number
    sm: number
    md: number
    lg: number
    xl: number
  }
  /** Current breakpoint */
  currentBreakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** Whether mobile */
  isMobile: boolean
  /** Whether tablet */
  isTablet: boolean
  /** Whether desktop */
  isDesktop: boolean
}

/**
 * Performance monitoring-related types
 */
export interface PerformanceMetrics {
  /** Component render time */
  renderTime: number
  /** Data load time */
  loadTime: number
  /** Memory usage */
  memoryUsage: number
  /** Component update count */
  updateCount: number
  /** Last update time */
  lastUpdate: Date
}

/**
 * ToolManagerModal component types
 */
export interface ToolManagerModalProps extends BaseComponentProps {
  /** Whether the dialog is visible */
  visible: boolean
  /** Tool list */
  tools: ToolDefinition[]
  /** Whether read-only mode */
  readonly?: boolean
  /** Dialog title */
  title?: string
  /** Dialog width */
  width?: string
}

export interface ToolManagerModalEvents extends BaseComponentEvents {
  /** Dialog visibility change */
  'update:visible': (visible: boolean) => void
  /** Tool list change */
  'update:tools': (tools: ToolDefinition[]) => void
  /** Tool change event */
  toolChange: (tools: ToolDefinition[], action: 'add' | 'update' | 'delete', index: number) => void
  /** Confirm event */
  confirm: (tools: ToolDefinition[]) => void
  /** Cancel event */
  cancel: () => void
}
