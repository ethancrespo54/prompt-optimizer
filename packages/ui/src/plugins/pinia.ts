/**
 * Pinia instance management and installer
 *
 * Provides Pinia creation, installation, and service injection
 *
 * Usage flow:
 * 1. Call installPinia(app) when the app starts
 * 2. Call setPiniaServices(services) after the services finish initializing
 */

import { type App, shallowRef } from 'vue'
import { createPinia } from 'pinia'
import type { AppServices } from '../types/services'

/**
 * Module-level service reference (uses shallowRef to avoid deep proxying)
 */
const servicesRef = shallowRef<AppServices | null>(null)

/**
 * Pinia instance (global singleton)
 */
export const pinia = createPinia()

/**
 * Install Pinia
 *
 * Used in the app startup phase, called before app.mount()
 *
 * @param app - Vue app instance
 */
export function installPinia(app: App) {
  app.use(pinia)
}

/**
 * Set the Pinia services instance
 *
 * Used after the services finish initializing, to inject them into all Stores
 *
 * @param services - App services instance (or null)
 */
export function setPiniaServices(services: AppServices | null) {
  servicesRef.value = services
}

/**
 * Get the Pinia services instance
 *
 * This is the **recommended way to access services in this project**, used inside Stores and Composables.
 *
 * **Design notes**:
 * - This is the standard way to access services in this project (an engineering trade-off)
 * - Based on the singleton pattern, suited to a single-app scenario
 * - Tests need to use setPiniaServices() to set mock services
 * - After tests, setPiniaServices(null) must be called to clean up, avoiding pollution
 *
 * **Why getPiniaServices() is recommended**:
 * - Avoids the this-context dependency, safer when destructured
 * - Fits the functional programming style, consistent with the Composition API
 * - Simpler tests (just call the function directly)
 * - Setup Stores need no this dependency, so the code is clearer
 * - Global singleton pattern, suited to a single-app scenario
 *
 * **Usage example**:
 * ```typescript
 * import { getPiniaServices } from '@/plugins/pinia'
 *
 * export const useMyStore = defineStore('myStore', () => {
 *   const data = ref([])
 *
 *   const loadData = async () => {
 *     const $services = getPiniaServices()
 *     if (!$services) {
 *       console.warn('Services not available')
 *       return
 *     }
 *
 *     const models = await $services.modelManager.getAllModels()
 *     data.value = models
 *   }
 *
 *   return { data, loadData }
 * })
 * ```
 *
 * **Test example**:
 * ```typescript
 * import { setPiniaServices } from '@/plugins/pinia'
 *
 * it('should load data', async () => {
 *   const mockServices = { modelManager: { getAllModels: vi.fn() } }
 *   setPiniaServices(mockServices as any)
 *
 *   const store = useMyStore()
 *   await store.loadData()
 *
 *   expect(mockServices.modelManager.getAllModels).toHaveBeenCalled()
 *
 *   setPiniaServices(null)  // Clean up
 * })
 * ```
 *
 * @returns App services instance (or null)
 */
export function getPiniaServices(): AppServices | null {
  return servicesRef.value
}
