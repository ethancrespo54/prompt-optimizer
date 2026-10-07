/**
 * Data import/export manager implementation
 */

import type { DataImportExport, StandardPromptData, ConversionResult, ConversationMessage, OpenAIRequest } from '../types'
import { PromptDataConverter } from './PromptDataConverter'
import { scanVariableNames } from '../utils/prompt-variables'

export class DataImportExportManager implements DataImportExport {
  private converter = new PromptDataConverter()

  private isOpenAIRequest(value: unknown): value is OpenAIRequest {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const record = value as Record<string, unknown>
    if (typeof record.model !== 'string') return false
    if (!Array.isArray(record.messages)) return false
    return true
  }

  /**
   * Import data from a file
   */
  async importFromFile(file: File): Promise<ConversionResult<StandardPromptData>> {
    try {
      if (!file) {
        return {
          success: false,
          error: 'No file provided'
        }
      }

      // Check the file type
      if (!file.name.toLowerCase().endsWith('.json')) {
        return {
          success: false,
          error: 'Only JSON files are supported'
        }
      }

      // Read the file content
      const text = await this.readFileAsText(file)
      
      // Parse the JSON
      let jsonData: unknown
      try {
        jsonData = JSON.parse(text)
      } catch (parseError) {
        return {
          success: false,
          error: `Invalid JSON format: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        }
      }

      // Automatically detect the format and convert
      return this.importFromParsedData(jsonData)
    } catch (error) {
      return {
        success: false,
        error: `File import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Import JSON data from the clipboard
   */
  importFromClipboard(jsonText: string): ConversionResult<StandardPromptData> {
    try {
      if (!jsonText || typeof jsonText !== 'string') {
        return {
          success: false,
          error: 'No text provided'
        }
      }

      // Parse the JSON
      let jsonData: unknown
      try {
        jsonData = JSON.parse(jsonText.trim())
      } catch (parseError) {
        return {
          success: false,
          error: `Invalid JSON format: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        }
      }

      // Automatically detect the format and convert
      return this.importFromParsedData(jsonData)
    } catch (error) {
      return {
        success: false,
        error: `Clipboard import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Export to a JSON file
   */
  exportToFile(
    data: StandardPromptData, 
    format: 'standard' | 'openai' | 'template',
    filename?: string
  ): void {
    try {
      const exportData = this.prepareExportData(data, format)
      const jsonString = JSON.stringify(exportData, null, 2)
      
      // Generate the file name
      const defaultFilename = this.generateFilename(format)
      const finalFilename = filename || defaultFilename

      // Create the download link
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = finalFilename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Clean up the URL object
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export to file failed:', error)
      throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Export to the clipboard
   */
  async exportToClipboard(
    data: StandardPromptData, 
    format: 'standard' | 'openai' | 'template'
  ): Promise<boolean> {
    try {
      const exportData = this.prepareExportData(data, format)
      const jsonString = JSON.stringify(exportData, null, 2)
      
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(jsonString)
        return true
      } else {
        // Fallback: use the legacy method
        return this.fallbackCopyToClipboard(jsonString)
      }
    } catch (error) {
      console.error('Export to clipboard failed:', error)
      return false
    }
  }

  /**
   * Automatically detect the data format
   */
  detectFormat(data: unknown): 'langfuse' | 'openai' | 'conversation' | 'unknown' {
    if (!data || typeof data !== 'object') {
      return 'unknown'
    }

    const dataObj = data as Record<string, unknown>

    // Detect the LangFuse format
    if (dataObj.id && dataObj.input && typeof dataObj.input === 'object' &&
        (dataObj.input as Record<string, unknown>).messages) {
      return 'langfuse'
    }

    // Detect the OpenAI format
    if (dataObj.messages && Array.isArray(dataObj.messages) && dataObj.model) {
      return 'openai'
    }

    // Detect the conversation message format
    if (Array.isArray(data) && data.length > 0 &&
        data[0] && typeof data[0] === 'object' &&
        (data[0] as Record<string, unknown>).role &&
        (data[0] as Record<string, unknown>).content) {
      return 'conversation'
    }

    // Detect the standard format
    if (dataObj.messages && Array.isArray(dataObj.messages) &&
        (!dataObj.model || typeof dataObj.model === 'string')) {
      return 'openai' // Treat as the OpenAI format
    }

    return 'unknown'
  }

  // Private method: import from parsed data
  private importFromParsedData(jsonData: unknown): ConversionResult<StandardPromptData> {
    const format = this.detectFormat(jsonData)
    
    switch (format) {
      case 'langfuse':
        return this.converter.fromLangFuse(jsonData as Record<string, unknown>)

      case 'openai':
        if (!this.isOpenAIRequest(jsonData)) {
          return { success: false, error: 'Invalid OpenAI request: missing model/messages' }
        }
        return this.converter.fromOpenAI(jsonData)

      case 'conversation':
        return this.converter.fromConversationMessages(jsonData as Array<Partial<ConversationMessage>>, {
          imported_from: 'file',
          detected_format: 'conversation'
        })

      default:
        return {
          success: false,
          error: `Unknown or unsupported data format. Detected: ${format}`
        }
    }
  }

  // Private method: prepare export data
  private prepareExportData(data: StandardPromptData, format: 'standard' | 'openai' | 'template'): StandardPromptData | Record<string, unknown> {
    switch (format) {
      case 'standard':
        return data

      case 'openai': {
        const openaiResult = this.converter.toOpenAI(data)
        if (!openaiResult.success) {
          throw new Error(openaiResult.error)
        }
        if (!openaiResult.data) {
          throw new Error('Failed to convert to OpenAI format: missing result data')
        }
        return openaiResult.data as unknown as Record<string, unknown>
      }

      case 'template':
        return this.prepareTemplateExport(data)

      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  // Private method: prepare template export
  private prepareTemplateExport(data: StandardPromptData): {
    template: StandardPromptData
    variables: Record<string, string>
    export_info: {
      format: 'template'
      exported_at: string
      variable_count: number
    }
  } {
    // Extract variables
    const variables: Record<string, string> = {}
    
    // Scan all messages for variables
    data.messages.forEach(message => {
      const found = scanVariableNames(message.content)
      for (const variableName of found) {
        if (!Object.prototype.hasOwnProperty.call(variables, variableName)) {
          variables[variableName] = `[${variableName}_placeholder]`
        }
      }
    })

    return {
      template: data,
      variables,
      export_info: {
        format: 'template',
        exported_at: new Date().toISOString(),
        variable_count: Object.keys(variables).length
      }
    }
  }

  // Private method: generate the file name
  private generateFilename(format: 'standard' | 'openai' | 'template'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const formatPrefix = {
      'standard': 'standard-prompt',
      'openai': 'openai-request', 
      'template': 'prompt-template'
    }[format]
    
    return `${formatPrefix}-${timestamp}.json`
  }

  // Private method: read the file as text
  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (event) => {
        if (event.target?.result) {
          resolve(event.target.result as string)
        } else {
          reject(new Error('Failed to read file'))
        }
      }
      
      reader.onerror = () => {
        reject(new Error('File reading failed'))
      }
      
      reader.readAsText(file, 'utf-8')
    })
  }

  // Private method: fall back to copying to the clipboard
  private fallbackCopyToClipboard(text: string): boolean {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      textarea.style.pointerEvents = 'none'
      
      document.body.appendChild(textarea)
      textarea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textarea)
      
      return success
    } catch {
      return false
    }
  }
}
