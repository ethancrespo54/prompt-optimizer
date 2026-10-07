/**
 * Generic selector option interface
 * Strongly typed data structure used by the SelectWithConfig component
 */
export interface SelectOption<T = unknown> {
  /** Primary display text */
  primary: string
  /** Secondary display text (optional) */
  secondary: string
  /** Value of the selector */
  value: string
  /** Raw data object */
  raw: T
  /** Backward-compatible label field (optional) */
  label?: string
}

/**
 * Model config option
 * Type definitions dedicated to the model selector
 */
export interface ModelSelectOption extends SelectOption<import('@prompt-optimizer/core').TextModelConfig> {
  /** Model name */
  primary: string
  /** Provider name */
  secondary: string
  /** Model key */
  value: string
  /** Raw model config */
  raw: import('@prompt-optimizer/core').TextModelConfig
}

/**
 * Template config option
 * Type definitions dedicated to the template selector
 */
export interface TemplateSelectOption extends SelectOption<import('@prompt-optimizer/core').Template> {
  /** Template name */
  primary: string
  /** Template description */
  secondary: string
  /** Template ID */
  value: string
  /** Raw template config */
  raw: import('@prompt-optimizer/core').Template
}

