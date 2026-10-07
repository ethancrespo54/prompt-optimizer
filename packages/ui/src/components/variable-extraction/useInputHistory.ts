import { ref, type Ref } from 'vue'

/**
 * Input history management composable
 *
 * Features:
 * 1. Records the editing history of the input box
 * 2. Supports undo (Ctrl+Z) and redo (Ctrl+Shift+Z)
 * 3. Smartly merges consecutive edit operations
 */

export interface HistoryRecord {
  /** Text content */
  content: string
  /** Cursor position */
  cursorPosition: number
  /** Record timestamp */
  timestamp: number
}

export interface UseInputHistoryOptions {
  /** Maximum number of history records */
  maxHistory?: number
  /** Time threshold for merging edits (milliseconds) */
  mergeThreshold?: number
}

export function useInputHistory(
  inputRef: Ref<HTMLInputElement | HTMLTextAreaElement | null>,
  options: UseInputHistoryOptions = {}
) {
  const { maxHistory = 50, mergeThreshold = 1000 } = options

  // History stack
  const history = ref<HistoryRecord[]>([])
  // Current history position index
  const currentIndex = ref(-1)
  // Timestamp of the last edit
  const lastEditTimestamp = ref(0)
  // Whether an undo/redo operation is in progress
  const isUndoRedoing = ref(false)

  /**
   * Add a history record
   */
  const addHistory = (content: string, cursorPosition: number, forceNew = false) => {
    if (isUndoRedoing.value) return

    const now = Date.now()
    const shouldMerge =
      !forceNew &&
      history.value.length > 0 &&
      currentIndex.value >= 0 &&
      now - lastEditTimestamp.value < mergeThreshold

    if (shouldMerge) {
      // Smart merge: update the current record
      history.value[currentIndex.value] = {
        content,
        cursorPosition,
        timestamp: now
      }
    } else {
      // Create a new record: remove all records after the current position
      history.value = history.value.slice(0, currentIndex.value + 1)

      // Add the new record
      history.value.push({
        content,
        cursorPosition,
        timestamp: now
      })

      // Limit the number of history records
      if (history.value.length > maxHistory) {
        history.value.shift()
      } else {
        currentIndex.value++
      }
    }

    lastEditTimestamp.value = now
  }

  /**
   * Undo operation
   */
  const undo = (): boolean => {
    if (currentIndex.value <= 0) {
      return false
    }

    isUndoRedoing.value = true
    currentIndex.value--

    const record = history.value[currentIndex.value]
    if (record && inputRef.value) {
      inputRef.value.value = record.content
      inputRef.value.setSelectionRange(record.cursorPosition, record.cursorPosition)

      // Trigger the input event to make sure v-model stays in sync
      const event = new Event('input', { bubbles: true })
      inputRef.value.dispatchEvent(event)
    }

    isUndoRedoing.value = false
    return true
  }

  /**
   * Redo operation
   */
  const redo = (): boolean => {
    if (currentIndex.value >= history.value.length - 1) {
      return false
    }

    isUndoRedoing.value = true
    currentIndex.value++

    const record = history.value[currentIndex.value]
    if (record && inputRef.value) {
      inputRef.value.value = record.content
      inputRef.value.setSelectionRange(record.cursorPosition, record.cursorPosition)

      // Trigger the input event to make sure v-model stays in sync
      const event = new Event('input', { bubbles: true })
      inputRef.value.dispatchEvent(event)
    }

    isUndoRedoing.value = false
    return true
  }

  /**
   * Clear the history
   */
  const clearHistory = () => {
    history.value = []
    currentIndex.value = -1
    lastEditTimestamp.value = 0
  }

  /**
   * Record a variable extraction operation (forces a new record)
   */
  const recordVariableExtraction = (content: string, cursorPosition: number) => {
    addHistory(content, cursorPosition, true)
  }

  /**
   * Whether undo is possible
   */
  const canUndo = () => currentIndex.value > 0

  /**
   * Whether redo is possible
   */
  const canRedo = () => currentIndex.value < history.value.length - 1

  return {
    history,
    currentIndex,
    addHistory,
    undo,
    redo,
    clearHistory,
    recordVariableExtraction,
    canUndo,
    canRedo
  }
}
