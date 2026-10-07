/**
 * App-level Composables
 *
 * These composables are dedicated to complex business logic at the App.vue level,
 * helping reduce the amount of code in App.vue and improve maintainability.
 */

export { useAppHistoryRestore } from './useAppHistoryRestore'
export { useAppFavorite } from './useAppFavorite'

// Export types
export type {
    AppHistoryRestoreOptions,
    AppHistoryRestoreReturn,
    HistoryContext,
} from './useAppHistoryRestore'

export type {
    AppFavoriteOptions,
    AppFavoriteReturn,
} from './useAppFavorite'
