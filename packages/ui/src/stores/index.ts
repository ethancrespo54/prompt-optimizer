/**
 * Pinia Stores unified exports
 */

// Temporary variable store
export {
  useTemporaryVariablesStore,
  type TemporaryVariablesMap,
  type TemporaryVariablesStoreApi,
} from './temporaryVariables'

// PromptDraft store (planned for deprecation, to be replaced by the session stores)
export { usePromptDraftStore, type PromptDraftStoreApi } from './promptDraft'

// Session management
export {
  useSessionManager,
  type SubModeKey,
  type SubModeReaders,
  type SessionManagerApi,
} from './session/useSessionManager'

// Session Stores (organized by sub-mode)
export {
  useBasicSystemSession,
  type BasicSystemSessionState,
  type BasicSystemSessionApi,
} from './session/useBasicSystemSession'

export {
  useBasicUserSession,
  type BasicUserSessionState,
  type BasicUserSessionApi,
} from './session/useBasicUserSession'

export {
  useProMultiMessageSession,
  type ProMultiMessageSessionApi,
} from './session/useProMultiMessageSession'

export {
  useProVariableSession,
  type ProVariableSessionApi,
} from './session/useProVariableSession'

export {
  useImageText2ImageSession,
  type ImageText2ImageSessionApi,
} from './session/useImageText2ImageSession'

export {
  useImageImage2ImageSession,
  type ImageImage2ImageSessionApi,
} from './session/useImageImage2ImageSession'

// Global settings（Phase 1）
export {
  useGlobalSettings,
  type GlobalSettingsState,
  type GlobalSettingsApi,
} from './settings/useGlobalSettings'
