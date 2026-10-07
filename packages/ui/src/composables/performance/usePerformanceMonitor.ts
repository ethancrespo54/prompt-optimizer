import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

import type { PerformanceMetrics } from '../../types/components'

interface PerformanceMemory {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

type PerformanceWithMemory = Performance & {
  memory?: PerformanceMemory
}

/**
 * Performance monitoring composable
 * Provides component performance metric monitoring and optimization suggestions
 */
export function usePerformanceMonitor(componentName: string = 'Unknown') {
  const startTime = ref(0)
  const renderCount = ref(0)
  const updateCount = ref(0)
  const lastUpdate = ref(new Date())
  const memoryUsage = ref(0)
  const observedElements = ref(new Set<Element>())
  
  // Performance observer
  let performanceObserver: PerformanceObserver | null = null
  let resizeObserver: ResizeObserver | null = null
  let mutationObserver: MutationObserver | null = null

  // Record the render start time
  const startRender = () => {
    startTime.value = performance.now()
  }

  // Record the render completion time
  const endRender = async () => {
    await nextTick()
    const renderTime = performance.now() - startTime.value
    renderCount.value++
    lastUpdate.value = new Date()
    
    // Record performance metrics
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(`${componentName}-render-end`)
      performance.measure(
        `${componentName}-render`, 
        `${componentName}-render-start`, 
        `${componentName}-render-end`
      )
    }

    return renderTime
  }

  // Record component updates
  const recordUpdate = () => {
    updateCount.value++
    lastUpdate.value = new Date()
  }

  // Get memory usage
  const updateMemoryUsage = () => {
    if (typeof performance !== 'undefined') {
      const perf = performance as PerformanceWithMemory
      if (perf.memory) {
        memoryUsage.value = perf.memory.usedJSHeapSize
      }
    }
  }

  // Compute performance metrics
  const metrics = computed((): PerformanceMetrics => {
    const renderTime = startTime.value > 0 ? performance.now() - startTime.value : 0
    
    return {
      renderTime: renderTime,
      loadTime: renderTime, // Simplified to the render time
      memoryUsage: memoryUsage.value,
      updateCount: updateCount.value,
      lastUpdate: lastUpdate.value
    }
  })

  // Performance suggestions
  const suggestions = computed(() => {
    const suggestions: string[] = []
    
    if (updateCount.value > 50) {
      suggestions.push('The component updates too frequently; consider using debounce or throttle')
    }
    
    if (metrics.value.renderTime > 16) {
      suggestions.push('Render time exceeds 16ms and may affect the 60fps experience')
    }
    
    if (memoryUsage.value > 50 * 1024 * 1024) { // 50MB
      suggestions.push('Memory usage is high; check for memory leaks')
    }
    
    if (renderCount.value > 0 && updateCount.value / renderCount.value > 10) {
      suggestions.push('The update render ratio is too high; consider optimizing the reactive data')
    }

    return suggestions
  })

  // Performance grade evaluation
  const performanceGrade = computed(() => {
    let score = 100
    
    // Render time score
    if (metrics.value.renderTime > 32) score -= 30
    else if (metrics.value.renderTime > 16) score -= 15
    else if (metrics.value.renderTime > 8) score -= 5
    
    // Update frequency score
    if (updateCount.value > 100) score -= 25
    else if (updateCount.value > 50) score -= 15
    else if (updateCount.value > 20) score -= 5
    
    // Memory usage score
    const memoryMB = memoryUsage.value / (1024 * 1024)
    if (memoryMB > 100) score -= 20
    else if (memoryMB > 50) score -= 10
    else if (memoryMB > 25) score -= 5

    if (score >= 90) return { grade: 'A', color: 'success', text: 'Excellent' }
    if (score >= 80) return { grade: 'B', color: 'info', text: 'Good' }
    if (score >= 70) return { grade: 'C', color: 'warning', text: 'Fair' }
    if (score >= 60) return { grade: 'D', color: 'warning', text: 'Poor' }
    return { grade: 'F', color: 'error', text: 'Needs optimization' }
  })

  // Start performance monitoring
  const startMonitoring = () => {
    if (typeof performance === 'undefined') return

    // Mark the render start
    performance.mark(`${componentName}-render-start`)
    startRender()

    // Create the performance observer
    if (typeof PerformanceObserver !== 'undefined') {
      performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry: PerformanceEntry) => {
          if (entry.name.includes(componentName)) {
            console.debug(`Performance: ${entry.name} took ${entry.duration.toFixed(2)}ms`)
          }
        })
      })
      
      try {
        performanceObserver.observe({ entryTypes: ['measure', 'navigation', 'paint'] })
      } catch (e) {
        console.warn('Performance observer not supported:', e)
      }
    }

    // Periodically update the memory usage
    const memoryInterval = setInterval(updateMemoryUsage, 5000)
    
    onUnmounted(() => {
      clearInterval(memoryInterval)
    })
  }

  // Observe DOM changes
  const observeElement = (element: Element) => {
    if (!element || observedElements.value.has(element)) return

    observedElements.value.add(element)

    // Create a resize observer
    if (!resizeObserver && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          recordUpdate()
        })
      })
    }

    // Create a DOM mutation observer
    if (!mutationObserver && typeof MutationObserver !== 'undefined') {
      mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' || mutation.type === 'attributes') {
            recordUpdate()
          }
        })
      })
    }

    try {
      resizeObserver?.observe(element)
      mutationObserver?.observe(element, { 
        childList: true, 
        attributes: true, 
        subtree: true 
      })
    } catch (e) {
      console.warn('Element observation failed:', e)
    }
  }

  // Stop observing the element
  const unobserveElement = (element: Element) => {
    if (!element || !observedElements.value.has(element)) return
    
    observedElements.value.delete(element)
    resizeObserver?.unobserve(element)
  }

  // Get a detailed performance report
  const getPerformanceReport = () => {
    return {
      componentName,
      metrics: metrics.value,
      grade: performanceGrade.value,
      suggestions: suggestions.value,
      renderCount: renderCount.value,
      updateCount: updateCount.value,
      avgRenderTime: renderCount.value > 0 ? metrics.value.renderTime / renderCount.value : 0,
      updateRenderRatio: renderCount.value > 0 ? updateCount.value / renderCount.value : 0
    }
  }

  // Reset the performance counters
  const resetMetrics = () => {
    renderCount.value = 0
    updateCount.value = 0
    startTime.value = 0
    lastUpdate.value = new Date()
    memoryUsage.value = 0
  }

  // Lifecycle
  onMounted(() => {
    startMonitoring()
    endRender() // Record that the initial render is complete
  })

  onUnmounted(() => {
    performanceObserver?.disconnect()
    resizeObserver?.disconnect()
    mutationObserver?.disconnect()
  })

  return {
    // State
    metrics,
    suggestions,
    performanceGrade,
    renderCount,
    updateCount,
    
    // Methods
    startRender,
    endRender,
    recordUpdate,
    updateMemoryUsage,
    observeElement,
    unobserveElement,
    getPerformanceReport,
    resetMetrics,
    
    // Utility methods
    startMonitoring
  }
}
