/**
 * App-level favorites management composable
 *
 * Responsible for favorites-related business logic, including:
 * - Saving favorites
 * - Using favorites (smart mode switching)
 * - Favorites dialog management
 */

import { ref, nextTick, type Ref } from 'vue'
import { useToast } from '../ui/useToast'
import type { BasicSubMode, ProSubMode, ContextMode, OptimizationMode } from '@prompt-optimizer/core'

/**
 * Data structure for saving a favorite
 */
export interface SaveFavoriteData {
    content: string
    originalContent?: string
    prefill?: {
        title?: string
        description?: string
        category?: string
        tags?: string[]
        functionMode?: 'basic' | 'context' | 'image'
        optimizationMode?: OptimizationMode
        imageSubMode?: 'text2image' | 'image2image'
        metadata?: Record<string, unknown>
    }
}

/**
 * Favorite item data structure
 */
export interface FavoriteItem {
    content: string
    functionMode?: 'basic' | 'pro' | 'image' | 'context'
    optimizationMode?: OptimizationMode
    imageSubMode?: 'text2image' | 'image2image'
    metadata?: Record<string, unknown>
}

/**
 * Config options for useAppFavorite
 */
export interface AppFavoriteOptions {
    /** 🔧 Step D: route navigation function (replaces setFunctionMode/set*SubMode) */
    navigateToSubModeKey: (toKey: string, opts?: { replace?: boolean }) => void
    /** Handle context mode changes */
    handleContextModeChange: (mode: ContextMode) => Promise<void>
    /** Optimizer prompt (used to set the favorite content) */
    optimizerPrompt: Ref<string>
    /** i18n translation function */
    t: (key: string, params?: Record<string, unknown>) => string
    /** Flag for external data loading (prevents the automatic restore on mode switch from overwriting external data) */
    isLoadingExternalData: Ref<boolean>
}

/**
 * Return value of useAppFavorite
 */
export interface AppFavoriteReturn {
    /** Show the favorites management dialog */
    showFavoriteManager: Ref<boolean>
    /** Show the save favorite dialog */
    showSaveFavoriteDialog: Ref<boolean>
    /** Save favorite data */
    saveFavoriteData: Ref<SaveFavoriteData | null>
    /** Handle the save favorite request */
    handleSaveFavorite: (data: SaveFavoriteData) => void
    /** Handle save completion */
    handleSaveFavoriteComplete: () => void
    /** Handle favoriting the optimized prompt */
    handleFavoriteOptimizePrompt: () => void
    /** Handle using a favorite */
    handleUseFavorite: (favorite: FavoriteItem) => Promise<void>
}

/**
 * App-level favorites management composable
 */
export function useAppFavorite(options: AppFavoriteOptions): AppFavoriteReturn {
    const {
        navigateToSubModeKey,
        handleContextModeChange,
        optimizerPrompt,
        t,
        isLoadingExternalData,
    } = options

    const toast = useToast()

    // State
    const showFavoriteManager = ref(false)
    const showSaveFavoriteDialog = ref(false)
    const saveFavoriteData = ref<SaveFavoriteData | null>(null)

    /**
     * Handle the save favorite request
     */
    const handleSaveFavorite = (data: SaveFavoriteData) => {
        // Save the data for prefilling the dialog
        saveFavoriteData.value = data

        // Open the save dialog
        showSaveFavoriteDialog.value = true
    }

    /**
     * Handle save completion
     */
    const handleSaveFavoriteComplete = () => {
        // Closing the dialog is already handled inside the component
        // Optional: refresh the favorites list or show an extra message
    }

    /**
     * Handle favoriting the optimized prompt
     */
    const handleFavoriteOptimizePrompt = () => {
        // Close the favorites management dialog
        showFavoriteManager.value = false
        // Scroll to the optimization area
        nextTick(() => {
            const inputPanel = document.querySelector('[data-input-panel]')
            if (inputPanel) {
                inputPanel.scrollIntoView({ behavior: 'smooth' })
            }
        })
    }

    /**
     * Handle using a favorite - smart mode switching (internal implementation)
     */
    const handleUseFavoriteImpl = async (favorite: FavoriteItem) => {
        const {
            functionMode: favFunctionMode,
            optimizationMode: favOptimizationMode,
            imageSubMode: favImageSubMode,
        } = favorite

        // 🔧 Step D: use navigateToSubModeKey to navigate to the target route in one step
        // No longer two steps (switch functionMode first, then subMode)

        if (favFunctionMode === 'image') {
            // Image mode: determine the target sub-mode from favImageSubMode (defaults to text2image)
            const targetSubMode = favImageSubMode || 'text2image'
            const targetKey = `image-${targetSubMode}`

            navigateToSubModeKey(targetKey)
            toast.info(t('toast.info.switchedToImageMode'))

            await nextTick()

            // Data backfill logic for image mode
            if (typeof window !== 'undefined') {
                window.dispatchEvent(
                    new CustomEvent('image-workspace-restore-favorite', {
                        detail: {
                            content: favorite.content,
                            imageSubMode: favImageSubMode || 'text2image',
                            metadata: favorite.metadata,
                        },
                    }),
                )
            }

            toast.success(t('toast.success.imageFavoriteLoaded'))
        } else if (favFunctionMode === 'basic' || favFunctionMode === 'context' || favFunctionMode === 'pro') {
            // Basic mode or context mode

            // 1. Determine the target function mode
            // Both 'pro' and 'context' map to pro (compatible with historical data)
            const targetFunctionMode = (favFunctionMode === 'context' || favFunctionMode === 'pro') ? 'pro' : 'basic'

            // 2. Determine the target sub-mode (if the favorite specifies an optimization mode)
            // - basic: system/user
            // - pro: multi/variable (compatible with the old optimizationMode: system->multi, user->variable)
            let targetSubMode: BasicSubMode | ProSubMode
            if (targetFunctionMode === 'pro') {
                const mode = favOptimizationMode ?? 'user'
                targetSubMode = mode === 'system' ? 'multi' : 'variable'
            } else {
                targetSubMode = (favOptimizationMode ?? 'system') as BasicSubMode
            }

            // 3. Navigate to the target route in one step
            const targetKey = `${targetFunctionMode}-${targetSubMode}`
            navigateToSubModeKey(targetKey)

            await nextTick()

            // 4. In pro mode, the contextMode must be synced (compatible with the old logic)
            if (targetFunctionMode === 'pro' && favOptimizationMode) {
                await handleContextModeChange(favOptimizationMode as ContextMode)
            }

            toast.info(
                t('toast.info.switchedToFunctionMode', {
                    mode: targetFunctionMode === 'pro' ? t('common.context') : t('common.basic'),
                }),
            )

            if (favOptimizationMode) {
                toast.info(
                    t('toast.info.optimizationModeAutoSwitched', {
                        mode:
                            favOptimizationMode === 'system'
                                ? t('common.system')
                                : t('common.user'),
                    }),
                )
            }

            // 5. Set the favorite's prompt content into the input box
            optimizerPrompt.value = favorite.content
        } else {
            // Other cases: set the content directly without switching modes
            optimizerPrompt.value = favorite.content
        }

        // Close the favorites management dialog
        showFavoriteManager.value = false

        // Show a success message
        toast.success(t('toast.success.favoriteLoaded'))
    }

    /**
     * Error handling wrapper for favorite loading
     */
    const handleUseFavorite = async (favorite: FavoriteItem) => {
        try {
            // 🔧 Set the external data loading flag to prevent the automatic restore on mode switch from overwriting external data
            isLoadingExternalData.value = true

            await handleUseFavoriteImpl(favorite)
        } catch (error) {
            // Catch all errors during favorite loading
            console.error('[App] Failed to load favorite:', error)
            const errorMessage = error instanceof Error ? error.message : String(error)
            toast.error(t('toast.error.favoriteLoadFailed', { error: errorMessage }))
        } finally {
            // 🔧 Restore finished; reset the flag to allow normal mode-switch restores
            isLoadingExternalData.value = false
        }
    }

    return {
        showFavoriteManager,
        showSaveFavoriteDialog,
        saveFavoriteData,
        handleSaveFavorite,
        handleSaveFavoriteComplete,
        handleFavoriteOptimizePrompt,
        handleUseFavorite,
    }
}
