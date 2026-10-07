import { ref, watch, nextTick, onMounted, onBeforeUnmount, type Ref } from 'vue'


/**
 * useAutoScroll composable
 * -------------------------
 * Provides smart auto-scrolling: it pauses auto-scrolling when the user scrolls up and resumes after scrolling back to the bottom.
 * 
 * Usage:
 * 
 * 1. Basic usage
 * ```typescript
 * const { elementRef } = useAutoScroll<HTMLDivElement>()
 * // Reference the element in the template
 * // <div ref="elementRef">...</div>
 * ```
 * 
 * 2. For scenarios where the whole content is updated at once (such as PromptPanel)
 * ```typescript
 * const { elementRef: textareaRef, watchSource } = useAutoScroll<HTMLTextAreaElement>()
 * // Watch props changes and trigger scrolling
 * watchSource(() => props.content, true)
 * ```
 * 
 * 3. For scenarios with streaming content updates (such as OutputPanel)
 * ```typescript
 * const { elementRef: containerRef, onContentChange } = useAutoScroll<HTMLDivElement>()
 * 
 * // Notify the scroll system when the content updates
 * const updateContent = (text: string) => {
 *   content.value += text
 *   onContentChange()
 * }
 * ```
 * 
 * 4. Forced scrolling (regardless of whether the user has scrolled manually)
 * ```typescript
 * const { elementRef, forceScrollToBottom } = useAutoScroll<HTMLElement>()
 * 
 * // Force scrolling to the bottom when needed
 * const resetView = () => {
 *   forceScrollToBottom()
 * }
 * ```
 * 
 * 5. Get and control the auto-scroll state
 * ```typescript
 * const { elementRef, shouldAutoScroll } = useAutoScroll<HTMLElement>()
 * 
 * // Watch the auto-scroll state
 * watch(shouldAutoScroll, (enabled) => {
 *   console.log(`Auto-scroll is now ${enabled ? 'enabled' : 'disabled'}`)
 * })
 * 
 * // Manually toggle the auto-scroll state
 * const toggleAutoScroll = () => {
 *   shouldAutoScroll.value = !shouldAutoScroll.value
 * }
 * ```
 * 
 * @param options Config options
 * @returns An object containing the element ref and auto-scroll-related methods
 */
export function useAutoScroll<T extends HTMLElement>(options: {
    /**
     * Whether to enable auto-scrolling
     * @default true
     */
    enabled?: boolean;
    /**
     * Output debug info in the logs
     * @default false
     */
    debug?: boolean;
    /**
     * Threshold (in pixels) for detecting scrolling to the bottom
     * @default 10
     */
    threshold?: number;
} = {}): {
    elementRef: Ref<T | null>;
    scrollToBottom: () => Promise<void>;
    watchSource: <S>(source: Ref<S> | (() => S),
        immediate?: boolean) => void; forceScrollToBottom: () => Promise<void>;
    shouldAutoScroll: Ref<boolean>
    onContentChange: () => void
} {
    const {
        enabled = true,
        debug = false,
        threshold = 10
    } = options

    // Create a reference to the element to scroll
    const elementRef = ref<T | null>(null) as Ref<T | null>

    // Whether to auto-scroll (set to false when the user scrolls up manually)
    const shouldAutoScroll = ref(true)

    /**
     * Check whether the element has scrolled to the bottom
     */
    const isScrolledToBottom = (element: HTMLElement): boolean => {
        // The element's full scroll height - the element's current scroll position - the element's visible height <= threshold
        return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold
    }

    /**
     * Handle the scroll event
     */
    const handleScroll = () => {
        if (!elementRef.value) return

        // Check whether it scrolled to the bottom
        const isBottom = isScrolledToBottom(elementRef.value)

        if (isBottom && !shouldAutoScroll.value) {
            if (debug) {
                console.log('User scrolled to bottom, resuming auto-scroll')
            }
            shouldAutoScroll.value = true
        } else if (!isBottom && shouldAutoScroll.value) {
            if (debug) {
                console.log('User scrolled up, pausing auto-scroll')
            }
            shouldAutoScroll.value = false
        }
    }

    // Add and remove the scroll event listener
    onMounted(() => {
        if (elementRef.value) {
            elementRef.value.addEventListener('scroll', handleScroll)
        }
    })

    // Watch changes in the element reference in order to add the event handler
    watch(elementRef, (newEl, oldEl) => {
        if (oldEl) {
            oldEl.removeEventListener('scroll', handleScroll)
        }
        if (newEl) {
            newEl.addEventListener('scroll', handleScroll)
        }
    })

    onBeforeUnmount(() => {
        if (elementRef.value) {
            elementRef.value.removeEventListener('scroll', handleScroll)
        }
    })

    /**
     * Manually trigger scrolling to the bottom
     */
    const scrollToBottom = async () => {
        if (!enabled || !elementRef.value || !shouldAutoScroll.value) return

        await nextTick()
        const element = elementRef.value

        if (element) {
            if (debug) {
                console.log('Scrolling element to bottom:', {
                    scrollHeight: element.scrollHeight,
                    element
                })
            }

            element.scrollTop = element.scrollHeight
        }
    }

    /**
     * Force scrolling to the bottom, regardless of the shouldAutoScroll state
     */
    const forceScrollToBottom = async () => {
        if (!enabled || !elementRef.value) return

        await nextTick()
        const element = elementRef.value

        if (element) {
            if (debug) {
                console.log('Force scrolling element to bottom')
            }

            element.scrollTop = element.scrollHeight
            shouldAutoScroll.value = true
        }
    }

    // Add the inner container height state
    const containerHeight = ref(0)

    // Function that checks the height change
    const checkHeightChange = () => {
        if (elementRef.value) {
            const newHeight = elementRef.value.scrollHeight
            if (newHeight !== containerHeight.value) {
                containerHeight.value = newHeight
                // Only scroll when auto-scrolling should happen
                scrollToBottom()
            }
        }
    }

    // Provide a function for checking the height when the content changes
    const onContentChange = () => {
        nextTick(checkHeightChange)
    }

    /**
     * Set up auto-scrolling for the watch source
     * @param source The source data to watch for changes
     * @param immediate Whether to execute immediately
     */
    const watchSource = <S>(source: Ref<S> | (() => S), immediate = false) => {
        watch(source, () => {
            if (debug) {
                console.log('Source changed, triggering scroll, shouldAutoScroll:', shouldAutoScroll.value)
            }

            scrollToBottom()
        }, { immediate })

        return { elementRef, scrollToBottom, forceScrollToBottom, shouldAutoScroll }
    }

    return {
        elementRef,
        scrollToBottom,
        forceScrollToBottom,
        watchSource,
        shouldAutoScroll,
        onContentChange
    }
}