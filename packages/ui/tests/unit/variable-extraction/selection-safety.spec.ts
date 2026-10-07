import { describe, it, expect } from 'vitest'

/**
 * Selection safety mechanism test
 *
 * These functions are implemented inside the VariableAwareInput.vue component
 * Here we test their core logic
 */

describe('selection-safety', () => {
  describe('isInsideVariablePlaceholder', () => {
    /**
     * Determine whether the given position is inside a variable placeholder
     */
    const isInsideVariablePlaceholder = (text: string, index: number): boolean => {
      const beforeText = text.substring(0, index)
      const openBraces = (beforeText.match(/\{\{/g) || []).length
      const closeBraces = (beforeText.match(/\}\}/g) || []).length
      return openBraces > closeBraces
    }

    it('should identify positions outside a placeholder', () => {
      const text = 'Hello {{name}}'

      expect(isInsideVariablePlaceholder(text, 0)).toBe(false)  // 'H'
      expect(isInsideVariablePlaceholder(text, 5)).toBe(false)  // ' '
    })

    it('should identify positions inside a placeholder', () => {
      const text = 'Hello {{name}}'

      expect(isInsideVariablePlaceholder(text, 8)).toBe(true)   // 'n' in name
      expect(isInsideVariablePlaceholder(text, 11)).toBe(true)  // 'e' in name
    })

    it('should handle the opening bracket positions correctly', () => {
      const text = 'Hello {{name}}'

      expect(isInsideVariablePlaceholder(text, 6)).toBe(false)  // The first '{'
      expect(isInsideVariablePlaceholder(text, 7)).toBe(false)  // The second '{'
    })

    it('should handle the closing bracket positions correctly', () => {
      const text = 'Hello {{name}}'

      expect(isInsideVariablePlaceholder(text, 12)).toBe(true)  // The first '}'
      expect(isInsideVariablePlaceholder(text, 13)).toBe(true)  // The second '}'
      expect(isInsideVariablePlaceholder(text, 14)).toBe(false) // After the end
    })

    it('should handle multiple variables', () => {
      const text = '{{var1}} and {{var2}}'

      expect(isInsideVariablePlaceholder(text, 3)).toBe(true)   // Inside var1
      expect(isInsideVariablePlaceholder(text, 9)).toBe(false)  // Between the two variables
      expect(isInsideVariablePlaceholder(text, 16)).toBe(true)  // Inside var2
    })

    it('should handle nested brackets', () => {
      const text = '{{outer {{inner}}}}'

      // Note: this test shows the limitation of the simple bracket-counting approach
      // Real variable placeholders should not be nested
      expect(isInsideVariablePlaceholder(text, 3)).toBe(true)
      expect(isInsideVariablePlaceholder(text, 10)).toBe(true)
    })
  })

  describe('validateSelection', () => {
    /**
     * Validate that the selected text is legal (must not cross a variable boundary)
     */
    const validateSelection = (
      fullText: string,
      start: number,
      end: number,
      selectedText: string
    ): { isValid: boolean; reason?: string } => {
      // Whether there is a valid selection
      if (start === end || !selectedText.trim()) {
        return { isValid: false, reason: 'No text selected' }
      }

      // Check whether it crosses a variable boundary
      const beforeSelection = fullText.substring(0, start)
      const afterSelection = fullText.substring(end)

      const openBracesBefore = (beforeSelection.match(/\{\{/g) || []).length
      const closeBracesBefore = (beforeSelection.match(/\}\}/g) || []).length
      if (openBracesBefore > closeBracesBefore) {
        return { isValid: false, reason: 'Cannot cross a variable boundary' }
      }

      const openBracesAfter = (afterSelection.match(/\{\{/g) || []).length
      const closeBracesAfter = (afterSelection.match(/\}\}/g) || []).length
      if (closeBracesAfter > openBracesAfter) {
        return { isValid: false, reason: 'Cannot cross a variable boundary' }
      }

      const openBracesInSelection = (selectedText.match(/\{\{/g) || []).length
      const closeBracesInSelection = (selectedText.match(/\}\}/g) || []).length
      if (openBracesInSelection !== closeBracesInSelection) {
        return { isValid: false, reason: 'Cannot cross a variable boundary' }
      }

      return { isValid: true }
    }

    it('should accept a normal text selection', () => {
      const text = 'Hello world'
      const result = validateSelection(text, 0, 5, 'Hello')

      expect(result.isValid).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('should reject an empty selection', () => {
      const text = 'Hello world'
      const result = validateSelection(text, 5, 5, '')

      expect(result.isValid).toBe(false)
      expect(result.reason).toBe('No text selected')
    })

    it('should reject a selection containing only spaces', () => {
      const text = 'Hello   world'
      const result = validateSelection(text, 5, 8, '   ')

      expect(result.isValid).toBe(false)
      expect(result.reason).toBe('No text selected')
    })

    it('should accept a selection of a complete variable', () => {
      const text = 'Hello {{name}} world'
      const result = validateSelection(text, 6, 14, '{{name}}')

      expect(result.isValid).toBe(true)
    })

    it('should reject a selection that starts inside a variable', () => {
      const text = 'Hello {{name}} world'
      const result = validateSelection(text, 8, 14, 'name}}')

      expect(result.isValid).toBe(false)
      expect(result.reason).toBe('Cannot cross a variable boundary')
    })

    it('should reject a selection that ends inside a variable', () => {
      const text = 'Hello {{name}} world'
      const result = validateSelection(text, 6, 12, '{{name')

      expect(result.isValid).toBe(false)
      expect(result.reason).toBe('Cannot cross a variable boundary')
    })

    it('should reject a selection that crosses the variable start boundary', () => {
      const text = 'Hello {{name}} world'
      const result = validateSelection(text, 3, 10, 'lo {{na')

      expect(result.isValid).toBe(false)
      expect(result.reason).toBe('Cannot cross a variable boundary')
    })

    it('should reject a selection that crosses the variable end boundary', () => {
      const text = 'Hello {{name}} world'
      const result = validateSelection(text, 10, 17, 'me}} wo')

      expect(result.isValid).toBe(false)
      expect(result.reason).toBe('Cannot cross a variable boundary')
    })

    it('should accept a selection containing multiple complete variables', () => {
      const text = 'Hello {{name}} and {{age}}'
      const result = validateSelection(text, 6, 26, '{{name}} and {{age}}')

      expect(result.isValid).toBe(true)
    })

    it('should accept a selection of text between variables', () => {
      const text = '{{var1}} middle {{var2}}'
      const result = validateSelection(text, 9, 16, 'middle ')

      expect(result.isValid).toBe(true)
    })
  })

  describe('countOccurrencesOutsideVariables', () => {
    /**
     * Count the occurrences of the target string in the text (ignoring the inside of variable placeholders)
     */
    const isInsideVariablePlaceholder = (text: string, index: number): boolean => {
      const beforeText = text.substring(0, index)
      const openBraces = (beforeText.match(/\{\{/g) || []).length
      const closeBraces = (beforeText.match(/\}\}/g) || []).length
      return openBraces > closeBraces
    }

    const isOutsideVariableRange = (
      fullText: string,
      start: number,
      length: number
    ): boolean => {
      if (length <= 0) return false
      if (isInsideVariablePlaceholder(fullText, start)) {
        return false
      }
      const endIndex = start + length - 1
      return !isInsideVariablePlaceholder(fullText, endIndex)
    }

    const countOccurrencesOutsideVariables = (
      fullText: string,
      searchText: string
    ): number => {
      if (!searchText || !searchText.trim()) return 0

      let count = 0
      let position = 0

      while (position < fullText.length) {
        const index = fullText.indexOf(searchText, position)
        if (index === -1) break

        if (isOutsideVariableRange(fullText, index, searchText.length)) {
          count += 1
          position = index + searchText.length
        } else {
          position = index + 1
        }
      }

      return count
    }

    it('should count occurrences in plain text', () => {
      const text = 'test test test'
      const count = countOccurrencesOutsideVariables(text, 'test')

      expect(count).toBe(3)
    })

    it('should ignore matches inside variable placeholders', () => {
      const text = 'test {{test}} test'
      const count = countOccurrencesOutsideVariables(text, 'test')

      expect(count).toBe(2) // Only the two outer 'test' occurrences are counted
    })

    it('should handle partial matches inside variables', () => {
      const text = 'customer {{customer_name}} customer'
      const count = countOccurrencesOutsideVariables(text, 'customer')

      expect(count).toBe(2) // Only the two outer 'customer' occurrences are counted
    })

    it('should handle empty search text', () => {
      const text = 'test {{var}} test'
      const count = countOccurrencesOutsideVariables(text, '')

      expect(count).toBe(0)
    })

    it('should handle search text containing only spaces', () => {
      const text = 'test {{var}} test'
      const count = countOccurrencesOutsideVariables(text, '   ')

      expect(count).toBe(0)
    })

    it('should handle no matches', () => {
      const text = 'test {{var}} test'
      const count = countOccurrencesOutsideVariables(text, 'nomatch')

      expect(count).toBe(0)
    })

    it('should handle multiple variables', () => {
      const text = 'name {{name}} age {{age}} name'
      const count = countOccurrencesOutsideVariables(text, 'name')

      expect(count).toBe(2) // 'name' at the start and the end
    })

    it('should handle overlapping search text correctly', () => {
      const text = 'aaa {{aaa}} aaa'
      const count = countOccurrencesOutsideVariables(text, 'aa')

      // 'aaa' contains two 'aa', but we scan left to right and skip the entire match after each match
      expect(count).toBe(2) // One 'aa' in the leading 'aaa' + one 'aa' in the trailing 'aaa'
    })
  })

  describe('replaceAllOccurrencesOutsideVariables', () => {
    /**
     * Replace all target strings in the text (ignoring the inside of variable placeholders)
     */
    const isInsideVariablePlaceholder = (text: string, index: number): boolean => {
      const beforeText = text.substring(0, index)
      const openBraces = (beforeText.match(/\{\{/g) || []).length
      const closeBraces = (beforeText.match(/\}\}/g) || []).length
      return openBraces > closeBraces
    }

    const isOutsideVariableRange = (
      fullText: string,
      start: number,
      length: number
    ): boolean => {
      if (length <= 0) return false
      if (isInsideVariablePlaceholder(fullText, start)) {
        return false
      }
      const endIndex = start + length - 1
      return !isInsideVariablePlaceholder(fullText, endIndex)
    }

    const replaceAllOccurrencesOutsideVariables = (
      fullText: string,
      searchText: string,
      replaceWith: string
    ): string => {
      if (!searchText || !searchText.trim()) return fullText

      let result = fullText
      let position = 0

      while (position < result.length) {
        const index = result.indexOf(searchText, position)
        if (index === -1) break

        if (isOutsideVariableRange(result, index, searchText.length)) {
          result =
            result.substring(0, index) +
            replaceWith +
            result.substring(index + searchText.length)
          position = index + replaceWith.length
        } else {
          position = index + 1
        }
      }

      return result
    }

    it('should replace all occurrences in plain text', () => {
      const text = 'test test test'
      const result = replaceAllOccurrencesOutsideVariables(text, 'test', 'replaced')

      expect(result).toBe('replaced replaced replaced')
    })

    it('should protect text inside variable placeholders', () => {
      const text = 'test {{test}} test'
      const result = replaceAllOccurrencesOutsideVariables(text, 'test', 'replaced')

      expect(result).toBe('replaced {{test}} replaced')
    })

    it('should protect variable names from being corrupted', () => {
      const text = 'customer {{customer_name}} customer'
      const result = replaceAllOccurrencesOutsideVariables(text, 'customer', '{{user}}')

      expect(result).toBe('{{user}} {{customer_name}} {{user}}')
    })

    it('should handle empty search text', () => {
      const text = 'test {{var}} test'
      const result = replaceAllOccurrencesOutsideVariables(text, '', 'replaced')

      expect(result).toBe(text) // Should not change
    })

    it('should handle no matches', () => {
      const text = 'test {{var}} test'
      const result = replaceAllOccurrencesOutsideVariables(text, 'nomatch', 'replaced')

      expect(result).toBe(text) // Should not change
    })

    it('should handle replacement text longer than the original', () => {
      const text = 'a {{a}} a'
      const result = replaceAllOccurrencesOutsideVariables(text, 'a', 'longer')

      expect(result).toBe('longer {{a}} longer')
    })

    it('should handle replacement text shorter than the original', () => {
      const text = 'longer {{longer}} longer'
      const result = replaceAllOccurrencesOutsideVariables(text, 'longer', 'a')

      expect(result).toBe('a {{longer}} a')
    })

    it('should handle complex cases with multiple variables', () => {
      const text = 'name is {{name}} and age is {{age}}, name again'
      const result = replaceAllOccurrencesOutsideVariables(text, 'name', '{{username}}')

      expect(result).toBe('{{username}} is {{name}} and age is {{age}}, {{username}} again')
    })

    it('should handle text length changes after replacement correctly', () => {
      const text = 'a {{b}} a {{c}} a'
      const result = replaceAllOccurrencesOutsideVariables(text, 'a', 'xxx')

      expect(result).toBe('xxx {{b}} xxx {{c}} xxx')

      // Verify the variable placeholders were not corrupted
      expect(result).toContain('{{b}}')
      expect(result).toContain('{{c}}')
    })
  })

  describe('Edge case comprehensive test', () => {
    it('should handle consecutive variable placeholders', () => {
      const isInsideVariablePlaceholder = (text: string, index: number): boolean => {
        const beforeText = text.substring(0, index)
        const openBraces = (beforeText.match(/\{\{/g) || []).length
        const closeBraces = (beforeText.match(/\}\}/g) || []).length
        return openBraces > closeBraces
      }

      const text = '{{var1}}{{var2}}{{var3}}'

      expect(isInsideVariablePlaceholder(text, 3)).toBe(true)   // Inside var1
      expect(isInsideVariablePlaceholder(text, 8)).toBe(false)  // Between var1 and var2
      expect(isInsideVariablePlaceholder(text, 11)).toBe(true)  // Inside var2
    })

    it('should handle a variable placeholder at the start of the text', () => {
      const text = '{{var}} text'

      const isInsideVariablePlaceholder = (text: string, index: number): boolean => {
        const beforeText = text.substring(0, index)
        const openBraces = (beforeText.match(/\{\{/g) || []).length
        const closeBraces = (beforeText.match(/\}\}/g) || []).length
        return openBraces > closeBraces
      }

      expect(isInsideVariablePlaceholder(text, 0)).toBe(false)
      expect(isInsideVariablePlaceholder(text, 3)).toBe(true)
      expect(isInsideVariablePlaceholder(text, 7)).toBe(false)
    })

    it('should handle a variable placeholder at the end of the text', () => {
      const text = 'text {{var}}'

      const isInsideVariablePlaceholder = (text: string, index: number): boolean => {
        const beforeText = text.substring(0, index)
        const openBraces = (beforeText.match(/\{\{/g) || []).length
        const closeBraces = (beforeText.match(/\}\}/g) || []).length
        return openBraces > closeBraces
      }

      expect(isInsideVariablePlaceholder(text, 4)).toBe(false)
      expect(isInsideVariablePlaceholder(text, 8)).toBe(true)
      expect(isInsideVariablePlaceholder(text, 12)).toBe(false)
    })
  })
})
