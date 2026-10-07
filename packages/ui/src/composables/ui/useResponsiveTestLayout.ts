import { ref, computed, onMounted, onUnmounted, readonly } from 'vue'

import type {
  TestAreaConfig,
  TestControlLayout,
  TestResultConfig,
  ComponentSize,
  ButtonSize
} from '../../components/types/test-area'

// Screen breakpoint definitions
const BREAKPOINTS = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1600
} as const

type ScreenSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'

export interface ResponsiveTestLayoutOptions {
  // Initial config
  initialConfig?: Partial<TestAreaConfig>
  
  // Custom breakpoints
  customBreakpoints?: Partial<typeof BREAKPOINTS>
  
  // Whether to enable automatic listening
  enableAutoResize?: boolean
}

export function useResponsiveTestLayout(options: ResponsiveTestLayoutOptions = {}) {
  const {
    initialConfig,
    customBreakpoints,
    enableAutoResize = true
  } = options

  // Reactive state
  const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)
  const windowHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 800)

  // Merge the breakpoint config
  const breakpoints = { ...BREAKPOINTS, ...customBreakpoints }

  // Compute the current screen size
  const currentScreenSize = computed<ScreenSize>(() => {
    const width = windowWidth.value
    if (width >= breakpoints.xxl) return 'xxl'
    if (width >= breakpoints.xl) return 'xl'
    if (width >= breakpoints.lg) return 'lg'
    if (width >= breakpoints.md) return 'md'
    if (width >= breakpoints.sm) return 'sm'
    return 'xs'
  })

  // Screen size detection
  const isXS = computed(() => currentScreenSize.value === 'xs')
  const isSM = computed(() => currentScreenSize.value === 'sm')
  const isMD = computed(() => currentScreenSize.value === 'md')
  const isLG = computed(() => currentScreenSize.value === 'lg')
  const isXL = computed(() => currentScreenSize.value === 'xl')
  const isXXL = computed(() => currentScreenSize.value === 'xxl')

  // Screen type detection
  const isMobile = computed(() => windowWidth.value < breakpoints.md)
  const isTablet = computed(() => windowWidth.value >= breakpoints.md && windowWidth.value < breakpoints.lg)
  const isDesktop = computed(() => windowWidth.value >= breakpoints.lg)
  const isLargeScreen = computed(() => windowWidth.value >= breakpoints.xl)

  // Smart component size computation
  const smartComponentSize = computed<ComponentSize>(() => {
    if (isMobile.value) return 'small'
    if (isTablet.value) return 'medium'
    return 'large'
  })

  const smartButtonSize = computed<ButtonSize>(() => {
    if (isMobile.value) return 'small'
    if (isTablet.value) return 'medium'
    return 'medium' // Keep the medium size on desktop to avoid being too large
  })

  // Responsive layout mode
  const recommendedInputMode = computed<'compact' | 'normal'>(() => {
    return isMobile.value ? 'compact' : 'normal'
  })

  const recommendedControlBarLayout = computed<'default' | 'compact' | 'minimal'>(() => {
    if (isMobile.value) return 'minimal'
    if (isTablet.value) return 'compact'
    return 'default'
  })

  // NGrid responsive config
  const gridResponsiveConfig = computed(() => {
    return {
      modelSelectSpan: {
        xs: 24,
        sm: 12,
        md: 8,
        lg: 8,
        xl: 6,
        xxl: 6
      },
      controlButtonsSpan: {
        xs: 24,
        sm: 12,
        md: 16,
        lg: 16,
        xl: 18,
        xxl: 18
      }
    }
  })

  // Height config computation
  const responsiveHeights = computed(() => {
    const baseHeight = windowHeight.value
    
    return {
      testInputMin: isMobile.value ? 2 : 3,
      testInputMax: isMobile.value ? 4 : 8,
      conversationMax: isMobile.value ? '200px' : isTablet.value ? '250px' : '300px',
      resultAreaMax: Math.max(200, baseHeight * 0.6) + 'px'
    }
  })

  // Generate the complete test area config
  const testAreaConfig = computed<TestAreaConfig>(() => {
    return {
      layout: {
        inputMode: recommendedInputMode.value,
        controlBarLayout: recommendedControlBarLayout.value,
        buttonSize: smartButtonSize.value,
        enableFullscreen: !isMobile.value // Fullscreen editing is not recommended on mobile
      },
      features: {
        compareMode: !isMobile.value, // Compare mode is not recommended on mobile
        conversationManager: true,
        advancedMode: isDesktop.value // Advanced mode is only enabled on desktop
      },
      heights: {
        testInputMin: responsiveHeights.value.testInputMin,
        testInputMax: responsiveHeights.value.testInputMax,
        conversationMax: responsiveHeights.value.conversationMax
      },
      responsive: {
        modelSelectSpan: gridResponsiveConfig.value.modelSelectSpan,
        controlButtonsSpan: gridResponsiveConfig.value.controlButtonsSpan
      },
      ...initialConfig
    }
  })

  // Control layout config
  const controlLayoutConfig = computed<TestControlLayout>(() => {
    return {
      modelSelect: {
        span: gridResponsiveConfig.value.modelSelectSpan[currentScreenSize.value],
        responsive: gridResponsiveConfig.value.modelSelectSpan
      },
      controls: {
        span: gridResponsiveConfig.value.controlButtonsSpan[currentScreenSize.value],
        responsive: gridResponsiveConfig.value.controlButtonsSpan,
        justification: isMobile.value ? 'center' : 'end'
      },
      buttons: {
        size: smartButtonSize.value,
        spacing: isMobile.value ? 8 : 12,
        primary: {
          type: 'primary',
          ghost: false
        },
        secondary: {
          type: 'default',
          ghost: !isMobile.value
        }
      }
    }
  })

  // Result display config
  const resultConfig = computed<TestResultConfig>(() => {
    return {
      compareMode: {
        enabled: !isMobile.value,
        layout: isMobile.value || isTablet.value ? 'vertical' : 'horizontal',
        showOriginal: !isMobile.value
      },
      singleMode: {
        title: 'Test Result',
        showToolbar: isDesktop.value
      },
      display: {
        cardSize: smartComponentSize.value,
        gap: isMobile.value ? 8 : 12,
        enableDiff: isDesktop.value,
        enableFullscreen: isDesktop.value
      }
    }
  })

  // Window size change listener
  const handleResize = () => {
    windowWidth.value = window.innerWidth
    windowHeight.value = window.innerHeight
  }

  // Debounce handling
  let resizeTimer: ReturnType<typeof setTimeout> | null = null
  const debouncedHandleResize = () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(handleResize, 150)
  }

  // Lifecycle management
  onMounted(() => {
    if (typeof window !== 'undefined' && enableAutoResize) {
      handleResize() // Initialize
      window.addEventListener('resize', debouncedHandleResize)
    }
  })

  onUnmounted(() => {
    if (typeof window !== 'undefined' && enableAutoResize) {
      window.removeEventListener('resize', debouncedHandleResize)
    }
    if (resizeTimer) {
      clearTimeout(resizeTimer)
      resizeTimer = null
    }
  })

  // Manually trigger a recompute
  const recalculate = () => {
    handleResize()
  }

  // Get the config for a specific breakpoint
  const getConfigForBreakpoint = (): TestAreaConfig => {
    // Simplified implementation: return a copy of the current config directly
    return { ...testAreaConfig.value }
  }

  return {
    // Reactive state
    windowWidth: readonly(windowWidth),
    windowHeight: readonly(windowHeight),
    currentScreenSize: readonly(currentScreenSize),
    
    // Screen size detection
    isXS: readonly(isXS),
    isSM: readonly(isSM),
    isMD: readonly(isMD),
    isLG: readonly(isLG),
    isXL: readonly(isXL),
    isXXL: readonly(isXXL),
    
    // Screen type detection
    isMobile: readonly(isMobile),
    isTablet: readonly(isTablet),
    isDesktop: readonly(isDesktop),
    isLargeScreen: readonly(isLargeScreen),
    
    // Smart config
    smartComponentSize: readonly(smartComponentSize),
    smartButtonSize: readonly(smartButtonSize),
    recommendedInputMode: readonly(recommendedInputMode),
    recommendedControlBarLayout: readonly(recommendedControlBarLayout),
    
    // Responsive config
    gridResponsiveConfig: readonly(gridResponsiveConfig),
    responsiveHeights: readonly(responsiveHeights),
    
    // Full config
    testAreaConfig: readonly(testAreaConfig),
    controlLayoutConfig: readonly(controlLayoutConfig),
    resultConfig: readonly(resultConfig),
    
    // Utility methods
    recalculate,
    getConfigForBreakpoint,
    
    // Constants
    breakpoints: readonly(breakpoints)
  }
}
