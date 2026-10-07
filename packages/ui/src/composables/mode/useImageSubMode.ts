import { computed, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { AppServices } from '../../types/services'
import type { ImageSubMode } from '@prompt-optimizer/core'

interface UseImageSubModeApi {
  imageSubMode: Ref<ImageSubMode>
  setImageSubMode: (mode: ImageSubMode) => Promise<void>
  switchToText2Image: () => Promise<void>
  switchToImage2Image: () => Promise<void>
  ensureInitialized: () => Promise<void>
}

/**
 * Image mode sub-mode management (based on Vue Router)
 *
 * ✅ Refactoring notes:
 * - The route is the single source of truth (/image/text2image or /image/image2image)
 * - Preference storage is no longer used, avoiding inconsistent double writes
 * - setImageSubMode updates the sub-mode through route navigation
 */
export function useImageSubMode(services: Ref<AppServices | null>): UseImageSubModeApi {
  // The services parameter is kept for caller compatibility; this composable no longer persists any preferences
  void services

  const route = useRoute()
  const router = useRouter()

  // Read the sub-mode from the route params (text2image or image2image)
  const imageSubMode = computed<ImageSubMode>(() => {
    // Route architecture (after refactoring): /image/text2image | /image/image2image (no params)
    if (route.path.startsWith('/image/image2image')) return 'image2image'
    if (route.path.startsWith('/image/text2image')) return 'text2image'
    return 'text2image'
  })

  const ensureInitialized = async () => {
    // The route is already initialized; no extra action is needed
    console.log(`[useImageSubMode] Current sub-mode (from the route): ${imageSubMode.value}`)
  }

  const setImageSubMode = async (mode: ImageSubMode) => {
    // Update the sub-mode through route navigation
    const targetPath = `/image/${mode}`
    if (route.path !== targetPath) {
      await router.push(targetPath)
      console.log(`[useImageSubMode] Sub-mode switched (route navigation): ${mode}`)
    }
  }

  const switchToText2Image = () => setImageSubMode('text2image')
  const switchToImage2Image = () => setImageSubMode('image2image')

  return {
    imageSubMode: imageSubMode as Ref<ImageSubMode>,
    setImageSubMode,
    switchToText2Image,
    switchToImage2Image,
    ensureInitialized
  }
}
