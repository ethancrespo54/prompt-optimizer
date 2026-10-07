import { ref, type Ref } from 'vue'

/**
 * Text selection detection composable
 *
 * Features:
 * 1. Detects the selected text in a text box
 * 2. Validates the legality of the selected text
 * 3. Prevents selections that cross variable boundaries
 */

export interface TextSelection {
  /** Selected text content */
  text: string
  /** Selection start position */
  start: number
  /** Selection end position */
  end: number
  /** Whether the selection is valid */
  isValid: boolean
  /** Reason it is invalid */
  invalidReason?: string
}

export function useTextSelection(inputRef: Ref<HTMLInputElement | HTMLTextAreaElement | null>) {
  const selection = ref<TextSelection>({
    text: '',
    start: 0,
    end: 0,
    isValid: false
  })

  /**
   * Get the currently selected text
   */
  const getSelection = (): TextSelection => {
    const input = inputRef.value
    if (!input) {
      return {
        text: '',
        start: 0,
        end: 0,
        isValid: false,
        invalidReason: 'Input not ready'
      }
    }

    const start = input.selectionStart || 0
    const end = input.selectionEnd || 0
    const text = input.value.substring(start, end)

    // Validate the selection
    const validation = validateSelection(input.value, start, end, text)

    selection.value = {
      text: validation.isValid ? text.trim() : '',
      start,
      end,
      isValid: validation.isValid,
      invalidReason: validation.reason
    }

    return selection.value
  }

  /**
   * Validate the legality of the selected text
   */
  const validateSelection = (
    fullText: string,
    start: number,
    end: number,
    selectedText: string
  ): { isValid: boolean; reason?: string } => {
    // Check whether there is selected text
    if (start === end || !selectedText.trim()) {
      return { isValid: false, reason: 'No text selected' }
    }

    // Check whether it crosses a variable boundary
    const beforeSelection = fullText.substring(0, start)
    const afterSelection = fullText.substring(end)

    // Check whether there is an unclosed {{ before the selected text
    const openBracesBeforeCount = (beforeSelection.match(/\{\{/g) || []).length
    const closeBracesBeforeCount = (beforeSelection.match(/\}\}/g) || []).length
    if (openBracesBeforeCount > closeBracesBeforeCount) {
      return { isValid: false, reason: 'Cannot cross a variable boundary' }
    }

    // Check whether there is an unclosed }} after the selected text
    const openBracesAfterCount = (afterSelection.match(/\{\{/g) || []).length
    const closeBracesAfterCount = (afterSelection.match(/\}\}/g) || []).length
    if (closeBracesAfterCount > openBracesAfterCount) {
      return { isValid: false, reason: 'Cannot cross a variable boundary' }
    }

    // Check whether the selected text contains a complete variable placeholder
    const openBracesInSelection = (selectedText.match(/\{\{/g) || []).length
    const closeBracesInSelection = (selectedText.match(/\}\}/g) || []).length
    if (openBracesInSelection > 0 || closeBracesInSelection > 0) {
      // If the selected text contains {{ or }}, check whether it is a complete variable
      if (openBracesInSelection !== closeBracesInSelection) {
        return { isValid: false, reason: 'Cannot cross a variable boundary' }
      }
    }

    return { isValid: true }
  }

  /**
   * Count the occurrences of the selected text in the full text
   */
  const countOccurrences = (fullText: string, searchText: string): number => {
    if (!searchText) return 0

    const trimmedSearch = searchText.trim()
    if (!trimmedSearch) return 0

    // Use a regular expression to count the occurrences, but exclude text already inside variables
    let count = 0
    let position = 0

    while (position < fullText.length) {
      const index = fullText.indexOf(trimmedSearch, position)
      if (index === -1) break

      // Check whether the position is inside a variable placeholder
      const beforeText = fullText.substring(0, index)
      const openBraces = (beforeText.match(/\{\{/g) || []).length
      const closeBraces = (beforeText.match(/\}\}/g) || []).length

      // If it is not inside a variable, count it
      if (openBraces === closeBraces) {
        count++
      }

      position = index + 1
    }

    return count
  }

  /**
   * Replace all matches in the text
   */
  const replaceAllOccurrences = (
    fullText: string,
    searchText: string,
    replaceWith: string
  ): string => {
    if (!searchText) return fullText

    const trimmedSearch = searchText.trim()
    if (!trimmedSearch) return fullText

    let result = fullText
    let position = 0

    while (position < result.length) {
      const index = result.indexOf(trimmedSearch, position)
      if (index === -1) break

      // Check whether the position is inside a variable placeholder
      const beforeText = result.substring(0, index)
      const openBraces = (beforeText.match(/\{\{/g) || []).length
      const closeBraces = (beforeText.match(/\}\}/g) || []).length

      // If it is not inside a variable, replace it
      if (openBraces === closeBraces) {
        result =
          result.substring(0, index) +
          replaceWith +
          result.substring(index + trimmedSearch.length)
        position = index + replaceWith.length
      } else {
        position = index + 1
      }
    }

    return result
  }

  return {
    selection,
    getSelection,
    validateSelection,
    countOccurrences,
    replaceAllOccurrences
  }
}
