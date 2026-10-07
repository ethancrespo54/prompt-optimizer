/**
 * Evaluation service type definitions
 *
 * Type system providing LLM intelligent evaluation
 */

import type { BasicSubMode, ProSubMode, ImageSubMode } from '../prompt/types';

// ==================== Evaluation types ====================

/**
 * Evaluation type enum
 */
export type EvaluationType =
  | 'original'
  | 'optimized'
  | 'compare'
  | 'prompt-only'      // Prompt-only evaluation (no test results needed)
  | 'prompt-iterate';  // Prompt evaluation with an iteration requirement

/**
 * Union type of all sub-modes (used for evaluation mode configuration)
 */
export type EvaluationSubMode = BasicSubMode | ProSubMode | ImageSubMode;

/**
 * Evaluation mode configuration
 * Specifies the function mode and sub-mode of the evaluation
 */
export interface EvaluationModeConfig {
  /** Function mode */
  functionMode: 'basic' | 'pro' | 'image';
  /** Sub-mode */
  subMode: EvaluationSubMode;
}

// ==================== Pro mode evaluation context ====================

/**
 * Pro-System mode evaluation context
 * Used to evaluate a single message in a multi-message scenario
 */
export interface ProSystemEvaluationContext {
  /** Metadata of the message being optimized */
  targetMessage: {
    /** Message role */
    role: 'system' | 'user' | 'assistant' | 'tool';
    /** Message content (current version) */
    content: string;
    /** Original content (for comparison) */
    originalContent?: string;
  };
  /** Full conversation context */
  conversationMessages: Array<{
    /** Message role */
    role: string;
    /** Message content */
    content: string;
    /** Whether this is the target message being optimized */
    isTarget?: boolean;
  }>;
}

/**
 * Pro-User mode evaluation context
 * Used to evaluate user prompts with variables
 */
export interface ProUserEvaluationContext {
  /** Variable list */
  variables: Array<{
    /** Variable name */
    name: string;
    /** Variable value */
    value: string;
    /** Variable source */
    source: 'predefined' | 'global' | 'temporary';
  }>;
  /** Original prompt (with variable placeholders) */
  rawPrompt: string;
  /** Prompt after variable substitution */
  resolvedPrompt: string;
}

/**
 * Union type of Pro mode evaluation contexts
 */
export type ProEvaluationContext = ProSystemEvaluationContext | ProUserEvaluationContext;

// ==================== Patch operation types ====================

/**
 * Patch operation type
 */
export type PatchOperationType = 'insert' | 'replace' | 'delete';

/**
 * Patch operation - precise fix instruction
 *
 * Design principles:
 * - Use oldText/newText for simple string replacement
 * - Supports diff visualization (red for deletions, green for additions)
 * - Applying locally is just a simple string replace
 *
 * Operation conventions:
 * - Insert: oldText is the anchor context, newText = oldText + inserted content
 * - Delete: newText = ""
 * - Replace: directly oldText → newText
 */
export interface PatchOperation {
  /** Operation type */
  op: PatchOperationType;
  /** Original text fragment before the change (used for locating and diff display) */
  oldText: string;
  /** Text after the change (empty string for deletions) */
  newText: string;
  /** Operation description (includes problem description + fix description) */
  instruction: string;
  /** Occurrence index (starting from 1, used when the text occurs multiple times, default 1) */
  occurrence?: number;
}

// ==================== Evaluation request types ====================

/**
 * Base structure of an evaluation request
 */
export interface EvaluationRequestBase {
  /** Original prompt (optional, for comparison) */
  originalPrompt?: string;
  /** User feedback (optional, for feedback analysis) */
  userFeedback?: string;
  /** Test text/input */
  testContent?: string;
  /** Model key used for the evaluation */
  evaluationModelKey: string;
  /** Optional: custom variables */
  variables?: Record<string, string>;
  /** Evaluation mode configuration (required) */
  mode: EvaluationModeConfig;
  /** Pro mode-specific context (optional) */
  proContext?: ProEvaluationContext;
}

/**
 * Original prompt evaluation request
 * Evaluates whether the test result of the original prompt achieves the user's goal
 */
export interface OriginalEvaluationRequest extends EvaluationRequestBase {
  type: 'original';
  /** Original test result */
  testResult: string;
}

/**
 * Optimized prompt evaluation request
 * Evaluates the test effect of the optimized prompt
 */
export interface OptimizedEvaluationRequest extends EvaluationRequestBase {
  type: 'optimized';
  /** Optimized prompt */
  optimizedPrompt: string;
  /** Optimized test result */
  testResult: string;
}

/**
 * Compare evaluation request
 * Compares the test effect of the original and optimized versions
 */
export interface CompareEvaluationRequest extends EvaluationRequestBase {
  type: 'compare';
  /** Optimized prompt */
  optimizedPrompt: string;
  /** Original test result */
  originalTestResult: string;
  /** Optimized test result */
  optimizedTestResult: string;
}

/**
 * Prompt-only evaluation request
 * Directly evaluates the quality of the prompt itself, no test results needed
 */
export interface PromptOnlyEvaluationRequest extends EvaluationRequestBase {
  type: 'prompt-only';
  /** Optimized prompt */
  optimizedPrompt: string;
}

/**
 * Prompt evaluation request with an iteration requirement
 * Evaluates whether the optimized prompt meets the iteration requirement
 */
export interface PromptIterateEvaluationRequest extends EvaluationRequestBase {
  type: 'prompt-iterate';
  /** Optimized prompt */
  optimizedPrompt: string;
  /** Iteration requirement (from iterationNote) */
  iterateRequirement: string;
}

/**
 * Union type of evaluation requests
 */
export type EvaluationRequest =
  | OriginalEvaluationRequest
  | OptimizedEvaluationRequest
  | CompareEvaluationRequest
  | PromptOnlyEvaluationRequest
  | PromptIterateEvaluationRequest;

// ==================== Evaluation result types ====================

/**
 * A single evaluation dimension
 */
export interface EvaluationDimension {
  /** Dimension identifier */
  key: string;
  /** Localized display name (returned by the template) */
  label: string;
  /** Dimension score (0-100) */
  score: number;
}

/**
 * Evaluation score structure
 */
export interface EvaluationScore {
  /** Overall score (0-100) */
  overall: number;
  /** Per-dimension scores (dynamic array) */
  dimensions: EvaluationDimension[];
}

/**
 * Evaluation response (unified structure)
 */
export interface EvaluationResponse {
  /** Evaluation type */
  type: EvaluationType;
  /** Evaluation score */
  score: EvaluationScore;
  /** Directional improvement suggestions (at most 3, used for iterative rewriting) */
  improvements: string[];
  /** One-sentence summary */
  summary: string;
  /** Precise fix operations (at most 3, used for direct editing) */
  patchPlan: PatchOperation[];
  /** Metadata */
  metadata?: {
    model?: string;
    timestamp?: number;
    duration?: number;
  };
}

// ==================== Streaming evaluation callbacks ====================

/**
 * Streaming evaluation callback handlers
 */
export interface EvaluationStreamHandlers {
  /** Content token received */
  onToken: (token: string) => void;
  /** Score update received (optional) */
  onScore?: (score: Partial<EvaluationScore>) => void;
  /** Evaluation complete */
  onComplete: (response: EvaluationResponse) => void;
  /** Evaluation error */
  onError: (error: Error) => void;
}

// ==================== Service interface ====================

/**
 * Evaluation service interface
 */
export interface IEvaluationService {
  /**
   * Run an evaluation (non-streaming)
   * @param request Evaluation request
   * @returns Evaluation response
   */
  evaluate(request: EvaluationRequest): Promise<EvaluationResponse>;

  /**
   * Streaming evaluation (for real-time display)
   * @param request Evaluation request
   * @param callbacks Streaming callback handlers
   */
  evaluateStream(
    request: EvaluationRequest,
    callbacks: EvaluationStreamHandlers
  ): Promise<void>;
}

// ==================== Evaluation template ID naming rules ====================
//
// Template ID format: evaluation-{functionMode}-{subMode}-{type}
//
// Examples:
//   - evaluation-basic-system-original      (basic mode / system prompt / original evaluation)
//   - evaluation-basic-system-optimized     (basic mode / system prompt / optimized evaluation)
//   - evaluation-basic-system-compare       (basic mode / system prompt / compare evaluation)
//   - evaluation-basic-system-prompt-only   (basic mode / system prompt / prompt-only evaluation)
//   - evaluation-basic-system-prompt-iterate(basic mode / system prompt / iteration requirement evaluation)
//   - evaluation-basic-user-original        (basic mode / user prompt / original evaluation)
//   - evaluation-basic-user-optimized       (basic mode / user prompt / optimized evaluation)
//   - evaluation-basic-user-compare         (basic mode / user prompt / compare evaluation)
//   - evaluation-basic-user-prompt-only     (basic mode / user prompt / prompt-only evaluation)
//   - evaluation-basic-user-prompt-iterate  (basic mode / user prompt / iteration requirement evaluation)
//   - evaluation-pro-multi-original         (Pro mode / multi-message mode / original evaluation)
//   - evaluation-pro-multi-optimized        (Pro mode / multi-message mode / optimized evaluation)
//   - evaluation-pro-multi-compare          (Pro mode / multi-message mode / compare evaluation)
//   - evaluation-pro-multi-prompt-only      (Pro mode / multi-message mode / prompt-only evaluation)
//   - evaluation-pro-multi-prompt-iterate   (Pro mode / multi-message mode / iteration requirement evaluation)
//   - evaluation-pro-variable-original      (Pro mode / variable mode / original evaluation)
//   - evaluation-pro-variable-optimized     (Pro mode / variable mode / optimized evaluation)
//   - evaluation-pro-variable-compare       (Pro mode / variable mode / compare evaluation)
//   - evaluation-pro-variable-prompt-only   (Pro mode / variable mode / prompt-only evaluation)
//   - evaluation-pro-variable-prompt-iterate(Pro mode / variable mode / iteration requirement evaluation)
//
// Template IDs are generated dynamically by EvaluationService.getTemplateId(); no hard-coded constants are needed
