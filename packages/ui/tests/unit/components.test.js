import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { ActionButtonUI, ContentCardUI } from '../../src'

describe('Basic UI component test', () => {
  describe('ActionButtonUI', () => {
    it('should render the button text correctly', () => {
      const buttonText = 'Test button'
      const wrapper = mount(ActionButtonUI, {
        props: {
          text: buttonText,
          icon: '??'
        }
      })
      expect(wrapper.text()).toContain(buttonText)
    })

    it('should handle the loading state correctly', async () => {
      const wrapper = mount(ActionButtonUI, {
        props: {
          text: 'Test button',
          icon: '??',
          loading: false
        }
      })

      expect(wrapper.props('loading')).toBe(false)

      await wrapper.setProps({ loading: true })
      expect(wrapper.props('loading')).toBe(true)
    })
  })

  describe('ContentCardUI', () => {
    it('should render slot content correctly', () => {
      const slotContent = 'Test content'
      const wrapper = mount(ContentCardUI, {
        slots: {
          default: slotContent
        }
      })
      expect(wrapper.text()).toContain(slotContent)
    })
  })
})

