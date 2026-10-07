/**
 * Unified parameter schema definition
 * Used by text and image model adapters to return parameter metadata
 */

/**
 * List of dangerous key names (compared in lowercase)
 * - Prevents users from injecting the prototype chain or executable context
 */
export const DANGEROUS_PARAM_KEY_PATTERNS = [
  '__proto__',
  'constructor',
  'prototype',
  'eval',
  'exec',
  'script',
  'process',
  'child_process',
  'function',
  'code',
  'apikey',
  'api_key',
  'secret',
  'password',
  'credential',
  'authorization',
  'bearer',
  'token',
  'baseurl',
  'base_url',
  'endpoint',
  'url'
] as const

export type UnifiedParameterValueType = 'string' | 'number' | 'integer' | 'boolean'

/**
 * Unified parameter definition
 */
export interface UnifiedParameterDefinition {
  /** SDK parameter name (required, unique) */
  name: string
  /** i18n label key */
  labelKey?: string
  /** i18n description key */
  descriptionKey?: string
  /** Compatibility field: directly supplied description */
  description?: string
  /** Parameter value type */
  type: UnifiedParameterValueType
  /** Default value (may be empty; not sent when undefined) */
  defaultValue?: unknown
  /** Compatibility field: legacy default value field */
  default?: unknown
  /** Numeric minimum */
  minValue?: number
  /** Numeric maximum */
  maxValue?: number
  /** Compatibility fields: legacy min/max values */
  min?: number
  max?: number
  /** Numeric step */
  step?: number
  /** List of enum values */
  allowedValues?: string[]
  /** Array of i18n label keys for the enum values */
  allowedValueLabelKeys?: string[]
  /** Text unit, e.g. px, steps */
  unit?: string
  /** Unit i18n key */
  unitKey?: string
  /** Whether required */
  required?: boolean
  /** Extra tags, e.g. ['safety', 'beta'] */
  tags?: string[]
  /**
   * Whether sending an empty string is allowed by default
   * - true: an empty string is treated as a valid value
   * - false/undefined: an empty string is treated as empty
   */
  sendEmptyString?: boolean
}

/**
 * Determine whether a value is empty (undefined/null/empty string/empty array)
 */
export function isValueEmpty(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true
  }

  if (typeof value === 'string') {
    return value.trim().length === 0
  }

  if (Array.isArray(value)) {
    return value.length === 0
  }

  return false
}

/**
 * Normalize the default value
 * - Empty values are uniformly converted to undefined so they are not sent in requests
 */
export function normalizeDefaultValue<T>(value: T): T | undefined {
  if (isValueEmpty(value)) {
    return undefined
  }

  return value
}

/**
 * Check whether a custom parameter key name is safe
 * - Must not be empty
 * - Must not contain dangerous keywords
 * - Must not contain whitespace characters
 */
export function isSafeCustomKey(key: string): boolean {
  if (!key) return false

  const trimmed = key.trim()
  if (!trimmed) return false

  // Allow letters, digits, dots, underscores, hyphens, and slashes
  const allowedPattern = /^[A-Za-z0-9._\-:/]+$/
  if (!allowedPattern.test(trimmed)) {
    return false
  }

  const lower = trimmed.toLowerCase()
  return !DANGEROUS_PARAM_KEY_PATTERNS.some((pattern) => lower.includes(pattern))
}
