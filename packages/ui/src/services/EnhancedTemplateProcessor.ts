/**
 * Enhanced template processor implementation
 */

import type {
  TemplateProcessor,
  StandardPromptData,
  StandardMessage
} from '../types'
import type {
  VariablePrimitiveType,
  VariableDefaultValue,
  VariableDefinition,
  VariableAnalysis,
  VariableUsageStats
} from '../types/template'

import { VARIABLE_VALIDATION, isValidVariableName, sanitizeVariableRecord } from '../types/variable'

export class EnhancedTemplateProcessor implements TemplateProcessor {
  /**
   * Convert StandardPromptData into template + variables form
   */
  toTemplate(data: StandardPromptData): {
    template: StandardPromptData
    variables: Record<string, string>
    variableDefinitions: VariableDefinition[]
  } {
    const variables: Record<string, string> = {}
    const variableDefinitions: VariableDefinition[] = []

    // Get variables from the existing metadata
    if (data.metadata?.variables) {
      // Avoid prototype pollution via Object.assign and ignore invalid keys.
      Object.assign(variables, sanitizeVariableRecord(data.metadata.variables))
    }

    // Scan all variables in the messages
    const allVariables = new Set<string>()
    const templateMessages: StandardMessage[] = data.messages.map(message => {
      const scannedVars = this.scanVariablesInContent(message.content)
      scannedVars.forEach(varInfo => allVariables.add(varInfo.name))
      
      return {
        ...message,
        content: message.content // Keep the original variable placeholders
      }
    })

    // Create definitions for all discovered variables
    allVariables.forEach(varName => {
      // Preserve explicit empty-string values; only fill when the key is missing.
      if (!Object.prototype.hasOwnProperty.call(variables, varName)) {
        variables[varName] = `[${varName}_placeholder]`
      }

      // Analyze variable types and characteristics
      const varAnalysis = this.analyzeVariable(varName, data.messages)
      variableDefinitions.push({
        name: varName,
        type: varAnalysis.type,
        description: varAnalysis.description,
        defaultValue: varAnalysis.defaultValue,
        required: varAnalysis.required
      })
    })

    const template: StandardPromptData = {
      ...data,
      messages: templateMessages,
      metadata: {
        ...data.metadata,
        template_info: {
          ...data.metadata?.template_info,
          name: data.metadata?.template_info?.name,
          version: data.metadata?.template_info?.version,
          variables: Array.from(allVariables),
          created_at: new Date().toISOString()
        }
      }
    }

    return {
      template,
      variables,
      variableDefinitions
    }
  }

  /**
   * Generate the full StandardPromptData from template + variables
   */
  fromTemplate(
    template: StandardPromptData, 
    variables: Record<string, string>
  ): StandardPromptData {
    const processedMessages: StandardMessage[] = template.messages.map(message => ({
      ...message,
      content: this.replaceVariables(message.content, variables)
    }))

    return {
      ...template,
      messages: processedMessages,
      metadata: {
        ...template.metadata,
        source: 'manual',
        variables_applied: variables,
        processed_at: new Date().toISOString()
      }
    }
  }

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
  } {
    const requiredVariables = new Set<string>()
    const providedVariables = new Set(Object.keys(variables))

    // Scan all variables needed in the template
    template.messages.forEach(message => {
      const scannedVars = this.scanVariablesInContent(message.content)
      scannedVars.forEach(varInfo => requiredVariables.add(varInfo.name))
    })

    // Check for missing variables
    const missingVariables = Array.from(requiredVariables).filter(
      varName => !providedVariables.has(varName)
    )

    // Check for unused variables
    const unusedVariables = Array.from(providedVariables).filter(
      varName => !requiredVariables.has(varName)
    )

    return {
      isValid: missingVariables.length === 0,
      missingVariables,
      unusedVariables
    }
  }

  /**
   * Replace variables with actual values
   */
  replaceVariables(content: string, variables: Record<string, string>): string {
    let result = content

    // Support multiple variable formats
    for (const [name, value] of Object.entries(variables)) {
      // Standard format {{variableName}}
      const standardPattern = new RegExp(`\\{\\{\\s*${this.escapeRegExp(name)}\\s*\\}\\}`, 'g')
      result = result.replace(standardPattern, value)

      // Conditional format (future extension)
      // {% if variableName %} ... {% endif %}
      // Loop format (future extension)
      // {% for item in variableName %} ... {% endfor %}
    }

    return result
  }

  /**
   * Scan the content for variable placeholders
   */
  scanVariablesInContent(content: string): Array<{
    name: string
    placeholder: string
    positions: Array<{start: number, end: number}>
  }> {
    const variables = new Map<string, {
      placeholder: string
      positions: Array<{start: number, end: number}>
    }>()

    // Avoid sharing global RegExp state across calls.
    const standardPattern = new RegExp(
      VARIABLE_VALIDATION.VARIABLE_SCAN_PATTERN.source,
      VARIABLE_VALIDATION.VARIABLE_SCAN_PATTERN.flags,
    )
    let match: RegExpExecArray | null

    while ((match = standardPattern.exec(content)) !== null) {
      const fullMatch = match[0]
      const variableName = match[1].trim()

      // Skip invalid names (Mustache control tags, reserved keys, etc.).
      if (!isValidVariableName(variableName)) {
        continue
      }
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

  /**
   * Preview the variable substitution effect
   */
  previewReplacement(
    content: string, 
    variables: Record<string, string>,
    highlightVariables: boolean = true
  ): {
    original: string
    processed: string
    replacements: Array<{
      variable: string
      originalText: string
      replacedText: string
      positions: Array<{start: number, end: number}>
    }>
  } {
    const replacements: Array<{
      variable: string
      originalText: string
      replacedText: string
      positions: Array<{start: number, end: number}>
    }> = []

    let processed = content

    // Record the substitution info
    for (const [name, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\{\\{\\s*${this.escapeRegExp(name)}\\s*\\}\\}`, 'g')
      let match: RegExpExecArray | null

      while ((match = pattern.exec(content)) !== null) {
        replacements.push({
          variable: name,
          originalText: match[0],
          replacedText: value,
          positions: [{ start: match.index, end: match.index + match[0].length }]
        })
      }

      // Perform the substitution
      processed = processed.replace(pattern, highlightVariables ? `[${value}]` : value)
    }

    return {
      original: content,
      processed,
      replacements
    }
  }

  /**
   * Smart variable suggestions (based on usage patterns)
   */
  suggestOptimizations(template: StandardPromptData): Array<{
    type: 'merge' | 'split' | 'rename' | 'extract'
    description: string
    variables: string[]
    confidence: number
  }> {
    const suggestions: Array<{
      type: 'merge' | 'split' | 'rename' | 'extract'
      description: string
      variables: string[]
      confidence: number
    }> = []

    const variableUsage = this.analyzeVariableUsage(template)

    // Suggest merging similar variables
    const similarVariables = this.findSimilarVariables(variableUsage)
    similarVariables.forEach(group => {
      if (group.length > 1) {
        suggestions.push({
          type: 'merge',
          description: `Consider merging similar variables: ${group.join(', ')}`,
          variables: group,
          confidence: 0.7
        })
      }
    })

    // Suggest splitting complex variables
    Object.entries(variableUsage).forEach(([varName, usage]) => {
      if (usage.avgLength > 1000 && usage.complexity > 0.8) {
        suggestions.push({
          type: 'split',
          description: `Variable ${varName} has overly complex content; consider splitting it`,
          variables: [varName],
          confidence: 0.8
        })
      }
    })

    return suggestions.sort((a, b) => b.confidence - a.confidence)
  }

  // Private method: analyze variable characteristics
  private analyzeVariable(
    varName: string,
    messages: StandardMessage[]
  ): VariableAnalysis {
    // Infer the type and purpose from the variable name
    const nameLower = varName.toLowerCase()
    
    let type: VariablePrimitiveType = 'string'
    let description = ''

    if (nameLower.includes('count') || nameLower.includes('number') || nameLower.includes('num')) {
      type = 'number'
      description = 'Numeric variable'
    } else if (nameLower.includes('is_') || nameLower.includes('has_') || nameLower.includes('enable')) {
      type = 'boolean'
      description = 'Boolean variable'
    } else if (nameLower.includes('list') || nameLower.includes('array') || nameLower.includes('items')) {
      type = 'array'
      description = 'Array variable'
    } else if (nameLower.includes('config') || nameLower.includes('settings') || nameLower.includes('data')) {
      type = 'object'
      description = 'Object variable'
    }

    // Check whether it is a required variable (appears in multiple messages)
    let usageCount = 0
    messages.forEach(message => {
      const pattern = new RegExp(`\\{\\{\\s*${this.escapeRegExp(varName)}\\s*\\}\\}`, 'g')
      if (pattern.test(message.content)) {
        usageCount++
      }
    })

    return {
      type,
      description: description || `${varName} variable`,
      defaultValue: this.getDefaultValueForType(type),
      required: usageCount > 1
    }
  }

  // Private method: get the default value of a type
  private getDefaultValueForType(type: VariablePrimitiveType): VariableDefaultValue {
    switch (type) {
      case 'string': return ''
      case 'number': return 0
      case 'boolean': return false
      case 'object': return {}
      case 'array': return []
      default: return ''
    }
  }

  // Private method: analyze variable usage
  private analyzeVariableUsage(template: StandardPromptData): Record<string, VariableUsageStats> {
    const usage: Record<string, VariableUsageStats> = {}

    template.messages.forEach(message => {
      const variables = this.scanVariablesInContent(message.content)
      variables.forEach(varInfo => {
        if (!usage[varInfo.name]) {
          usage[varInfo.name] = {
            count: 0,
            avgLength: 0,
            complexity: 0,
            contexts: []
          }
        }
        
        usage[varInfo.name].count += varInfo.positions.length
        usage[varInfo.name].contexts.push(message.role)
      })
    })

    return usage
  }

  // Private method: find similar variables
  private findSimilarVariables(usage: Record<string, VariableUsageStats>): string[][] {
    const variables = Object.keys(usage)
    const groups: string[][] = []
    
    for (let i = 0; i < variables.length; i++) {
      for (let j = i + 1; j < variables.length; j++) {
        const similarity = this.calculateSimilarity(variables[i], variables[j])
        if (similarity > 0.7) {
          // Find or create a group
          const foundGroup = groups.find(group => 
            group.includes(variables[i]) || group.includes(variables[j])
          )
          
          if (foundGroup) {
            if (!foundGroup.includes(variables[i])) foundGroup.push(variables[i])
            if (!foundGroup.includes(variables[j])) foundGroup.push(variables[j])
          } else {
            groups.push([variables[i], variables[j]])
          }
        }
      }
    }
    
    return groups
  }

  // Private method: compute the similarity of variable names
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1.0
    
    const distance = this.levenshteinDistance(longer, shorter)
    return (longer.length - distance) / longer.length
  }

  // Private method: compute the edit distance
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))
    
    for (let i = 0; i <= str1.length; i += 1) {
      matrix[0][i] = i
    }
    
    for (let j = 0; j <= str2.length; j += 1) {
      matrix[j][0] = j
    }
    
    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        )
      }
    }
    
    return matrix[str2.length][str1.length]
  }

  // Private method: escape regex special characters
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}
