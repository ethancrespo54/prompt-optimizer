import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { beforeRouteSwitch } from './guards'
import RootBootstrapRoute from './RootBootstrapRoute'

/**
 * Vue Router config
 *
 * Design notes:
 * - Uses hash mode (#/basic/system), Electron compatible
 * - Routes are lazy-loaded to reduce the initial bundle
 * - Route guard: monitors navigation events
 */

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    // The root path redirect is handled by RootBootstrapRoute: it waits for the globalSettings restore to complete before deciding the initial workspace
    name: 'root',
    component: RootBootstrapRoute
  },
  // ✨ Basic mode refactoring: 2 independent routes
  {
    path: '/basic/system',
    name: 'basic-system',
    component: () => import('../components/basic-mode/BasicSystemWorkspace.vue')
  },
  {
    path: '/basic/user',
    name: 'basic-user',
    component: () => import('../components/basic-mode/BasicUserWorkspace.vue')
  },
  // ✨ Pro mode: 2 independent routes
  // - /pro/multi: multi-message mode (ContextSystemWorkspace)
  // - /pro/variable: variable mode (ContextUserWorkspace)
  {
    path: '/pro/multi',
    name: 'pro-multi',
    component: () => import('../components/context-mode/ContextSystemWorkspace.vue')
  },
  {
    path: '/pro/variable',
    name: 'pro-variable',
    component: () => import('../components/context-mode/ContextUserWorkspace.vue')
  },
  // ✨ Image mode refactoring: 2 independent routes
  {
    path: '/image/text2image',
    name: 'image-text2image',
    component: () => import('../components/image-mode/ImageText2ImageWorkspace.vue')
  },
  {
    path: '/image/image2image',
    name: 'image-image2image',
    component: () => import('../components/image-mode/ImageImage2ImageWorkspace.vue')
  }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// Mount the route guard
router.beforeEach(beforeRouteSwitch)

export default router
