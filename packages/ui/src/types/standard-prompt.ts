/**
 * Standardized Prompt data format
 * Based on the OpenAI API format, extended to support advanced features such as tool calls
 */

// Tool call-related types
export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface FunctionDefinition {
  name: string
  description?: string
  parameters?: object
}

export interface ToolDefinition {
  type: 'function'
  function: FunctionDefinition
}

// Message type definitions
export interface StandardMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string              // Function name or tool name for tool calls
  tool_calls?: ToolCall[]    // Tool calls in an assistant message
  tool_call_id?: string      // ID of the associated tool call in a tool message
}

// Standardized Prompt data structure
export interface StandardPromptData {
  messages: StandardMessage[]
  tools?: ToolDefinition[]   // Available tool definitions
  model?: string
  temperature?: number
  max_tokens?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  stop?: string | string[]
  stream?: boolean
  // Extended metadata
  metadata?: {
    source?: 'langfuse' | 'openai' | 'conversation' | 'manual'
    template_info?: {
      name?: string
      version?: string
      variables?: string[]
      [key: string]: unknown
    }
    timestamp?: string
    [key: string]: unknown
  }
}

// LangFuse data format (simplified)
export interface LangFuseTrace {
  id: string
  timestamp: string
  name?: string
  input: {
    messages?: StandardMessage[]
    [key: string]: unknown
  }
  output?: {
    content?: string
    usage?: {
      promptTokens?: number
      completionTokens?: number
      totalTokens?: number
    }
  }
  metadata?: {
    model?: string
    temperature?: number
    [key: string]: unknown
  }
}

// OpenAI request format
export interface OpenAIRequest {
  messages: StandardMessage[]
  model: string
  temperature?: number
  max_tokens?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  stop?: string | string[]
  tools?: ToolDefinition[]
  stream?: boolean
}

// Conversion result type
export interface ConversionResult<T> {
  success: boolean
  data?: T
  error?: string
  warnings?: string[]
}

// Variable extraction result
export interface VariableExtractionResult {
  updatedContent: string
  extractedVariable: {
    name: string
    value: string
    description?: string
  }
}

// Smart variable suggestions
export interface VariableSuggestion {
  name: string
  confidence: number
  category: 'database' | 'examples' | 'rules' | 'context' | 'input' | 'output' | 'custom'
  description?: string
}
