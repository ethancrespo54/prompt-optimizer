/**
 * Context editing management composable
 * Integrates all data conversion, variable extraction, and import/export features
 */

import { ref, computed } from 'vue'

import type { 
  StandardPromptData,
  OpenAIRequest,
  ConversionResult,
  VariableSuggestion,
  ConversationMessage
} from '../../types'
import {
  PromptDataConverter,
  SmartVariableExtractor,
  DataImportExportManager,
  EnhancedTemplateProcessor
} from '../../services'
import { useToast } from '../ui/useToast'

export function useContextEditor() {
  const toast = useToast()

  const isOpenAIRequest = (value: unknown): value is OpenAIRequest => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const record = value as Record<string, unknown>
    if (typeof record.model !== 'string') return false
    if (!Array.isArray(record.messages)) return false
    return true
  }
  
  // Service instances
  const converter = new PromptDataConverter()
  const variableExtractor = new SmartVariableExtractor()
  const importExportManager = new DataImportExportManager()
  const templateProcessor = new EnhancedTemplateProcessor()

  // Reactive state
  const currentData = ref<StandardPromptData | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Statistics
  const statistics = computed(() => {
    if (!currentData.value) {
      return {
        messageCount: 0,
        variableCount: 0,
        totalCharacters: 0,
        avgMessageLength: 0
      }
    }

    const messages = currentData.value.messages
    const variables = currentData.value.metadata?.variables || {}
    const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0)

    return {
      messageCount: messages.length,
      variableCount: Object.keys(variables).length,
      totalCharacters: totalChars,
      avgMessageLength: messages.length > 0 ? Math.round(totalChars / messages.length) : 0
    }
  })

  // Data conversion methods
  const convertFromLangFuse = (langfuseData: unknown): ConversionResult<StandardPromptData> => {
    try {
      isLoading.value = true
      error.value = null
      
      const result = converter.fromLangFuse(langfuseData)
      if (result.success && result.data) {
        currentData.value = result.data
        toast.success('LangFuse data converted successfully')
      } else {
        error.value = result.error || 'Conversion failed'
        toast.error(error.value)
      }
      
      return result
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      error.value = errorMsg
      toast.error(`Conversion failed: ${errorMsg}`)
      return { success: false, error: errorMsg }
    } finally {
      isLoading.value = false
    }
  }

  const convertFromOpenAI = (openaiData: unknown): ConversionResult<StandardPromptData> => {
    try {
      isLoading.value = true
      error.value = null
      
      if (!isOpenAIRequest(openaiData)) {
        return { success: false, error: 'Invalid OpenAI request: missing model/messages' }
      }

      const result = converter.fromOpenAI(openaiData)
      if (result.success && result.data) {
        currentData.value = result.data
        toast.success('OpenAI data converted successfully')
      } else {
        error.value = result.error || 'Conversion failed'
        toast.error(error.value)
      }
      
      return result
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      error.value = errorMsg
      toast.error(`Conversion failed: ${errorMsg}`)
      return { success: false, error: errorMsg }
    } finally {
      isLoading.value = false
    }
  }

  // Smart import (automatically detects the format)
  const smartImport = (data: unknown): ConversionResult<StandardPromptData> => {
    try {
      isLoading.value = true
      error.value = null
      
      const format = importExportManager.detectFormat(data)
      let result: ConversionResult<StandardPromptData>
      
      switch (format) {
        case 'langfuse':
          result = converter.fromLangFuse(data)
          break
        case 'openai':
          if (!isOpenAIRequest(data)) {
            result = { success: false, error: 'Invalid OpenAI request: missing model/messages' }
          } else {
            result = converter.fromOpenAI(data)
          }
          break
        case 'conversation':
          result = converter.fromConversationMessages(data as Array<Partial<ConversationMessage>>)
          break
        default:
          result = { success: false, error: `Unsupported data format: ${format}` }
      }

      if (result.success && result.data) {
        currentData.value = result.data
        toast.success(`${format.toUpperCase()} format data imported successfully`)
      } else {
        error.value = result.error || 'Import failed'
        toast.error(error.value)
      }
      
      return result
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      error.value = errorMsg
      toast.error(`Import failed: ${errorMsg}`)
      return { success: false, error: errorMsg }
    } finally {
      isLoading.value = false
    }
  }

  // Variable extraction methods
  const extractVariable = (
    messageIndex: number,
    selectedText: string,
    variableName: string,
    startIndex: number,
    endIndex: number
  ) => {
    if (!currentData.value) {
      toast.error('No editable data')
      return false
    }

    try {
      const result = variableExtractor.extractVariable(
        currentData.value.messages[messageIndex].content,
        selectedText,
        variableName,
        startIndex,
        endIndex
      )

      // Update the message content
      currentData.value.messages[messageIndex].content = result.updatedContent

      // Add the variable to metadata
      if (!currentData.value.metadata) {
        currentData.value.metadata = {}
      }
      const metadataRecord = currentData.value.metadata as Record<string, unknown>
      const variables = metadataRecord.variables
      if (!variables || typeof variables !== 'object' || Array.isArray(variables)) {
        metadataRecord.variables = {}
      }
      (metadataRecord.variables as Record<string, string>)[variableName] = result.extractedVariable.value

      toast.success(`Variable ${variableName} extracted successfully`)
      return true
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Variable extraction failed'
      toast.error(errorMsg)
      return false
    }
  }

  // Smart variable suggestions
  const coerceVariableCategory = (value: string): VariableSuggestion['category'] => {
    const allowed: VariableSuggestion['category'][] = ['database', 'examples', 'rules', 'context', 'input', 'output', 'custom']
    return allowed.includes(value as VariableSuggestion['category']) ? (value as VariableSuggestion['category']) : 'custom'
  }

  const suggestVariableNames = (selectedText: string): VariableSuggestion[] => {
    try {
      return variableExtractor.suggestVariableNames(selectedText).map(suggestion => ({
        name: suggestion.name,
        confidence: suggestion.confidence,
        category: coerceVariableCategory(suggestion.category),
        description: suggestion.reason
      }))
    } catch (err) {
      console.error('Failed to generate variable suggestions:', err)
      return []
    }
  }

  // Template processing
  const convertToTemplate = () => {
    if (!currentData.value) {
      toast.error('No data to process')
      return null
    }

    try {
      const result = templateProcessor.toTemplate(currentData.value)
      toast.success('Template conversion succeeded')
      return result
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Template conversion failed'
      toast.error(errorMsg)
      return null
    }
  }

  const applyVariablesToTemplate = (
    template: StandardPromptData,
    variables: Record<string, string>
  ) => {
    try {
      const result = templateProcessor.fromTemplate(template, variables)
      currentData.value = result
      toast.success('Variables applied successfully')
      return result
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Applying variables failed'
      toast.error(errorMsg)
      return null
    }
  }

  const validateTemplateVariables = (
    template: StandardPromptData,
    variables: Record<string, string>
  ) => {
    try {
      return templateProcessor.validateVariables(template, variables)
    } catch (err) {
      console.error('Variable validation failed:', err)
      return {
        isValid: false,
        missingVariables: [],
        unusedVariables: []
      }
    }
  }

  // Import/export methods
  const importFromFile = async (file: File) => {
    try {
      isLoading.value = true
      const result = await importExportManager.importFromFile(file)
      
      if (result.success && result.data) {
        currentData.value = result.data
        toast.success('File imported successfully')
        return true
      } else {
        error.value = result.error || 'Import failed'
        toast.error(error.value)
        return false
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'File import failed'
      error.value = errorMsg
      toast.error(errorMsg)
      return false
    } finally {
      isLoading.value = false
    }
  }

  const importFromClipboard = (jsonText: string) => {
    try {
      const result = importExportManager.importFromClipboard(jsonText)
      
      if (result.success && result.data) {
        currentData.value = result.data
        toast.success('Clipboard data imported successfully')
        return true
      } else {
        error.value = result.error || 'Import failed'
        toast.error(error.value)
        return false
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Clipboard import failed'
      error.value = errorMsg
      toast.error(errorMsg)
      return false
    }
  }

  const exportToFile = (format: 'standard' | 'openai' | 'template', filename?: string) => {
    if (!currentData.value) {
      toast.error('No data to export')
      return false
    }

    try {
      importExportManager.exportToFile(currentData.value, format, filename)
      toast.success('Data exported to a file')
      return true
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Export failed'
      toast.error(errorMsg)
      return false
    }
  }

  const exportToClipboard = async (format: 'standard' | 'openai' | 'template') => {
    if (!currentData.value) {
      toast.error('No data to export')
      return false
    }

    try {
      const success = await importExportManager.exportToClipboard(currentData.value, format)
      if (success) {
        toast.success('Data copied to the clipboard')
      } else {
        toast.error('Copy failed')
      }
      return success
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Export failed'
      toast.error(errorMsg)
      return false
    }
  }

  // Optimization suggestions
  const getOptimizationSuggestions = () => {
    if (!currentData.value) return []
    
    try {
      return templateProcessor.suggestOptimizations(currentData.value)
    } catch (err) {
      console.error('Failed to generate optimization suggestions:', err)
      return []
    }
  }

  // Reset state
  const reset = () => {
    currentData.value = null
    error.value = null
    isLoading.value = false
  }

  // Set data
  const setData = (data: StandardPromptData) => {
    currentData.value = data
    error.value = null
  }

  return {
    // State
    currentData,
    isLoading,
    error,
    statistics,

    // Conversion methods
    convertFromLangFuse,
    convertFromOpenAI,
    smartImport,

    // Variable operations
    extractVariable,
    suggestVariableNames,

    // Template processing
    convertToTemplate,
    applyVariablesToTemplate,
    validateTemplateVariables,

    // Import/export
    importFromFile,
    importFromClipboard,
    exportToFile,
    exportToClipboard,

    // Utility methods
    getOptimizationSuggestions,
    reset,
    setData,

    // Service instances (for advanced users to access directly)
    services: {
      converter,
      variableExtractor,
      importExportManager,
      templateProcessor
    }
  }
}
