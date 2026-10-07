import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import OptimizationModeSelector from '../../src/components/OptimizationModeSelector.vue'

describe('OptimizationModeSelector', () => {
  it('renders correctly with text content', () => {
    const wrapper = mount(OptimizationModeSelector, {
      props: {
        modelValue: 'system'
      },
    })

    const radioButtons = wrapper.findAll('.n-radio-button, [role="radio"]')
    expect(radioButtons.length).toBeGreaterThan(0)

    // The copy is determined by i18n (injected by the global setup.ts); here we only verify it renders with content
    expect(wrapper.text().length).toBeGreaterThan(0)
  })
})
