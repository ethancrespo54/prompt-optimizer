import { ref, onUnmounted } from 'vue'

/**
 * Debounce and throttle composable
 * Provides performance-optimized event handling
 */
export function useDebounceThrottle() {
  const timers = ref(new Map<string, number>())

  /**
   * Debounce function
   * @param fn The function to execute
   * @param delay Delay in milliseconds
   * @param immediate Whether to execute immediately
   * @param key Unique identifier
   */
  const debounce = <Args extends unknown[]>(
    fn: (...args: Args) => unknown,
    delay: number = 300,
    immediate: boolean = false,
    key: string = 'default'
  ) => {
    return (...args: Args): void => {
      const timerId = timers.value.get(key)

      if (timerId) {
        clearTimeout(timerId)
      }

      if (immediate && !timerId) {
        fn(...args)
      }

      const newTimerId = window.setTimeout(() => {
        timers.value.delete(key)
        if (!immediate) {
          fn(...args)
        }
      }, delay)

      timers.value.set(key, newTimerId)
    }
  }

  /**
   * Throttle function
   * @param fn The function to execute
   * @param delay Throttle interval in milliseconds
   * @param key Unique identifier
   */
  const throttle = <Args extends unknown[]>(
    fn: (...args: Args) => unknown,
    delay: number = 100,
    key: string = 'default'
  ) => {
    let lastExecTime = 0

    return (...args: Args): void => {
      const now = Date.now()

      if (now - lastExecTime >= delay) {
        lastExecTime = now
        fn(...args)
      }
    }
  }

  /**
   * requestAnimationFrame throttle
   * Suited to animations and frequent DOM updates
   */
  const rafThrottle = <Args extends unknown[]>(
    fn: (...args: Args) => unknown,
    key: string = 'default'
  ) => {
    let rafId: number | null = null

    return (...args: Args): void => {
      if (rafId !== null) {
        return
      }

      rafId = requestAnimationFrame(() => {
        rafId = null
        fn(...args)
      })
    }
  }

  /**
   * Create a cancelable delayed execution function
   */
  const createCancelableDelay = (
    fn: () => void,
    delay: number,
    key: string = 'default'
  ) => {
    const timerId = window.setTimeout(fn, delay)
    timers.value.set(key, timerId)
    
    return {
      cancel: () => {
        clearTimeout(timerId)
        timers.value.delete(key)
      }
    }
  }

  /**
   * Cancel the specified debounce/throttle timer
   */
  const cancel = (key: string = 'default') => {
    const timerId = timers.value.get(key)
    if (timerId) {
      clearTimeout(timerId)
      timers.value.delete(key)
    }
  }

  /**
   * Cancel all timers
   */
  const cancelAll = () => {
    timers.value.forEach((timerId) => {
      clearTimeout(timerId)
    })
    timers.value.clear()
  }

  /**
   * Get the number of currently active timers
   */
  const getActiveTimersCount = () => timers.value.size

  /**
   * Smart debounce - automatically adjusts the delay based on the input frequency
   */
  const smartDebounce = <Args extends unknown[]>(
    fn: (...args: Args) => unknown,
    minDelay: number = 100,
    maxDelay: number = 1000,
    key: string = 'default'
  ) => {
    let callCount = 0
    let lastCallTime = 0

    return (...args: Args): void => {
      const now = Date.now()
      const timeSinceLastCall = now - lastCallTime

      callCount++
      lastCallTime = now
      
      // Dynamically adjust the delay based on the call frequency
      const frequency = callCount / Math.max(1, timeSinceLastCall / 1000)
      let adaptiveDelay = minDelay
      
      if (frequency > 10) {
        adaptiveDelay = maxDelay
      } else if (frequency > 5) {
        adaptiveDelay = Math.min(maxDelay, minDelay * 3)
      } else if (frequency > 2) {
        adaptiveDelay = Math.min(maxDelay, minDelay * 2)
      }
      
      // Reset the counter (every 10 seconds)
      if (timeSinceLastCall > 10000) {
        callCount = 0
      }

      debounce(fn, adaptiveDelay, false, key)(...args)
    }
  }

  /**
   * Batch execution - collects all calls within a period of time and then executes them in a batch
   */
  const batchExecute = <T>(
    fn: (batch: T[]) => void,
    delay: number = 100,
    key: string = 'default'
  ) => {
    const batches = new Map<string, T[]>()
    
    return (item: T) => {
      const batch = batches.get(key) || []
      batch.push(item)
      batches.set(key, batch)
      
      const timerId = timers.value.get(key)
      if (timerId) {
        clearTimeout(timerId)
      }
      
      const newTimerId = window.setTimeout(() => {
        const finalBatch = batches.get(key) || []
        batches.delete(key)
        timers.value.delete(key)
        
        if (finalBatch.length > 0) {
          fn(finalBatch)
        }
      }, delay)
      
      timers.value.set(key, newTimerId)
    }
  }

  // Clean up all timers
  onUnmounted(() => {
    cancelAll()
  })

  return {
    debounce,
    throttle,
    rafThrottle,
    smartDebounce,
    batchExecute,
    createCancelableDelay,
    cancel,
    cancelAll,
    getActiveTimersCount
  }
}
