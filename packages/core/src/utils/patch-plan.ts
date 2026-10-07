import type { PatchOperation } from '../services/evaluation/types'

export type ApplyPatchStatus = 'applied' | 'skipped' | 'conflict'

export interface ApplyPatchReportItem {
  op: PatchOperation['op']
  status: ApplyPatchStatus
  reason?: string
}

export interface ApplyPatchResult {
  ok: boolean
  text: string
  report: ApplyPatchReportItem
}

/**
 * Find the position of the Nth occurrence in the text
 * @param haystack Text being searched
 * @param needle Text to find
 * @param occurrence Which occurrence (starting from 1)
 * @returns The index found, or -1 if not found
 */
function findNthOccurrence(
  haystack: string,
  needle: string,
  occurrence: number,
): number {
  if (!needle) return -1

  let fromIndex = 0
  for (let i = 1; i <= occurrence; i++) {
    const idx = haystack.indexOf(needle, fromIndex)
    if (idx === -1) return -1
    if (i === occurrence) return idx
    fromIndex = idx + 1
  }
  return -1
}

/**
 * Count the number of occurrences of the text in the source string
 */
function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let count = 0
  let pos = 0
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    count++
    pos += 1
  }
  return count
}

/**
 * Apply a single patch operation to the text
 *
 * Simplified apply logic:
 * - Find the position of oldText in the text
 * - Replace it with newText
 *
 * @param input Original text
 * @param operation Single patch operation
 * @returns Application result
 */
export function applyPatchOperationsToText(
  input: string,
  operation: PatchOperation,
): ApplyPatchResult {
  const { oldText, newText, occurrence = 1, op } = operation

  if (!oldText) {
    return {
      ok: false,
      text: input,
      report: { op, status: 'skipped', reason: 'Missing oldText' },
    }
  }

  const occurrenceCount = countOccurrences(input, oldText)
  if (occurrenceCount === 0) {
    return {
      ok: false,
      text: input,
      report: { op, status: 'skipped', reason: 'oldText not found in current text' },
    }
  }

  if (occurrenceCount > 1 && occurrence > occurrenceCount) {
    return {
      ok: false,
      text: input,
      report: {
        op,
        status: 'skipped',
        reason: `oldText appears ${occurrenceCount} times, but occurrence=${occurrence} is out of range`,
      },
    }
  }

  const targetIndex = findNthOccurrence(input, oldText, occurrence)
  if (targetIndex === -1) {
    return {
      ok: false,
      text: input,
      report: { op, status: 'skipped', reason: 'Failed to locate oldText' },
    }
  }

  const text = input.slice(0, targetIndex) + (newText ?? '') + input.slice(targetIndex + oldText.length)

  return {
    text,
    ok: true,
    report: { op, status: 'applied' },
  }
}
