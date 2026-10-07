/**
 * Data format converter interface definitions
 */

import type { 
  StandardPromptData, 
  LangFuseTrace, 
  OpenAIRequest, 
  ConversionResult 
} from './standard-prompt'
import type { ConversationMessage } from './variable'

// Base converter interface
export interface DataConverter {
  /**
   * Convert from LangFuse trace data to the standard format
   */
  fromLangFuse(trace: LangFuseTrace): ConversionResult<StandardPromptData>

  /**
   * Convert from the OpenAI request format to the standard format
   */
  fromOpenAI(request: OpenAIRequest): ConversionResult<StandardPromptData>

  /**
   * Convert from the conversation message format to the standard format
   */
  fromConversationMessages(
    messages: ConversationMessage[], 
    metadata?: unknown
  ): ConversionResult<StandardPromptData>

  /**
   * Convert from the standard format to the OpenAI request format
   */
  toOpenAI(
    data: StandardPromptData, 
    variables?: Record<string, string>
  ): ConversionResult<OpenAIRequest>

  /**
   * Convert from the standard format to the conversation message format
   */
  toConversationMessages(data: StandardPromptData): ConversionResult<ConversationMessage[]>

  /**
   * Validate whether the data format is valid
   */
  validate(data: unknown, format: 'standard' | 'langfuse' | 'openai' | 'conversation'): ConversionResult<boolean>
}

// Variable extractor interface
export interface VariableExtractor {
  /**
   * Extract a variable from the selected text
   */
  extractVariable(
    messageContent: string, 
    selectedText: string, 
    variableName: string,
    startIndex: number,
    endIndex: number
  ): {
    updatedContent: string
    extractedVariable: {
      name: string
      value: string
      startIndex: number
      endIndex: number
    }
  }

  /**
   * Smart variable name suggestions
   */
  suggestVariableNames(selectedText: string): Array<{
    name: string
    confidence: number
    category: string
    reason: string
  }>

  /**
   * Replace variables with actual values
   */
  replaceVariables(content: string, variables: Record<string, string>): string

  /**
   * Scan the content for variable placeholders
   */
  scanVariables(content: string): Array<{
    name: string
    placeholder: string
    positions: Array<{start: number, end: number}>
  }>
}

// Data import/export interface
export interface DataImportExport {
  /**
   * Import data from a file
   */
  importFromFile(file: File): Promise<ConversionResult<StandardPromptData>>

  /**
   * Import JSON data from the clipboard
   */
  importFromClipboard(jsonText: string): ConversionResult<StandardPromptData>

  /**
   * Export to a JSON file
   */
  exportToFile(
    data: StandardPromptData, 
    format: 'standard' | 'openai' | 'template',
    filename?: string
  ): void

  /**
   * Export to the clipboard
   */
  exportToClipboard(
    data: StandardPromptData, 
    format: 'standard' | 'openai' | 'template'
  ): Promise<boolean>

  /**
   * Automatically detect the data format
   */
  detectFormat(data: unknown): 'langfuse' | 'openai' | 'conversation' | 'unknown'
}

// Template-related interface
export interface TemplateProcessor {
  /**
   * Convert StandardPromptData into template + variables form
   */
  toTemplate(data: StandardPromptData): {
    template: StandardPromptData
    variables: Record<string, string>
    variableDefinitions: Array<{
      name: string
      type: 'string' | 'number' | 'boolean' | 'object' | 'array'
      description?: string
      defaultValue?: unknown
      required?: boolean
    }>
  }

  /**
   * Generate the full StandardPromptData from template + variables
   */
  fromTemplate(
    template: StandardPromptData, 
    variables: Record<string, string>
  ): StandardPromptData

  /**
   * Validate variable completeness
   */
  validateVariables(
    template: StandardPromptData, 
    variables: Record<string, string>
  ): {
    isValid: boolean
    missingVariables: string[]
    unusedVariables: string[]
  }
}