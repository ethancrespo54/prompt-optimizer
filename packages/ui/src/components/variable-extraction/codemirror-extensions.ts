import {
  Decoration,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  hoverTooltip,
  type DecorationSet
} from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import type { ThemeCommonVars } from 'naive-ui'
import {
  autocompletion,
  CompletionContext,
  type Completion,
  type CompletionResult
} from '@codemirror/autocomplete'
import type { DetectedVariable } from './useVariableDetection'

export interface VariableDetectionLabels {
  sourceGlobal: string
  sourceTemporary: string
  sourcePredefined: string
  missingVariable: string
  addToTemporary: string
  emptyValue: string
  valuePreview: (value: string) => string
}

export interface MissingVariableTooltipTheme {
  backgroundColor?: string
  borderColor?: string
  borderRadius?: string
  textColor?: string
  primaryColor?: string
  primaryColorHover?: string
}

export interface ExistingVariableTooltipTheme extends MissingVariableTooltipTheme {
  shadow?: string
  sourceGlobalColor?: string
  sourceTemporaryColor?: string
  sourcePredefinedColor?: string
  surfaceOverlay?: string
}

export interface ThemeExtensionOptions {
  readonly?: boolean
}

type RgbTuple = {
  r: number
  g: number
  b: number
}

function parseColor(color: string | undefined | null): RgbTuple | null {
  if (!color) return null

  const normalized = color.trim().toLowerCase()
  if (normalized.startsWith('#')) {
    const hex = normalized.slice(1)
    if (hex.length === 3) {
      return {
        r: Number.parseInt(hex[0] + hex[0], 16),
        g: Number.parseInt(hex[1] + hex[1], 16),
        b: Number.parseInt(hex[2] + hex[2], 16)
      }
    }
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: Number.parseInt(hex.slice(0, 2), 16),
        g: Number.parseInt(hex.slice(2, 4), 16),
        b: Number.parseInt(hex.slice(4, 6), 16)
      }
    }
    return null
  }

  const rgbMatch = normalized.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (rgbMatch) {
    return {
      r: Number.parseInt(rgbMatch[1], 10),
      g: Number.parseInt(rgbMatch[2], 10),
      b: Number.parseInt(rgbMatch[3], 10)
    }
  }

  return null
}

function toHex({ r, g, b }: RgbTuple): string {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b)
    .toString(16)
    .padStart(2, '0')}`
}

function mixColors(source: RgbTuple, target: RgbTuple, ratio: number): RgbTuple {
  const resolved = Math.max(0, Math.min(1, ratio))
  return {
    r: source.r + (target.r - source.r) * resolved,
    g: source.g + (target.g - source.g) * resolved,
    b: source.b + (target.b - source.b) * resolved
  }
}

function withAlpha(color: string | undefined, alpha: number, fallback: string): string {
  const parsed = parseColor(color)
  if (!parsed) return fallback
  const resolvedAlpha = Math.max(0, Math.min(1, alpha))
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${resolvedAlpha})`
}

function getLuminance({ r, g, b }: RgbTuple): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function getReadableTextColor(
  baseColor: string | undefined,
  fallbackColor: string,
  isDark: boolean
): string {
  const parsedBase = parseColor(baseColor)
  if (!parsedBase) return fallbackColor

  const baseLuminance = getLuminance(parsedBase)
  if (isDark && baseLuminance < 200) {
    return toHex(mixColors(parsedBase, { r: 255, g: 255, b: 255 }, 0.4))
  }
  if (!isDark && baseLuminance > 160) {
    return toHex(mixColors(parsedBase, { r: 0, g: 0, b: 0 }, 0.3))
  }

  return toHex(parsedBase)
}

function detectIsDarkTheme(themeVars: ThemeCommonVars): boolean {
  const cardRgb = parseColor(themeVars.cardColor)
  if (cardRgb) {
    return getLuminance(cardRgb) < 128
  }

  const primaryText = parseColor(themeVars.textColor1)
  if (primaryText) {
    return getLuminance(primaryText) > 180
  }

  return false
}

/** Character set allowed in variable names (supports Unicode letters, digits, and separators) */
const VARIABLE_CHAR_CLASS = '[\\p{L}\\p{N}_\\-.]'
const VARIABLE_TRIGGER_REGEX = new RegExp(`\\{\\{${VARIABLE_CHAR_CLASS}*`, 'u')
const VARIABLE_VALID_REGEX = new RegExp(`^${VARIABLE_CHAR_CLASS}*$`, 'u')

/**
 * Variable highlight extension
 *
 * Shows different background highlight colors depending on the variable source:
 * - Global variables: blue
 * - Temporary variables: green
 * - Predefined variables: purple
 * - Missing variables: red
 */
export function variableHighlighter(
  getVariables: (doc: string) => DetectedVariable[]
) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.buildDecorations(update.view)
        }
      }

      buildDecorations(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>()
        const variables = getVariables(view.state.doc.toString())

        for (const variable of variables) {
          // Make sure the position is within the document range
          if (variable.from >= 0 && variable.to <= view.state.doc.length) {
            const decoration = Decoration.mark({
              class: `cm-variable-${variable.source}`,
              attributes: {
                'data-variable-name': variable.name,
                'data-variable-source': variable.source,
                'data-variable-value': variable.value || ''
              }
            })
            builder.add(variable.from, variable.to, decoration)
          }
        }

        return builder.finish()
      }
    },
    {
      decorations: (v) => v.decorations
    }
  )
}

/**
 * Variable autocomplete extension
 *
 * When the user types {{, shows the list of available variables
 * Includes the variable name, source label, and value preview
 */
export function variableAutocompletion(
  globalVariables: Record<string, string>,
  temporaryVariables: Record<string, string>,
  _predefinedVariables: Record<string, string>, // Predefined variables keep the parameter for caller compatibility but no longer take part in autocomplete
  labels: VariableDetectionLabels
) {
  return autocompletion({
    icons: false,
    override: [
      (context: CompletionContext): CompletionResult | null => {
        // Detect whether it comes after {{
        const word = context.matchBefore(VARIABLE_TRIGGER_REGEX)
        if (!word) return null

        const options = []

        // Add temporary variables (highest priority)
        for (const [name, value] of Object.entries(temporaryVariables)) {
          const preview = value
            ? `${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`
            : labels.emptyValue

          options.push(
            createVariableCompletionOption({
              name,
              source: 'temporary',
              valuePreview: preview,
              boost: 3
            })
          )
        }

        // Add global variables
        for (const [name, value] of Object.entries(globalVariables)) {
          const preview = value
            ? `${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`
            : labels.emptyValue

          options.push(
            createVariableCompletionOption({
              name,
              source: 'global',
              valuePreview: preview,
              boost: 2
            })
          )
        }

        return {
          from: word.from + 2, // Skip {{
          options,
          validFor: VARIABLE_VALID_REGEX
        }
      }
    ],
    // Autocomplete config
    activateOnTyping: true,
    maxRenderedOptions: 20,
    defaultKeymap: true,
    optionClass: (completion) => {
      const source = (completion as VariableCompletionMeta).sourceType
      return source ? `variable-completion-${source}` : ''
    }
  })
}

type VariableSource = 'temporary' | 'global' | 'predefined'

interface CompletionOptionParams {
  name: string
  source: VariableSource
  valuePreview: string
  boost: number
}

interface VariableCompletionMeta extends Completion {
  sourceType?: VariableSource
  valuePreview?: string
}

/**
 * Build variable completion options, handling the closing-brace completion logic automatically
 */
export function createVariableCompletionOption({
  name,
  source,
  valuePreview,
  boost
}: CompletionOptionParams): Completion {
  const completion = {
    label: name,
    displayLabel: `${name}: ${valuePreview}`,
    type: 'variable',
    boost,
    apply: (view, _completion, from, to) => {
      // Count the closing braces already present after the cursor (check at most two)
      let existingClosings = 0
      for (let i = 0; i < 2; i += 1) {
        if (view.state.sliceDoc(to + i, to + i + 1) === '}') {
          existingClosings += 1
        } else {
          break
        }
      }

      const neededClosings = Math.max(0, 2 - existingClosings)
      const closingText = '}'.repeat(neededClosings)
      const insertText = `${name}${closingText}`

      view.dispatch({
        changes: { from, to, insert: insertText },
        selection: {
          anchor: from + insertText.length + existingClosings
        }
      })
    }
  } as Completion & VariableCompletionMeta

  completion.sourceType = source
  completion.valuePreview = valuePreview

  return completion
}

/**
 * Existing-variable hover tooltip extension
 *
 * When the mouse hovers over an existing variable, shows the variable source label and value
 */
export function existingVariableTooltip(
  labels: VariableDetectionLabels,
  theme: ExistingVariableTooltipTheme = {}
) {
  return hoverTooltip((view, pos, _side) => {
    const { node } = view.domAtPos(pos)
    const element = node instanceof Element ? node : node.parentElement

    if (!element) return null

    const isExisting =
      element.classList?.contains('cm-variable-global') ||
      element.classList?.contains('cm-variable-temporary') ||
      element.classList?.contains('cm-variable-predefined') ||
      element.parentElement?.classList?.contains('cm-variable-global') ||
      element.parentElement?.classList?.contains('cm-variable-temporary') ||
      element.parentElement?.classList?.contains('cm-variable-predefined')

    if (!isExisting) return null

    const targetElement = element.classList?.contains('cm-variable-global') ||
                         element.classList?.contains('cm-variable-temporary') ||
                         element.classList?.contains('cm-variable-predefined')
      ? element
      : element.parentElement

    if (!targetElement) return null

    const varName = targetElement.getAttribute('data-variable-name')
    const varSource = targetElement.getAttribute('data-variable-source')
    const varValue = targetElement.getAttribute('data-variable-value') || ''

    if (!varName || !varSource) return null

    const accentColorMap: Record<string, string> = {
      global: theme.sourceGlobalColor || '#2080f0',
      temporary: theme.sourceTemporaryColor || '#18a058',
      predefined: theme.sourcePredefinedColor || '#8a63d2'
    }

    const accentColor = accentColorMap[varSource] || '#2080f0'
    const surfaceOverlay =
      theme.surfaceOverlay || withAlpha(theme.backgroundColor, 0.92, '#ffffff')
    const shadow = theme.shadow || '0 12px 32px rgba(15, 23, 42, 0.18)'

    const text = view.state.doc.toString()
    const escapedVarName = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\{\\{${escapedVarName}\\}\\}`, 'gu')
    let match
    let varFrom = -1
    let varTo = -1

    while ((match = regex.exec(text)) !== null) {
      const matchFrom = match.index
      const matchTo = matchFrom + match[0].length
      if (pos >= matchFrom && pos <= matchTo) {
        varFrom = matchFrom
        varTo = matchTo
        break
      }
    }

    if (varFrom === -1) return null

    return {
      pos: varFrom,
      end: varTo,
      above: true,
      create() {
        const dom = document.createElement('div')
        dom.className = 'cm-existing-variable-tooltip-container'

        const borderColor = theme.borderColor || withAlpha(accentColor, 0.18, '#dcdcdc')
        const borderRadius = theme.borderRadius || '12px'
        const textColor = theme.textColor || '#4c4f69'

        dom.style.padding = '12px 16px'
        dom.style.background = surfaceOverlay
        dom.style.border = `1px solid ${borderColor}`
        dom.style.borderRadius = borderRadius
        dom.style.boxShadow = shadow
        dom.style.fontSize = '13px'
        dom.style.color = textColor
        dom.style.maxWidth = '420px'
        dom.style.lineHeight = '1.6'
        const sourceLabelText =
          varSource === 'global'
            ? labels.sourceGlobal
            : varSource === 'temporary'
              ? labels.sourceTemporary
              : labels.sourcePredefined

        const sourceTag = document.createElement('span')
        sourceTag.style.fontSize = '11px'
        sourceTag.style.fontWeight = '600'
        sourceTag.style.padding = '2px 8px'
        sourceTag.style.borderRadius = '999px'
        sourceTag.style.background = withAlpha(accentColor, 0.1, '#eaf4ff')
        sourceTag.style.color = accentColor
        sourceTag.style.border = `1px solid ${withAlpha(accentColor, 0.25, accentColor)}`
        sourceTag.textContent = sourceLabelText
        sourceTag.style.alignSelf = 'flex-start'
        sourceTag.style.display = 'inline-flex'
        sourceTag.style.alignItems = 'center'
        dom.style.display = 'flex'
        dom.style.flexDirection = 'column'
        dom.style.gap = '8px'
        dom.appendChild(sourceTag)

        const valueSection = document.createElement('div')
        valueSection.style.display = 'flex'
        valueSection.style.flexDirection = 'column'
        valueSection.style.gap = '6px'
        valueSection.style.padding = '10px 12px'
        valueSection.style.background = withAlpha(accentColor, 0.08, 'rgba(0, 0, 0, 0.04)')
        valueSection.style.borderRadius = '8px'
        valueSection.style.border = `1px solid ${withAlpha(accentColor, 0.18, borderColor)}`

        const valueElement = document.createElement('div')
        valueElement.style.fontSize = '13px'
        valueElement.style.color = textColor
        valueElement.style.fontWeight = '500'
        valueElement.style.whiteSpace = 'pre-wrap'
        valueElement.style.wordBreak = 'break-word'
        valueElement.style.maxHeight = '180px'
        valueElement.style.overflowY = 'auto'
        valueElement.style.fontFamily =
          'var(--n-font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)'

        if (varValue.trim()) {
          valueElement.style.fontStyle = 'normal'
          valueElement.style.opacity = '1'
          valueElement.textContent = varValue
        } else {
          valueElement.style.fontWeight = '400'
          valueElement.style.fontStyle = 'italic'
          valueElement.style.opacity = '0.7'
          valueElement.textContent = labels.emptyValue
        }

        valueSection.appendChild(valueElement)
        dom.appendChild(valueSection)

        return { dom }
      }
    }
  })
}

/**
 * Missing-variable hover tooltip extension
 *
 * When the mouse hovers over a missing variable, shows a hint and an "Add to temporary variables" button
 */
export function missingVariableTooltip(
  onAddVariable: (varName: string) => void,
  labels: VariableDetectionLabels,
  theme: MissingVariableTooltipTheme = {}
) {
  return hoverTooltip((view, pos, _side) => {
    // Get the element at the current position
    const { node } = view.domAtPos(pos)
    const element = node instanceof Element ? node : node.parentElement

    if (!element) return null

    // Check whether it is a missing variable
    const isMissing =
      element.classList?.contains('cm-variable-missing') ||
      element.parentElement?.classList?.contains('cm-variable-missing')

    if (!isMissing) return null

    // Get the variable name
    const varName =
      element.getAttribute('data-variable-name') ||
      element.parentElement?.getAttribute('data-variable-name')

    if (!varName) return null

    // Get the position range of the variable
    const text = view.state.doc.toString()
    const escapedVarName = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\{\\{${escapedVarName}\\}\\}`, 'gu')
    let match
    let varFrom = -1
    let varTo = -1

    while ((match = regex.exec(text)) !== null) {
      const matchFrom = match.index
      const matchTo = matchFrom + match[0].length
      if (pos >= matchFrom && pos <= matchTo) {
        varFrom = matchFrom
        varTo = matchTo
        break
      }
    }

    if (varFrom === -1) return null

    return {
      pos: varFrom,
      end: varTo,
      above: true,
      create() {
        const dom = document.createElement('div')
        dom.className = 'cm-missing-variable-tooltip-container'

        const backgroundColor = theme.backgroundColor || '#ffffff'
        const borderColor = theme.borderColor || '#dcdcdc'
        const borderRadius = theme.borderRadius || '4px'
        const textColor = theme.textColor || '#4c4f69'
        const primaryColor = theme.primaryColor || '#18a058'
        const primaryColorHover = theme.primaryColorHover || '#36ad6a'

        dom.style.padding = '8px 12px'
        dom.style.background = backgroundColor
        dom.style.border = `1px solid ${borderColor}`
        dom.style.borderRadius = borderRadius
        dom.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)'
        dom.style.fontSize = '14px'
        dom.style.color = textColor

        const message = document.createElement('div')
        message.style.marginBottom = '8px'
        message.style.color = textColor
        message.textContent = labels.missingVariable

        const button = document.createElement('button')
        button.className = 'n-button n-button--primary-type n-button--small-type'
        button.style.padding = '4px 12px'
        button.style.background = primaryColor
        button.style.color = '#ffffff'
        button.style.border = 'none'
        button.style.borderRadius = borderRadius
        button.style.cursor = 'pointer'
        button.style.fontSize = '12px'
        button.style.transition = 'all 0.3s'
        button.textContent = labels.addToTemporary

        button.addEventListener('mouseenter', () => {
          button.style.background = primaryColorHover
        })
        button.addEventListener('mouseleave', () => {
          button.style.background = primaryColor
        })
        button.addEventListener('click', (e) => {
          e.preventDefault()
          e.stopPropagation()
          onAddVariable(varName)
        })

        dom.appendChild(message)
        dom.appendChild(button)

        return { dom }
      }
    }
  })
}

/**
 * Theme extension - adapts to the Naive UI theme
 * Dynamically adjusts the variable highlight colors based on the light/dark theme to ensure readability
 */
export function createThemeExtension(
  themeVars: ThemeCommonVars,
  options: ThemeExtensionOptions = {}
) {
  const isDark = detectIsDarkTheme(themeVars)

  // Keep CodeMirror background aligned with Naive UI NInput.
  // Fallbacks make unit tests (partial ThemeCommonVars mocks) resilient.
  const inputBackgroundColor = themeVars.inputColor ?? themeVars.cardColor ?? 'transparent'

  const readonlyBackgroundColor =
    themeVars.inputColorDisabled ?? themeVars.inputColor ?? themeVars.cardColor ?? inputBackgroundColor

  const resolvedBackgroundColor = options.readonly ? readonlyBackgroundColor : inputBackgroundColor

  const fallbackSurface = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'
  const fallbackText = themeVars.textColor1 || (isDark ? '#ffffff' : '#1f1f1f')

  const highlightColors = {
    global: {
      backgroundColor: withAlpha(
        themeVars.infoColorSuppl ?? themeVars.infoColor ?? themeVars.primaryColor,
        isDark ? 0.3 : 0.16,
        fallbackSurface
      ),
      color: `${getReadableTextColor(
        themeVars.infoColorSuppl ?? themeVars.infoColor ?? themeVars.primaryColor,
        fallbackText,
        isDark
      )} !important`
    },
    temporary: {
      backgroundColor: withAlpha(
        themeVars.successColorSuppl ?? themeVars.successColor ?? themeVars.primaryColor,
        isDark ? 0.3 : 0.16,
        fallbackSurface
      ),
      color: `${getReadableTextColor(
        themeVars.successColorSuppl ?? themeVars.successColor ?? themeVars.primaryColor,
        fallbackText,
        isDark
      )} !important`
    },
    predefined: {
      backgroundColor: withAlpha(
        themeVars.primaryColorSuppl ?? themeVars.primaryColor,
        isDark ? 0.3 : 0.16,
        fallbackSurface
      ),
      color: `${getReadableTextColor(
        themeVars.primaryColorSuppl ?? themeVars.primaryColor,
        fallbackText,
        isDark
      )} !important`
    },
    missing: {
      backgroundColor: withAlpha(
        themeVars.errorColorSuppl ?? themeVars.errorColor,
        isDark ? 0.32 : 0.18,
        isDark ? 'rgba(248, 113, 113, 0.28)' : 'rgba(248, 113, 113, 0.16)'
      ),
      color: `${getReadableTextColor(
        themeVars.errorColorSuppl ?? themeVars.errorColor,
        fallbackText,
        isDark
      )} !important`
    },
    activeLine: withAlpha(
      isDark ? themeVars.textColor1 : themeVars.primaryColorSuppl ?? themeVars.primaryColor,
      isDark ? 0.12 : 0.08,
      isDark ? 'rgba(255, 255, 255, 0.08)' : themeVars.hoverColor ?? 'rgba(0, 0, 0, 0.05)'
    )
  }

  return EditorView.theme({
    '&': {
      backgroundColor: resolvedBackgroundColor,
      color: themeVars.textColor1,
      fontSize: '14px',
      fontFamily: 'inherit',
      height: '100%'
    },
    '.cm-content': {
      padding: '8px',
      caretColor: themeVars.primaryColor,
      fontFamily: 'inherit'
    },
    '.cm-cursor': {
      borderLeftColor: themeVars.primaryColor
    },
    '.cm-selectionBackground, ::selection': {
      backgroundColor: themeVars.primaryColorSuppl + '40' // 40% opacity
    },
    '&.cm-focused .cm-selectionBackground, &.cm-focused ::selection': {
      backgroundColor: themeVars.primaryColorSuppl + '60' // 60% opacity
    },
    '.cm-activeLine': {
      backgroundColor: highlightColors.activeLine
    },
    '.cm-activeLineGutter': {
      backgroundColor: highlightColors.activeLine,
      color: themeVars.textColor1
    },
    '.cm-gutters': {
      backgroundColor: resolvedBackgroundColor,
      color: themeVars.textColor3,
      border: 'none'
    },
    // Variable highlight styles - dynamically adjust the background and text colors based on the theme
    '.cm-variable-global': {
      backgroundColor: highlightColors.global.backgroundColor,
      color: highlightColors.global.color,
      borderRadius: '2px',
      padding: '0 2px',
      fontWeight: '500'
    },
    '.cm-variable-temporary': {
      backgroundColor: highlightColors.temporary.backgroundColor,
      color: highlightColors.temporary.color,
      borderRadius: '2px',
      padding: '0 2px',
      fontWeight: '500'
    },
    '.cm-variable-predefined': {
      backgroundColor: highlightColors.predefined.backgroundColor,
      color: highlightColors.predefined.color,
      borderRadius: '2px',
      padding: '0 2px',
      fontWeight: '500'
    },
    '.cm-variable-missing': {
      backgroundColor: highlightColors.missing.backgroundColor,
      color: highlightColors.missing.color,
      borderRadius: '2px',
      padding: '0 2px',
      fontWeight: '500',
      textDecoration: 'underline wavy red',
      textDecorationThickness: '2px',
      textUnderlineOffset: '2px'
    }
  })
}
