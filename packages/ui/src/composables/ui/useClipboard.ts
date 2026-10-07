/**
 * Clipboard operations composable
 * Provides cross-platform clipboard read/write features
 */

import { ref, type Ref } from 'vue'


export interface ClipboardHooks {
  isSupported: boolean
  copyText: (text: string) => Promise<void>
  readText: () => Promise<string>
  isLoading: Ref<boolean>
  error: Ref<string | null>
}

/**
 * Use the clipboard feature
 */
export function useClipboard(): ClipboardHooks {
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  
  // Check browser support
  const isSupported = !!(
    typeof navigator?.clipboard?.writeText === 'function' && 
    typeof navigator?.clipboard?.readText === 'function'
  )
  
  /**
   * Copy text to the clipboard
   */
  const copyText = async (text: string): Promise<void> => {
    if (!isSupported) {
      throw new Error('Clipboard API not supported')
    }
    
    try {
      isLoading.value = true
      error.value = null
      
      await navigator.clipboard.writeText(text)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to copy to clipboard'
      error.value = errorMessage
      console.error('[useClipboard] Failed to copy text:', err)
      throw new Error(errorMessage)
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Read text from the clipboard
   */
  const readText = async (): Promise<string> => {
    if (!isSupported) {
      throw new Error('Clipboard API not supported')
    }
    
    try {
      isLoading.value = true
      error.value = null
      
      const text = await navigator.clipboard.readText()
      return text
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to read from clipboard'
      error.value = errorMessage
      console.error('[useClipboard] Failed to read text:', err)
      throw new Error(errorMessage)
    } finally {
      isLoading.value = false
    }
  }
  
  return {
    isSupported,
    copyText,
    readText,
    isLoading,
    error
  }
}