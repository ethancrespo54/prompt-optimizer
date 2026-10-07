import { ref, onMounted, onUnmounted } from 'vue'

interface LazyLoadOptions {
  root?: Element | null
  rootMargin?: string
  threshold?: number | number[]
  once?: boolean
}

interface LazyCallbackFunction {
  (element: Element, entry: IntersectionObserverEntry): void
}

interface LazyErrorCallbackFunction {
  (error: unknown, element: Element, entry: IntersectionObserverEntry): void
}

interface LazyComponentFunction {
  (): Promise<unknown>
}

interface LazyComponentLoadCallbackFunction {
  (component: unknown): void
}

interface LazyComponentErrorCallbackFunction {
  (error: unknown): void
}

/**
 * Lazy loading composable
 * Optimizes the loading performance of images and components
 */
export function useLazyLoad(options: LazyLoadOptions = {}) {
  const {
    root = null,
    rootMargin = '50px',
    threshold = 0.1,
    once = true
  } = options

  const observer = ref<IntersectionObserver | null>(null)
  const observedElements = ref(new Set<Element>())

  /**
   * Create an intersection observer
   */
  const createObserver = () => {
    if (typeof IntersectionObserver === 'undefined') {
      console.warn('IntersectionObserver is not supported')
      return null
    }

    return new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const element = entry.target
            const callback = (element as Element & { __lazyCallback?: LazyCallbackFunction }).__lazyCallback
            const errorCallback = (element as Element & { __lazyErrorCallback?: LazyErrorCallbackFunction }).__lazyErrorCallback

            try {
              if (callback) {
                callback(element, entry)
              }

              // Handle image lazy loading
              if (element.hasAttribute('data-src')) {
                const img = element as HTMLImageElement
                const src = img.getAttribute('data-src')
                
                if (src) {
                  img.src = src
                  img.removeAttribute('data-src')
                  img.classList.add('lazy-loaded')
                }
              }

              // Handle background image lazy loading
              if (element.hasAttribute('data-bg')) {
                const bgUrl = element.getAttribute('data-bg')
                if (bgUrl) {
                  const div = element as HTMLElement
                  div.style.backgroundImage = `url(${bgUrl})`
                  div.removeAttribute('data-bg')
                  div.classList.add('lazy-loaded')
                }
              }

              // If set to trigger only once, stop observing
              if (once) {
                observer.value?.unobserve(element)
                observedElements.value.delete(element)
              }
            } catch (error) {
              console.error('Lazy load error:', error)
              if (errorCallback) {
                errorCallback(error, element, entry)
              }
            }
          }
        })
      },
      {
        root,
        rootMargin,
        threshold
      }
    )
  }

  /**
   * Observe an element
   */
  const observe = (
    element: Element,
    callback?: LazyCallbackFunction,
    errorCallback?: LazyErrorCallbackFunction
  ) => {
    if (!element || observedElements.value.has(element)) {
      return
    }

    if (!observer.value) {
      observer.value = createObserver()
    }

    if (!observer.value) {
      // If IntersectionObserver is not supported, run the callback immediately
      if (callback) {
        try {
          callback(element, {} as IntersectionObserverEntry)
        } catch (error) {
          if (errorCallback) {
            errorCallback(error, element, {} as IntersectionObserverEntry)
          }
        }
      }
      return
    }

    // Save the callback function
    if (callback) {
      (element as Element & { __lazyCallback?: LazyCallbackFunction }).__lazyCallback = callback
    }
    if (errorCallback) {
      (element as Element & { __lazyErrorCallback?: LazyErrorCallbackFunction }).__lazyErrorCallback = errorCallback
    }

    observer.value.observe(element)
    observedElements.value.add(element)
  }

  /**
   * Stop observing an element
   */
  const unobserve = (element: Element) => {
    if (observer.value && observedElements.value.has(element)) {
      observer.value.unobserve(element)
      observedElements.value.delete(element)
      
      // Clean up the callback function
      delete (element as Element & { __lazyCallback?: LazyCallbackFunction }).__lazyCallback
      delete (element as Element & { __lazyErrorCallback?: LazyErrorCallbackFunction }).__lazyErrorCallback
    }
  }

  /**
   * Stop observing all elements
   */
  const unobserveAll = () => {
    if (observer.value) {
      observer.value.disconnect()
      observedElements.value.clear()
    }
  }

  /**
   * Lazy-load an image
   */
  const lazyImage = (
    img: HTMLImageElement,
    src: string,
    placeholder?: string,
    onLoad?: () => void,
    onError?: (error: Event) => void
  ) => {
    // Set the placeholder
    if (placeholder) {
      img.src = placeholder
    }
    img.setAttribute('data-src', src)
    img.classList.add('lazy-loading')

    observe(
      img,
      () => {
        // Image load listener
        const handleLoad = () => {
          img.classList.remove('lazy-loading')
          img.classList.add('lazy-loaded')
          img.removeEventListener('load', handleLoad)
          img.removeEventListener('error', handleError)
          if (onLoad) onLoad()
        }

        const handleError = (error: Event) => {
          img.classList.remove('lazy-loading')
          img.classList.add('lazy-error')
          img.removeEventListener('load', handleLoad)
          img.removeEventListener('error', handleError)
          if (onError) onError(error)
        }

        img.addEventListener('load', handleLoad)
        img.addEventListener('error', handleError)
      }
    )
  }

  /**
   * Lazy-load a background image
   */
  const lazyBackground = (
    element: HTMLElement,
    bgUrl: string,
    onLoad?: () => void,
    onError?: (error: Event) => void
  ) => {
    element.setAttribute('data-bg', bgUrl)
    element.classList.add('lazy-loading')

    observe(
      element,
      () => {
        // Preload the background image
        const img = new Image()
        
        const handleLoad = () => {
          element.classList.remove('lazy-loading')
          element.classList.add('lazy-loaded')
          if (onLoad) onLoad()
        }

        const handleError = (error: Event) => {
          element.classList.remove('lazy-loading')
          element.classList.add('lazy-error')
          if (onError) onError(error)
        }

        img.addEventListener('load', handleLoad)
        img.addEventListener('error', handleError)
        img.src = bgUrl
      }
    )
  }

  /**
   * Lazy-load a component
   */
  const lazyComponent = (
    element: Element,
    loadComponent: LazyComponentFunction,
    onLoad?: LazyComponentLoadCallbackFunction,
    onError?: LazyComponentErrorCallbackFunction
  ) => {
    element.classList.add('lazy-loading')

    observe(
      element,
      async () => {
        try {
          const component = await loadComponent()
          element.classList.remove('lazy-loading')
          element.classList.add('lazy-loaded')
          if (onLoad) onLoad(component)
        } catch (error) {
          element.classList.remove('lazy-loading')
          element.classList.add('lazy-error')
          if (onError) onError(error)
        }
      }
    )
  }

  /**
   * Batch preload images
   */
  const preloadImages = (urls: string[], onProgress?: (loaded: number, total: number) => void) => {
    return new Promise<void>((resolve, reject) => {
      let loaded = 0
      const total = urls.length
      let hasError = false

      if (total === 0) {
        resolve()
        return
      }

      urls.forEach((url, index) => {
        const img = new Image()
        
        const handleComplete = () => {
          loaded++
          if (onProgress) {
            onProgress(loaded, total)
          }
          
          if (loaded === total) {
            if (hasError) {
              reject(new Error('Some images failed to load'))
            } else {
              resolve()
            }
          }
        }

        img.addEventListener('load', handleComplete)
        img.addEventListener('error', () => {
          hasError = true
          handleComplete()
        })

        img.src = url
      })
    })
  }

  /**
   * Get the observation status
   */
  const getObserverStats = () => {
    return {
      observedCount: observedElements.value.size,
      isSupported: typeof IntersectionObserver !== 'undefined',
      options: { root, rootMargin, threshold, once }
    }
  }

  // Clean up when the component unmounts
  onUnmounted(() => {
    unobserveAll()
  })

  return {
    // Core methods
    observe,
    unobserve,
    unobserveAll,
    
    // Dedicated methods
    lazyImage,
    lazyBackground,
    lazyComponent,
    preloadImages,
    
    // State
    getObserverStats,
    observedElements: observedElements.value
  }
}