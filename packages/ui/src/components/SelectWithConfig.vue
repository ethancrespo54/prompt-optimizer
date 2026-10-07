<template>
  <NSelect
    v-bind="forwardedAttrs"
    :value="normalizedValue"
    :options="mappedOptions"
    :render-label="renderOptionLabel"
    :render-tag="multiple ? renderSelectedTag : undefined"
    @update:value="onUpdateValue"
  >
    <template #empty>
      <slot name="empty">
        <NSpace vertical align="center" style="padding: 12px 0;">
          <NText depth="3">{{ emptyText || t('model.select.noAvailableModels') }}</NText>
          <NButton
            v-if="shouldShowEmptyConfigCTA"
            type="tertiary"
            size="small"
            ghost
            @click="emitConfig()"
          >
            <template #icon>
              <span>⚙️</span>
            </template>
            {{ configText || t('model.select.configure') }}
          </NButton>
        </NSpace>
      </slot>
    </template>

    <template #action>
      <slot name="action">
        <div v-if="shouldShowConfigAction" style="padding: 8px 12px;">
          <NButton quaternary size="small" @click="emitConfig()">
            <template #icon>
              <span>⚙️</span>
            </template>
            {{ configText || t('model.select.configure') }}
          </NButton>
        </div>
      </slot>
    </template>
  </NSelect>
</template>

<script setup lang="ts">
import { computed, h, useAttrs, toValue, type ComputedRef, type Ref } from 'vue'

import { useI18n } from 'vue-i18n'
import { NSelect, NSpace, NButton, NText, type SelectOption as NaiveSelectOption, type SelectFilter } from 'naive-ui'

import type { SelectOption as StandardSelectOption } from '../types/select-options'

type SelectOption = StandardSelectOption<unknown>

type OptionsSource = SelectOption[] | Ref<SelectOption[]> | ComputedRef<SelectOption[]>

interface Props {
  // Allow null so callers can intentionally clear selection.
  modelValue: string | number | Array<string | number> | null
  options: OptionsSource
  getPrimary: (opt: SelectOption) => string
  getSecondary?: (opt: SelectOption) => string
  getValue: (opt: SelectOption) => string | number
  selectedTooltip?: boolean
  showConfigAction?: boolean
  showEmptyConfigCTA?: boolean
  configText?: string
  emptyText?: string
  multiple?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  options: () => [],
  getSecondary: undefined,
  selectedTooltip: true,
  showConfigAction: false,
  showEmptyConfigCTA: false,
  configText: undefined,
  emptyText: undefined,
  multiple: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number | Array<string | number> | null]
  'config': [payload?: Record<string, unknown>]
}>()

const attrs = useAttrs() as Record<string, unknown>
const { t } = useI18n()

// Detect whether there is a config event handler - always show the config button to keep the feature available
// Dynamically show config-related features (explicitly enabled by the parent)
const shouldShowConfigAction = computed(() => !!props.showConfigAction)
const shouldShowEmptyConfigCTA = computed(() => !!props.showEmptyConfigCTA)

// Convert the external raw options into options NSelect recognizes, with a two-line label structure
const mappedOptions = computed(() => {
  // Use toValue to unwrap a possible Ref, compatible with passing a ref or an array directly
  const optionsArray = toValue(props.options) || []
  return optionsArray.map((opt: SelectOption) => {
    const primary = props.getPrimary(opt) || ''
    const secondary = props.getSecondary ? (props.getSecondary(opt) || '') : ''
    const value = props.getValue(opt)
    return {
      label: primary,
      value,
      raw: opt,
      primary,
      secondary
    }
  })
})

// Use Naive UI's official render-label to customize option rendering
const renderOptionLabel = (option: { primary: string; secondary: string; raw: SelectOption }) => {
  const primary = option?.primary || ''
  const secondary = option?.secondary || ''
  const title = props.selectedTooltip && secondary ? `${primary} · ${secondary}` : undefined
  return h('div', { class: 'swc-opt', title }, [
    h('div', { class: 'swc-primary' }, primary),
    secondary ? h('div', { class: 'swc-secondary' }, secondary) : null
  ])
}

// Multi-select tag rendering
const renderSelectedTag = ({
  option
}: {
  option: NaiveSelectOption & { primary?: string; secondary?: string }
  handleClose: () => void
}) => {
  const title = props.selectedTooltip && option?.secondary ? `${option.primary} · ${option.secondary}` : undefined
  return h('span', { title }, option?.primary || '')
}

// Pass through attributes; if there is no custom filter, provide a default filter (matching primary/secondary text)
const forwardedAttrs = computed(() => {
  const hasCustomFilter = Object.prototype.hasOwnProperty.call(attrs, 'filter')
  const internalFilter = (pattern: string, option: { primary: string; secondary: string }) => {
    const p = (pattern || '').toLowerCase()
    return (
      (option?.primary || '').toLowerCase().includes(p) ||
      (option?.secondary || '').toLowerCase().includes(p)
    )
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { ['onUpdate:value']: _, multiple: attrsMultiple, class: rootClass, ['menu-props']: menuPropsKebab, menuProps, style: rootStyle, ...rest } = attrs as Record<string, unknown>

  const normalizedMultiple =
    typeof attrsMultiple === 'boolean'
      ? attrsMultiple
      : attrsMultiple != null
        ? true
        : props.multiple

  // Convention: inject style scoping via class & menu-props.class, avoiding :deep
  const mergedRootClass = [rootClass, 'swc-select'].filter(Boolean).join(' ')
  const mp = (menuPropsKebab || menuProps || {}) as Record<string, unknown>
  const mergedMenuClass = [mp.class, 'swc-select-menu'].filter(Boolean).join(' ')
  const normalizedMenuProps = { ...mp, class: mergedMenuClass }

  const customFilter = (attrs as Record<string, unknown>).filter
  const resolvedFilter: SelectFilter = hasCustomFilter && typeof customFilter === 'function'
    ? (customFilter as SelectFilter)
    : (internalFilter as unknown as SelectFilter)
 
  return {
    filterable: true,
    multiple: normalizedMultiple,
    class: mergedRootClass,
    style: { minWidth: '160px', ...(rootStyle as Record<string, unknown> || {}) },
    menuProps: normalizedMenuProps,
    ...rest,
    filter: resolvedFilter
  }
})

const normalizedValue = computed(() => props.modelValue)

const onUpdateValue = (val: string | number | Array<string | number> | null) => {
  emit('update:modelValue', val)
  const cb = (attrs as Record<string, unknown>)['onUpdate:value']
  if (typeof cb === 'function') cb(val)
}

const emitConfig = () => emit('config')
</script>

<style scoped>
.swc-opt {
  display: flex;
  flex-direction: column;
}
.swc-primary {
  font-weight: 500;
  line-height: 1.35;
}
.swc-secondary {
  font-size: 12px;
  opacity: 0.72;
  line-height: 1.3;
  white-space: normal;
}
</style>

<style>
/* Use class scoping (injected via class & menu-props), avoiding :deep */
.swc-select-menu .n-base-select-option__content {
  white-space: normal;
  line-height: 1.35;
  display: block;
}
.swc-select-menu .n-base-select-option {
  align-items: flex-start;
  padding-top: 6px;
  padding-bottom: 6px;
}
.swc-select-menu .swc-opt {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
}
.swc-select-menu .swc-primary {
  font-weight: 600;
  line-height: 1.35;
  margin-bottom: 2px;
}
.swc-select-menu .swc-secondary {
  font-size: 12px;
  opacity: 0.65;
  line-height: 1.25;
  white-space: normal;
  word-break: break-word;
}
/* The selected area only shows the primary line */
.swc-select .n-base-selection .swc-secondary,
.swc-select .n-base-selection-label .swc-secondary {
  display: none;
}
</style>
