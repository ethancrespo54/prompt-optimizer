import { PromptRecord } from "../history/types";
import { StreamHandlers } from "../llm/types";

/**
 * Tool-call-related types
 */
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters?: object;
}

export interface ToolDefinition {
  type: "function";
  function: FunctionDefinition;
}

/**
 * Unified message structure
 */
export interface ConversationMessage {
  /**
   * Unique message identifier (generated with uuidv4)
   * Used to establish a stable message-to-optimization-history mapping that is unaffected by array operations
   */
  id?: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string; // May contain variable syntax {{variableName}}
  /**
   * Original content (saved at first creation, used for v0 version restore)
   * This field never changes after creation, even if the message is optimized and modified many times
   */
  originalContent?: string;
  /**
   * Function call name (assistant message)
   */
  name?: string;
  /**
   * Function call list (assistant message)
   */
  tool_calls?: ToolCall[];
  /**
   * Tool call ID (tool message)
   */
  tool_call_id?: string;
}

/**
 * Optimization mode enum
 * Used to distinguish different kinds of prompt optimization
 */
export type OptimizationMode = "system" | "user";

/**
 * Function mode enum (Basic / Pro / Image)
 */
export type FunctionMode = "basic" | "pro" | "image";

/**
 * Sub-mode type definitions (the three function modes are independent)
 * Used to persist the sub-mode selection of each function mode
 */
export type BasicSubMode = "system" | "user"; // Basic mode
export type ProSubMode = "multi" | "variable"; // Pro mode (multi-message / variable)
export type ImageSubMode = "text2image" | "image2image"; // Image mode

/**
 * Optimization request interface
 */
export interface OptimizationRequest {
  optimizationMode: OptimizationMode;
  targetPrompt: string; // The prompt to optimize
  templateId?: string;
  modelKey: string;
  // 🆕 Context mode (used for the variable substitution strategy)
  contextMode?: import("../context/types").ContextMode;
  // New: advanced mode context (optional, backward compatible)
  advancedContext?: {
    variables?: Record<string, string>; // Custom variables
    messages?: ConversationMessage[]; // Custom conversation messages
    tools?: ToolDefinition[]; // 🆕 Tool definition support
  };
}

/**
 * Message optimization request interface (dedicated to multi-turn conversation mode)
 * Used to optimize the content of a single message in a conversation
 */
export interface MessageOptimizationRequest {
  /** Selected message ID (required) */
  selectedMessageId: string;
  /** Full conversation message list (required, includes the selected message) */
  messages: ConversationMessage[];
  /** Model key */
  modelKey: string;
  /** Optimization template ID (optional, defaults to context-message-optimize) */
  templateId?: string;
  /** Context mode (used for the variable substitution strategy) */
  contextMode?: import("../context/types").ContextMode;
  /** Custom variables */
  variables?: Record<string, string>;
  /** Tool definitions */
  tools?: ToolDefinition[];
}

/**
 * Custom conversation test request (consistent with OptimizationRequest)
 */
export interface CustomConversationRequest {
  modelKey: string;
  messages: ConversationMessage[]; // Use the same message structure
  variables: Record<string, string>; // Includes predefined + custom variables
  tools?: ToolDefinition[]; // 🆕 Tool definition support
  // 🆕 Context mode (used for the variable substitution strategy)
  contextMode?: import("../context/types").ContextMode;
}

/**
 * Prompt service interface
 */
export interface IPromptService {
  /** Optimize a prompt - supports prompt types and enhanced features */
  optimizePrompt(request: OptimizationRequest): Promise<string>;

  /** Optimize a single message - dedicated to multi-turn conversation mode */
  optimizeMessage(request: MessageOptimizationRequest): Promise<string>;

  /** Iteratively optimize a prompt */
  iteratePrompt(
    originalPrompt: string,
    lastOptimizedPrompt: string,
    iterateInput: string,
    modelKey: string,
    templateId?: string,
    contextData?: {
      messages?: ConversationMessage[];
      selectedMessageId?: string;
      variables?: Record<string, string>;
      tools?: ToolDefinition[];
    },
  ): Promise<string>;

  /** Test a prompt - supports an optional system prompt */
  testPrompt(
    systemPrompt: string,
    userPrompt: string,
    modelKey: string,
  ): Promise<string>;

  /** Get the history records */
  getHistory(): Promise<PromptRecord[]>;

  /** Get the iteration chain */
  getIterationChain(recordId: string): Promise<PromptRecord[]>;

  /** Optimize a prompt (streaming) - supports prompt types and enhanced features */
  optimizePromptStream(
    request: OptimizationRequest,
    callbacks: StreamHandlers,
  ): Promise<void>;

  /** Optimize a single message (streaming) - dedicated to multi-turn conversation mode */
  optimizeMessageStream(
    request: MessageOptimizationRequest,
    callbacks: StreamHandlers,
  ): Promise<void>;

  /** Iteratively optimize a prompt (streaming) */
  iteratePromptStream(
    originalPrompt: string,
    lastOptimizedPrompt: string,
    iterateInput: string,
    modelKey: string,
    handlers: StreamHandlers,
    templateId: string,
    contextData?: {
      messages?: ConversationMessage[];
      selectedMessageId?: string;
      variables?: Record<string, string>;
      tools?: ToolDefinition[];
    },
  ): Promise<void>;

  /** Test a prompt (streaming) - supports an optional system prompt */
  testPromptStream(
    systemPrompt: string,
    userPrompt: string,
    modelKey: string,
    callbacks: StreamHandlers,
  ): Promise<void>;

  /** Custom conversation test (streaming) - advanced mode feature */
  testCustomConversationStream(
    request: CustomConversationRequest,
    callbacks: StreamHandlers,
  ): Promise<void>;
}

export type { StreamHandlers };
