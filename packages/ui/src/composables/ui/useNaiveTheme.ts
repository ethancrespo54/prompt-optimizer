// Naive UI theme management composable
import { computed } from 'vue'

import {
  currentThemeId,
  currentThemeConfig,
  currentNaiveTheme,
  currentThemeOverrides,
  availableThemes,
  switchTheme,
  initializeNaiveTheme,
  isDarkTheme,
  getCurrentThemeId,
  getThemeConfig,
  type ThemeConfig
} from '../../config/naive-theme'

/**
 * Naive UI theme management composable
 * Provides a unified theme management interface
 */
export function useNaiveTheme() {
  // Reactive data related to the current theme
  const themeId = computed(() => currentThemeId.value)
  const themeConfig = computed(() => currentThemeConfig.value)
  const naiveTheme = computed(() => currentNaiveTheme.value)
  const themeOverrides = computed(() => currentThemeOverrides.value)
  const isCurrentThemeDark = computed(() => isDarkTheme.value)
  
  // Current theme name
  const currentThemeName = computed(() => themeConfig.value.name)
  
  // Theme switch function
  const changeTheme = (newThemeId: string): boolean => {
    return switchTheme(newThemeId)
  }
  
  // Get the next theme (for cycling)
  const getNextThemeId = (): string => {
    const themeIds = availableThemes.map(t => t.id)
    const currentIndex = themeIds.indexOf(themeId.value)
    const nextIndex = (currentIndex + 1) % themeIds.length
    return themeIds[nextIndex]
  }
  
  // Cycle to the next theme
  const switchToNextTheme = (): boolean => {
    const nextThemeId = getNextThemeId()
    return changeTheme(nextThemeId)
  }
  
  // Switch to a specific type of theme
  const switchToLightTheme = () => changeTheme('light')
  const switchToDarkTheme = () => changeTheme('dark')
  const switchToBlueTheme = () => changeTheme('blue')
  const switchToGreenTheme = () => changeTheme('green')
  const switchToPurpleTheme = () => changeTheme('purple')
  
  // Check whether the current theme is a specific one
  const isLightTheme = computed(() => themeId.value === 'light')
  const isDarkThemeActive = computed(() => themeId.value === 'dark')
  const isBlueTheme = computed(() => themeId.value === 'blue')
  const isGreenTheme = computed(() => themeId.value === 'green')
  const isPurpleTheme = computed(() => themeId.value === 'purple')
  
  // Initialize the theme
  const initTheme = () => {
    initializeNaiveTheme()
  }
  
  return {
    // Reactive state
    themeId,
    themeConfig,
    naiveTheme,
    themeOverrides,
    currentThemeName,
    availableThemes,
    isCurrentThemeDark,
    
    // Theme checks
    isLightTheme,
    isDarkThemeActive,
    isBlueTheme,
    isGreenTheme,
    isPurpleTheme,
    
    // Theme switch methods
    changeTheme,
    switchToNextTheme,
    switchToLightTheme,
    switchToDarkTheme,
    switchToBlueTheme,
    switchToGreenTheme,
    switchToPurpleTheme,
    
    // Utility methods
    initTheme,
    getCurrentThemeId,
    getThemeConfig,
    getNextThemeId
  }
}

// Default export for easy use
export default useNaiveTheme