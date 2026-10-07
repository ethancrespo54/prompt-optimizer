import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

interface VirtualScrollItem {
  id: string | number
  height?: number
  [key: string]: unknown
}

interface VirtualScrollOptions {
  itemHeight?: number
  buffer?: number
  threshold?: number
  containerHeight?: number
}

/**
 * Virtual scroll composable
 * Optimizes the rendering performance of large lists
 */
export function useVirtualScroll<T extends VirtualScrollItem>(
  items: T[],
  options: VirtualScrollOptions = {}
) {
  const {
    itemHeight = 50,
    buffer = 3,
    threshold = 100,
    containerHeight = 400
  } = options

  // State management
  const scrollTop = ref(0)
  const containerRef = ref<HTMLElement>()
  const contentRef = ref<HTMLElement>()
  const isScrolling = ref(false)
  const scrollEndTimer = ref<number>()

  // Compute the visible area
  const visibleRange = computed(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop.value / itemHeight) - buffer)
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop.value + containerHeight) / itemHeight) + buffer
    )
    
    return { startIndex, endIndex }
  })

  // Visible items
  const visibleItems = computed(() => {
    const { startIndex, endIndex } = visibleRange.value
    return items.slice(startIndex, endIndex + 1).map((item, index) => ({
      ...item,
      index: startIndex + index,
      offsetTop: (startIndex + index) * itemHeight
    }))
  })

  // Total height
  const totalHeight = computed(() => items.length * itemHeight)

  // Top offset
  const offsetTop = computed(() => visibleRange.value.startIndex * itemHeight)

  // Bottom padding height
  const offsetBottom = computed(() => 
    Math.max(0, (items.length - visibleRange.value.endIndex - 1) * itemHeight)
  )

  // Scroll event handling
  const handleScroll = (event: Event) => {
    const target = event.target as HTMLElement
    scrollTop.value = target.scrollTop
    
    isScrolling.value = true
    
    // Clear the previous timer
    if (scrollEndTimer.value) {
      clearTimeout(scrollEndTimer.value)
    }
    
    // Set the scroll-end timer
    scrollEndTimer.value = window.setTimeout(() => {
      isScrolling.value = false
    }, 150)
  }

  // Scroll to the specified position
  const scrollToIndex = (index: number, behavior: ScrollBehavior = 'smooth') => {
    if (!containerRef.value) return
    
    const targetScrollTop = Math.max(0, index * itemHeight)
    containerRef.value.scrollTo({
      top: targetScrollTop,
      behavior
    })
  }

  // Scroll to the top
  const scrollToTop = (behavior: ScrollBehavior = 'smooth') => {
    scrollToIndex(0, behavior)
  }

  // Scroll to the bottom
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    scrollToIndex(items.length - 1, behavior)
  }

  // Get the index range of the currently visible items
  const getVisibleIndexRange = () => visibleRange.value

  // Check whether an item is visible
  const isItemVisible = (index: number) => {
    const { startIndex, endIndex } = visibleRange.value
    return index >= startIndex && index <= endIndex
  }

  // Force an update of the visible area
  const forceUpdate = () => {
    nextTick(() => {
      if (containerRef.value) {
        scrollTop.value = containerRef.value.scrollTop
      }
    })
  }

  // Get performance statistics
  const getPerformanceStats = () => {
    const { startIndex, endIndex } = visibleRange.value
    const visibleCount = endIndex - startIndex + 1
    const renderRatio = visibleCount / items.length
    
    return {
      totalItems: items.length,
      visibleItems: visibleCount,
      renderRatio: renderRatio * 100,
      shouldUseVirtual: items.length > threshold,
      memoryUsage: `${(visibleCount * 0.1).toFixed(1)}KB (estimated)`,
      performance: renderRatio < 0.3 ? 'excellent' : renderRatio < 0.6 ? 'good' : 'poor'
    }
  }

  // Lifecycle management
  onMounted(() => {
    if (containerRef.value) {
      containerRef.value.addEventListener('scroll', handleScroll, { passive: true })
    }
  })

  onUnmounted(() => {
    if (containerRef.value) {
      containerRef.value.removeEventListener('scroll', handleScroll)
    }
    if (scrollEndTimer.value) {
      clearTimeout(scrollEndTimer.value)
    }
  })

  return {
    // Refs
    containerRef,
    contentRef,
    
    // State
    scrollTop,
    isScrolling,
    visibleItems,
    visibleRange,
    totalHeight,
    offsetTop,
    offsetBottom,
    
    // Methods
    scrollToIndex,
    scrollToTop,
    scrollToBottom,
    getVisibleIndexRange,
    isItemVisible,
    forceUpdate,
    getPerformanceStats,
    
    // Config
    itemHeight,
    buffer,
    threshold,
    containerHeight
  }
}