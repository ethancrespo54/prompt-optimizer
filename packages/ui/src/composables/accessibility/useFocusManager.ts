import { ref, nextTick, computed } from 'vue'

import { useAccessibility } from './useAccessibility'

export interface FocusManagerOptions {
  /** Container selector or element */
  container?: HTMLElement | string
  /** Whether to cycle the focus */
  loop?: boolean
  /** Whether to include hidden elements */
  includeHidden?: boolean
  /** Custom focusable element selector */
  focusableSelector?: string
  /** Focus change callback */
  onFocusChange?: (element: HTMLElement, index: number) => void
  /** Boundary handling callback */
  onBoundary?: (direction: 'start' | 'end') => void
}

export interface FocusState {
  currentIndex: number
  totalElements: number
  currentElement: HTMLElement | null
  isTrapped: boolean
  container: HTMLElement | null
}

export function useFocusManager(options: FocusManagerOptions = {}) {
  const { announce } = useAccessibility('FocusManager')
  
  // State management
  const focusableElements = ref<HTMLElement[]>([])
  const currentFocusIndex = ref(-1)
  const isTrapped = ref(false)
  const containerRef = ref<HTMLElement | null>(null)
  const previousActiveElement = ref<Element | null>(null)
  
  // Default focusable element selector
  const defaultFocusableSelector = [
    'button:not([disabled]):not([tabindex="-1"])',
    'input:not([disabled]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    'a[href]:not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]:not([tabindex="-1"])',
    'audio[controls]:not([tabindex="-1"])',
    'video[controls]:not([tabindex="-1"])',
    'details summary:not([tabindex="-1"])'
  ].join(', ')
  
  // Computed properties
  const focusState = computed<FocusState>(() => ({
    currentIndex: currentFocusIndex.value,
    totalElements: focusableElements.value.length,
    currentElement: focusableElements.value[currentFocusIndex.value] || null,
    isTrapped: isTrapped.value,
    container: containerRef.value
  }))
  
  const hasValidFocus = computed(() => 
    currentFocusIndex.value >= 0 && 
    currentFocusIndex.value < focusableElements.value.length
  )
  
  // Get the container element
  const getContainer = (): HTMLElement => {
    if (containerRef.value) return containerRef.value
    
    const { container } = options
    if (!container) return document.body
    
    if (typeof container === 'string') {
      const element = document.querySelector(container) as HTMLElement
      if (!element) {
        console.warn(`FocusManager: Container "${container}" not found`)
        return document.body
      }
      containerRef.value = element
      return element
    }
    
    containerRef.value = container
    return container
  }
  
  // Find focusable elements
  const findFocusableElements = (): HTMLElement[] => {
    const container = getContainer()
    const selector = options.focusableSelector || defaultFocusableSelector
    
    const elements = Array.from(
      container.querySelectorAll(selector)
    ) as HTMLElement[]
    
    // Filter out invisible elements (unless explicitly included)
    return elements.filter(element => {
      if (options.includeHidden) return true
      
      // Check whether the element is visible
      const style = window.getComputedStyle(element)
      return style.display !== 'none' && 
             style.visibility !== 'hidden' && 
             style.opacity !== '0' &&
             element.offsetWidth > 0 && 
             element.offsetHeight > 0
    })
  }
  
  // Update the focusable element list
  const updateFocusableElements = () => {
    const elements = findFocusableElements()
    focusableElements.value = elements
    
    // If the current focus index is invalid, reset it
    if (currentFocusIndex.value >= elements.length) {
      currentFocusIndex.value = elements.length > 0 ? 0 : -1
    }
    
    return elements
  }
  
  // Set the focus to the given element
  const focusElement = async (element: HTMLElement, announceChange = true) => {
    try {
      const index = focusableElements.value.indexOf(element)
      if (index === -1) {
        updateFocusableElements()
        const newIndex = focusableElements.value.indexOf(element)
        if (newIndex === -1) return false
        currentFocusIndex.value = newIndex
      } else {
        currentFocusIndex.value = index
      }
      
      await nextTick()
      element.focus()
      
      if (announceChange) {
        const role = element.getAttribute('role') || element.tagName.toLowerCase()
        const label = element.getAttribute('aria-label') || 
                     element.textContent?.trim() || 
                     element.getAttribute('title') || 
                     `${role} ${currentFocusIndex.value + 1}`
        
        announce(`Focused on ${label}`, 'polite')
      }
      
      options.onFocusChange?.(element, currentFocusIndex.value)
      return true
      
    } catch (error) {
      console.warn('Failed to focus element:', error)
      return false
    }
  }
  
  // Set the focus to the given index
  const focusIndex = async (index: number, announceChange = true) => {
    const elements = focusableElements.value
    if (elements.length === 0 || index < 0 || index >= elements.length) {
      return false
    }
    
    return await focusElement(elements[index], announceChange)
  }
  
  // Move the focus
  const moveFocus = async (direction: 'next' | 'previous' | 'first' | 'last') => {
    const elements = updateFocusableElements()
    if (elements.length === 0) return false
    
    let newIndex = currentFocusIndex.value
    
    switch (direction) {
      case 'next':
        newIndex = currentFocusIndex.value + 1
        if (newIndex >= elements.length) {
          if (options.loop) {
            newIndex = 0
          } else {
            options.onBoundary?.('end')
            return false
          }
        }
        break
        
      case 'previous':
        newIndex = currentFocusIndex.value - 1
        if (newIndex < 0) {
          if (options.loop) {
            newIndex = elements.length - 1
          } else {
            options.onBoundary?.('start')
            return false
          }
        }
        break
        
      case 'first':
        newIndex = 0
        break
        
      case 'last':
        newIndex = elements.length - 1
        break
    }
    
    return await focusIndex(newIndex)
  }
  
  // Enable the focus trap
  const trapFocus = async () => {
    if (isTrapped.value) return
    
    // Save the currently active element
    previousActiveElement.value = document.activeElement
    
    isTrapped.value = true
    const elements = updateFocusableElements()
    
    if (elements.length === 0) {
      console.warn('FocusManager: No focusable elements found')
      return
    }
    
    // Focus the first element
    await focusElement(elements[0])
    
    // Add the keyboard event listener
    const container = getContainer()
    container.addEventListener('keydown', handleKeyDown)
    
    announce('Focus is now restricted to the current area', 'assertive')
  }
  
  // Release the focus trap
  const releaseFocus = () => {
    if (!isTrapped.value) return
    
    isTrapped.value = false
    
    // Remove the keyboard event listener
    const container = getContainer()
    container.removeEventListener('keydown', handleKeyDown)
    
    // Restore the previous focus
    if (previousActiveElement.value && 
        typeof (previousActiveElement.value as HTMLElement).focus === 'function') {
      (previousActiveElement.value as HTMLElement).focus()
    }
    
    previousActiveElement.value = null
    announce('Focus restriction released', 'polite')
  }
  
  // Keyboard event handling
  const handleKeyDown = (event: KeyboardEvent) => {
    if (!isTrapped.value) return
    
    switch (event.key) {
      case 'Tab':
        event.preventDefault()
        moveFocus(event.shiftKey ? 'previous' : 'next')
        break
        
      case 'ArrowDown':
      case 'ArrowRight':
        if (!event.ctrlKey && !event.metaKey) {
          event.preventDefault()
          moveFocus('next')
        }
        break
        
      case 'ArrowUp':
      case 'ArrowLeft':
        if (!event.ctrlKey && !event.metaKey) {
          event.preventDefault()
          moveFocus('previous')
        }
        break
        
      case 'Home':
        event.preventDefault()
        moveFocus('first')
        break
        
      case 'End':
        event.preventDefault()
        moveFocus('last')
        break
        
      case 'Escape':
        if (event.target !== getContainer()) {
          event.preventDefault()
          releaseFocus()
        }
        break
    }
  }
  
  // Find the nearest focusable element
  const findNearestFocusable = (targetElement: HTMLElement): HTMLElement | null => {
    const elements = updateFocusableElements()
    if (elements.length === 0) return null
    
    // If the target element is in the list
    const exactIndex = elements.indexOf(targetElement)
    if (exactIndex !== -1) return targetElement
    
    // Find the nearest element
    const container = getContainer()
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          return elements.includes(node as HTMLElement) 
            ? NodeFilter.FILTER_ACCEPT 
            : NodeFilter.FILTER_SKIP
        }
      }
    )
    
    walker.currentNode = targetElement
    return walker.nextNode() as HTMLElement || walker.previousNode() as HTMLElement
  }
  
  // Make sure the focus is within the visible area
  const ensureVisible = (element?: HTMLElement) => {
    const target = element || focusState.value.currentElement
    if (!target) return
    
    // Scroll to the visible area of the element
    target.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest'
    })
  }
  
  // Create the focus indicator
  const createFocusIndicator = () => {
    let indicator = document.getElementById('focus-manager-indicator')
    if (!indicator) {
      indicator = document.createElement('div')
      indicator.id = 'focus-manager-indicator'
      indicator.style.cssText = `
        position: absolute;
        border: 2px solid #0066cc;
        border-radius: 4px;
        pointer-events: none;
        z-index: 10000;
        transition: all 0.15s ease;
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.8);
      `
      document.body.appendChild(indicator)
    }
    return indicator
  }
  
  // Update the focus indicator position
  const updateFocusIndicator = () => {
    const element = focusState.value.currentElement
    if (!element) return
    
    const indicator = createFocusIndicator()
    const rect = element.getBoundingClientRect()
    
    indicator.style.left = `${rect.left - 2}px`
    indicator.style.top = `${rect.top - 2}px`
    indicator.style.width = `${rect.width + 4}px`
    indicator.style.height = `${rect.height + 4}px`
    indicator.style.display = 'block'
  }
  
  // Hide the focus indicator
  const hideFocusIndicator = () => {
    const indicator = document.getElementById('focus-manager-indicator')
    if (indicator) {
      indicator.style.display = 'none'
    }
  }
  
  // Clean up resources
  const destroy = () => {
    releaseFocus()
    hideFocusIndicator()
    const indicator = document.getElementById('focus-manager-indicator')
    if (indicator) {
      indicator.remove()
    }
  }
  
  return {
    // State
    focusState,
    focusableElements: focusableElements,
    hasValidFocus,
    
    // Methods
    updateFocusableElements,
    focusElement,
    focusIndex,
    moveFocus,
    trapFocus,
    releaseFocus,
    findNearestFocusable,
    ensureVisible,
    updateFocusIndicator,
    hideFocusIndicator,
    destroy
  }
}