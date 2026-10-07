import type { TextModelConfig, Template } from '@prompt-optimizer/core'
import type { ModelSelectOption, TemplateSelectOption, SelectOption } from '../types/select-options'

/**
 * Data transformation utility class
 * Responsible for converting raw data into the standardized format required by the SelectWithConfig component
 */
export class DataTransformer {
  /**
   * Convert model configs into selector options
   * @param models Array of model configs
   * @returns Standardized model selection options
   */
  static modelsToSelectOptions(models: TextModelConfig[]): ModelSelectOption[] {
    return models.map(model => ({
      primary: model.name,
      secondary: model.providerMeta?.name ?? model.providerMeta?.id ?? 'Unknown',
      value: model.id,
      raw: model,
      // Keep backward compatibility
      label: `${model.name} (${model.providerMeta?.name ?? model.providerMeta?.id ?? 'Unknown'})`
    }))
  }

  /**
   * Convert template configs into selector options
   * @param templates Array of template configs
   * @returns Standardized template selection options
   */
  static templatesToSelectOptions(templates: Template[]): TemplateSelectOption[] {
    return templates.map(template => ({
      primary: template.name || '',
      secondary: template.metadata?.description || '',
      value: template.id,
      raw: template,
      // Keep backward compatibility
      label: template.name || ''
    }))
  }

  /**
   * Generic conversion function
   * @param items Raw data array
   * @param getPrimary Function that extracts the primary display text
   * @param getSecondary Function that extracts the secondary display text
   * @param getValue Function that extracts the value
   * @returns Standardized selection options
   */
  static toSelectOptions<T>(
    items: T[],
    getPrimary: (item: T) => string,
    getSecondary: (item: T) => string,
    getValue: (item: T) => string
  ): SelectOption<T>[] {
    return items.map(item => {
      const primary = getPrimary(item)
      const secondary = getSecondary(item)
      return {
        primary,
        secondary,
        value: getValue(item),
        raw: item,
        // Generate a compatible label format
        label: secondary ? `${primary} (${secondary})` : primary
      }
    })
  }
}

/**
 * Simplified accessor functions
 * Prop functions for the SelectWithConfig component
 */
export const OptionAccessors = {
  /**
   * Get the primary display text
   */
  getPrimary: (opt: SelectOption): string => opt.primary,

  /**
   * Get the secondary display text
   */
  getSecondary: (opt: SelectOption): string => opt.secondary,

  /**
   * Get the selected value
   */
  getValue: (opt: SelectOption): string => opt.value
}

