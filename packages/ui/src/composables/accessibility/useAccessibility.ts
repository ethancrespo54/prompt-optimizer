import { ref, computed, onMounted, onUnmounted } from 'vue'

import { useI18n } from 'vue-i18n'

export interface KeyboardNavigation {
  handleKeyPress: (event: KeyboardEvent) => boolean
  focusNext: () => void
  focusPrevious: () => void
  focusFirst: () => void
  focusLast: () => void
  setFocusableElements: (elements: HTMLElement[]) => void
}

export interface ARIALabels {
  getLabel: (key: string, fallback?: string) => string
  getDescription: (key: string, fallback?: string) => string
  getRole: (element: string) => string
  getLiveRegionText: (key: string) => string
}

export interface AccessibilityFeatures {
  reduceMotion: boolean
  highContrast: boolean
  screenReaderMode: boolean
  keyboardOnly: boolean
}

export function useAccessibility(componentName: string = 'Component') {
  const { t } = useI18n()
  
  // Focus management
  const focusableElements = ref<HTMLElement[]>([])
  const currentFocusIndex = ref(-1)
  const trapFocus = ref(false)
  
  // Accessibility feature detection
  const features = ref<AccessibilityFeatures>({
    reduceMotion: false,
    highContrast: false,
    screenReaderMode: false,
    keyboardOnly: false
  })
  
  // Live region messages
  const liveRegionMessage = ref('')
  const announcements = ref<string[]>([])
  
  // Keyboard navigation handling
  const keyboard: KeyboardNavigation = {
    handleKeyPress: (event: KeyboardEvent): boolean => {
      // Simplified keyboard support: only handle Tab cycling and Escape notification when the focus trap is enabled, to avoid affecting normal input (such as arrow keys moving the cursor)
      if (!trapFocus.value || focusableElements.value.length === 0) {
        return false
      }

      const target = event.target as HTMLElement | null
      const isEditable = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable === true
      )

      switch (event.key) {
        case 'Tab':
          // Let Tab through in input areas without intercepting; only use it for focus cycling in non-input areas
          if (isEditable) return false
          handleTabNavigation(event)
          return true
        case 'Escape':
          // Do not prevent the default; only emit an escape event and let the upper layer handle it
          handleEscapeKey()
          return false
        default:
          // Do not intercept other keys (including arrow keys / Home / End, etc.)
          return false
      }
    },
    
    focusNext: () => {
      if (focusableElements.value.length === 0) return
      currentFocusIndex.value = Math.min(
        currentFocusIndex.value + 1,
        focusableElements.value.length - 1
      )
      focusableElements.value[currentFocusIndex.value]?.focus()
    },
    
    focusPrevious: () => {
      if (focusableElements.value.length === 0) return
      currentFocusIndex.value = Math.max(currentFocusIndex.value - 1, 0)
      focusableElements.value[currentFocusIndex.value]?.focus()
    },
    
    focusFirst: () => {
      if (focusableElements.value.length === 0) return
      currentFocusIndex.value = 0
      focusableElements.value[0]?.focus()
    },
    
    focusLast: () => {
      if (focusableElements.value.length === 0) return
      currentFocusIndex.value = focusableElements.value.length - 1
      focusableElements.value[currentFocusIndex.value]?.focus()
    },
    
    setFocusableElements: (elements: HTMLElement[]) => {
      focusableElements.value = elements
      currentFocusIndex.value = elements.length > 0 ? 0 : -1
    }
  }
  
  // ARIA label management
  const aria: ARIALabels = {
    getLabel: (key: string, fallback?: string): string => {
      return t(`accessibility.labels.${key}`, fallback || key)
    },
    
    getDescription: (key: string, fallback?: string): string => {
      return t(`accessibility.descriptions.${key}`, fallback || '')
    },
    
    getRole: (element: string): string => {
      const roleMap: Record<string, string> = {
        button: 'button',
        input: 'textbox',
        select: 'combobox',
        checkbox: 'checkbox',
        radio: 'radio',
        link: 'link',
        tab: 'tab',
        tabpanel: 'tabpanel',
        dialog: 'dialog',
        menu: 'menu',
        menuitem: 'menuitem',
        list: 'list',
        listitem: 'listitem',
        alert: 'alert',
        status: 'status'
      }
      return roleMap[element] || 'generic'
    },
    
    getLiveRegionText: (key: string): string => {
      return t(`accessibility.liveRegion.${key}`, key)
    }
  }
  
  // Tab navigation handling
  const handleTabNavigation = (event: KeyboardEvent) => {
    const isShiftTab = event.shiftKey
    const focusedElement = document.activeElement as HTMLElement
    const currentIndex = focusableElements.value.indexOf(focusedElement)
    
    if (currentIndex !== -1) {
      currentFocusIndex.value = currentIndex
    }
    
    event.preventDefault()
    
    if (isShiftTab) {
      keyboard.focusPrevious()
    } else {
      keyboard.focusNext()
    }
  }
  
  // Escape key handling
  const handleEscapeKey = () => {
    // Emit the escape event for the parent component to handle
    document.dispatchEvent(new CustomEvent('accessibility:escape', {
      detail: { componentName }
    }))
  }
  
  // Find focusable elements
  const updateFocusableElements = (container?: HTMLElement) => {
    const focusableSelector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ')
    
    const containerEl = container || document.body
    const elements = Array.from(
      containerEl.querySelectorAll(focusableSelector)
    ) as HTMLElement[]
    
    keyboard.setFocusableElements(elements)
  }
  
  // Announce the message to screen readers
  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    announcements.value.push(message)
    liveRegionMessage.value = message
    
    // Clear the message so the screen reader re-reads it
    setTimeout(() => {
      liveRegionMessage.value = ''
    }, 100)
    
    // Limit the message queue length
    if (announcements.value.length > 5) {
      announcements.value = announcements.value.slice(-5)
    }
  }
  
  // Detect accessibility preferences
  const detectAccessibilityFeatures = () => {
    if (typeof window === 'undefined') return
    
    // Detect animation preferences
    if (window.matchMedia) {
      const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      features.value.reduceMotion = reduceMotionQuery.matches
      
      const highContrastQuery = window.matchMedia('(prefers-contrast: high)')
      features.value.highContrast = highContrastQuery.matches
      
      // Watch for changes
      reduceMotionQuery.addEventListener('change', (e) => {
        features.value.reduceMotion = e.matches
      })
      
      highContrastQuery.addEventListener('change', (e) => {
        features.value.highContrast = e.matches
      })
    }
    
    // Detect screen readers
    features.value.screenReaderMode = window.navigator.userAgent.includes('NVDA') ||
      window.navigator.userAgent.includes('JAWS') ||
      !!document.querySelector('[data-screen-reader]')
    
    // Detect keyboard-only users
    let hasMouseMovement = false
    const handleMouseMove = () => {
      if (!hasMouseMovement) {
        hasMouseMovement = true
        features.value.keyboardOnly = false
        document.removeEventListener('mousemove', handleMouseMove)
      }
    }
    
    const handleKeydown = () => {
      if (!hasMouseMovement) {
        features.value.keyboardOnly = true
      }
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('keydown', handleKeydown)
  }
  
  // Enable the focus trap
  const enableFocusTrap = (container?: HTMLElement) => {
    trapFocus.value = true
    updateFocusableElements(container)
    
    // Focus the first element immediately
    if (focusableElements.value.length > 0) {
      focusableElements.value[0].focus()
    }
  }
  
  // Disable the focus trap
  const disableFocusTrap = () => {
    trapFocus.value = false
    focusableElements.value = []
    currentFocusIndex.value = -1
  }
  
  // Computed properties
  const accessibilityClasses = computed(() => ({
    'reduce-motion': features.value.reduceMotion,
    'high-contrast': features.value.highContrast,
    'screen-reader': features.value.screenReaderMode,
    'keyboard-only': features.value.keyboardOnly
  }))
  
  const isAccessibilityMode = computed(() => 
    features.value.screenReaderMode || 
    features.value.keyboardOnly || 
    features.value.highContrast
  )
  
  // Lifecycle
  onMounted(() => {
    detectAccessibilityFeatures()
    
    // Add the global keyboard event listener
    document.addEventListener('keydown', keyboard.handleKeyPress)
  })
  
  onUnmounted(() => {
    document.removeEventListener('keydown', keyboard.handleKeyPress)
    disableFocusTrap()
  })
  
  return {
    // State
    features,
    focusableElements,
    currentFocusIndex,
    trapFocus,
    liveRegionMessage,
    announcements,
    
    // Computed properties
    accessibilityClasses,
    isAccessibilityMode,
    
    // Methods
    keyboard,
    aria,
    announce,
    enableFocusTrap,
    disableFocusTrap,
    updateFocusableElements,
    detectAccessibilityFeatures
  }
}

// Export common ARIA attribute helper functions
export const createAriaProps = (
  labelKey: string, 
  descriptionKey?: string,
  role?: string
) => ({
  'aria-label': labelKey,
  'aria-describedby': descriptionKey ? `${descriptionKey}-desc` : undefined,
  'role': role
})

// Export keyboard shortcut constants
export const KEYBOARD_SHORTCUTS = {
  ESCAPE: 'Escape',
  ENTER: 'Enter',
  SPACE: ' ',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End'
} as const
