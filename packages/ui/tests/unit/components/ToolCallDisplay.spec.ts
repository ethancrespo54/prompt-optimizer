import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ToolCallDisplay from '../../../src/components/ToolCallDisplay.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

describe('ToolCallDisplay basic test', () => {
  const defaultProps = {
    toolCalls: []
  }

  it('should render correctly', () => {
    const wrapper = mount(ToolCallDisplay, {
      props: defaultProps,
      global: {
        stubs: ['NCard', 'NCollapse', 'NCollapseItem', 'NCode', 'NBadge', 'NTag']
      }
    })

    expect(wrapper.exists()).toBe(true)
  })
})