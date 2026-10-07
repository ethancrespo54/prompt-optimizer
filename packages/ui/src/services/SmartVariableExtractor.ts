/**
 * Smart variable extractor implementation
 */

import type { VariableExtractor } from '../types'

// Built-in library of common variable names
const COMMON_VARIABLES = {
  database: [
    'table_schema', 'database_structure', 'table_info', 'sql_context', 
    'schema_definition', 'table_structure', 'db_schema', 'database_context'
  ],
  examples: [
    'example_data', 'sample_input', 'demo_case', 'reference_examples',
    'sample_data', 'example_queries', 'demo_input', 'use_cases'
  ],
  rules: [
    'business_rules', 'constraints', 'requirements', 'guidelines',
    'validation_rules', 'business_logic', 'policy_rules', 'restrictions'
  ],
  context: [
    'background_info', 'system_context', 'domain_knowledge', 'context_info',
    'background_context', 'system_info', 'domain_context', 'additional_context'
  ],
  input: [
    'user_question', 'query_text', 'user_input', 'current_request',
    'user_query', 'input_text', 'question', 'request_content'
  ],
  output: [
    'expected_format', 'output_template', 'response_format', 'result_format',
    'output_structure', 'response_template', 'expected_output', 'format_specification'
  ]
} as const

// Keyword matching patterns
const KEYWORD_PATTERNS = {
  database: /(?:table|schema|database|sql|create\s+table|alter\s+table|column|field|index|primary\s+key|foreign\s+key)/i,
  examples: /(?:example|sample|demo|case|instance|illustration|for\s+example|such\s+as)/i,
  rules: /(?:rule|constraint|requirement|must|should|policy|guideline|restriction|validation|business\s+logic)/i,
  context: /(?:context|background|information|about|regarding|concerning|domain|system)/i,
  input: /(?:input|question|query|request|ask|problem|task|what|how|when|where|why)/i,
  output: /(?:output|result|response|format|structure|return|produce|generate)/i
} as const

export class SmartVariableExtractor implements VariableExtractor {
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
  } {
    // Validate the variable name
    if (!this.isValidVariableName(variableName)) {
      throw new Error(`Invalid variable name: ${variableName}`)
    }

    // Validate the selection range
    if (startIndex < 0 || endIndex > messageContent.length || startIndex >= endIndex) {
      throw new Error('Invalid selection range')
    }

    // Validate that the selected text matches
    const actualSelectedText = messageContent.substring(startIndex, endIndex)
    if (actualSelectedText !== selectedText) {
      throw new Error('Selected text does not match the specified range')
    }

    // Replace the selected text with a variable placeholder
    const placeholder = `{{${variableName}}}`
    const updatedContent = messageContent.substring(0, startIndex) + 
                          placeholder + 
                          messageContent.substring(endIndex)

    return {
      updatedContent,
      extractedVariable: {
        name: variableName,
        value: selectedText,
        startIndex,
        endIndex
      }
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
  }> {
    const suggestions: Array<{
      name: string
      confidence: number
      category: string
      reason: string
    }> = []

    // Based on keyword pattern matching
    for (const [category, pattern] of Object.entries(KEYWORD_PATTERNS)) {
      if (pattern.test(selectedText)) {
        const categoryVariables = COMMON_VARIABLES[category as keyof typeof COMMON_VARIABLES]
        const confidence = this.calculatePatternConfidence(selectedText, pattern)
        
        // Add the variable suggestions of this category
        categoryVariables.slice(0, 3).forEach((name, index) => {
          suggestions.push({
            name,
            confidence: confidence - (index * 0.1), // Decreases by priority
            category,
            reason: `Detected ${category}-related content`
          })
        })
      }
    }

    // General suggestions based on length and content characteristics
    if (selectedText.length > 200) {
      suggestions.push({
        name: 'long_context',
        confidence: 0.6,
        category: 'context',
        reason: 'Long text content detected'
      })
    }

    if (selectedText.includes('\n') && selectedText.split('\n').length > 3) {
      suggestions.push({
        name: 'multiline_content',
        confidence: 0.7,
        category: 'context',
        reason: 'Multi-line structured content'
      })
    }

    // JSON format detection
    if (this.looksLikeJSON(selectedText)) {
      suggestions.push({
        name: 'json_data',
        confidence: 0.8,
        category: 'input',
        reason: 'JSON format detected'
      })
    }

    // Deduplicate and sort by confidence
    const uniqueSuggestions = this.deduplicateSuggestions(suggestions)
    return uniqueSuggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 8)
  }

  /**
   * Replace variables with actual values
   */
  replaceVariables(content: string, variables: Record<string, string>): string {
    let result = content
    
    for (const [name, value] of Object.entries(variables)) {
      // Match the {{variableName}} format, allowing spaces
      const pattern = new RegExp(`\\{\\{\\s*${this.escapeRegExp(name)}\\s*\\}\\}`, 'g')
      result = result.replace(pattern, value)
    }

    return result
  }

  /**
   * Scan the content for variable placeholders
   */
  scanVariables(content: string): Array<{
    name: string
    placeholder: string
    positions: Array<{start: number, end: number}>
  }> {
    const variables = new Map<string, {
      placeholder: string
      positions: Array<{start: number, end: number}>
    }>()

    // Match all {{variableName}} formats
    const pattern = /\{\{\s*([^}]+)\s*\}\}/g
    let match: RegExpExecArray | null

    while ((match = pattern.exec(content)) !== null) {
      const fullMatch = match[0]
      const variableName = match[1].trim()
      const start = match.index
      const end = match.index + fullMatch.length

      if (!variables.has(variableName)) {
        variables.set(variableName, {
          placeholder: fullMatch,
          positions: []
        })
      }

      variables.get(variableName)!.positions.push({ start, end })
    }

    // Convert to an array format
    return Array.from(variables.entries()).map(([name, data]) => ({
      name,
      placeholder: data.placeholder,
      positions: data.positions
    }))
  }

  // Private method: validate whether the variable name is valid
  private isValidVariableName(name: string): boolean {
    return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name) && name.length <= 50
  }

  // Private method: compute the pattern match confidence
  private calculatePatternConfidence(text: string, pattern: RegExp): number {
    const matches = text.match(new RegExp(pattern.source, 'gi'))
    if (!matches) return 0

    const matchCount = matches.length
    const textLength = text.length
    const matchDensity = matchCount / Math.max(textLength / 100, 1) // Matches per 100 characters

    // Base confidence + density bonus, at most 1.0
    return Math.min(0.5 + Math.min(matchDensity * 0.3, 0.5), 1.0)
  }

  // Private method: detect whether it looks like JSON
  private looksLikeJSON(text: string): boolean {
    const trimmed = text.trim()
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        JSON.parse(trimmed)
        return true
      } catch {
        return false
      }
    }
    return false
  }

  // Private method: deduplicate suggestions
  private deduplicateSuggestions(suggestions: Array<{
    name: string
    confidence: number
    category: string
    reason: string
  }>): Array<{
    name: string
    confidence: number
    category: string
    reason: string
  }> {
    const seen = new Set<string>()
    return suggestions.filter(suggestion => {
      if (seen.has(suggestion.name)) {
        return false
      }
      seen.add(suggestion.name)
      return true
    })
  }

  // Private method: escape regex special characters
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}