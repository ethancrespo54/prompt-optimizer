import type { NavigationGuard } from 'vue-router'
import type { SubModeKey } from '../stores/session/useSessionManager'

/**
 * Parse the sub-mode key from the route path
 * @param path Route path, e.g. '/basic/system' or '/pro/multi'
 * @returns SubModeKey or null (if the path format is invalid)
 */
export const parseSubModeKey = (path: string): SubModeKey | null => {
  const validSubModes = {
    basic: ['system', 'user'] as const,
    pro: ['multi', 'variable'] as const,
    image: ['text2image', 'image2image'] as const,
  } as const

  type Mode = keyof typeof validSubModes
  type ValidSubMode<M extends Mode> = (typeof validSubModes)[M][number]
  const isValidSubMode = <M extends Mode>(mode: M, subMode: string): subMode is ValidSubMode<M> => {
    return (validSubModes[mode] as readonly string[]).includes(subMode)
  }

  const match = path.match(/^\/(basic|pro|image)\/([^/]+)$/)
  if (!match) return null

  const [, mode, subMode] = match

  if (!isValidSubMode(mode as Mode, subMode)) {
    return null
  }

  return `${mode}-${subMode}` as SubModeKey
}

/**
 * Route switch guard
 *
 * Features:
 * 1. Validate that subMode is legal
 * 2. Redirect illegal routes to the default subMode
 * 3. Compatible with the old pro routes (/pro/system|/pro/user)
 */
export const beforeRouteSwitch: NavigationGuard = (to, _from, next) => {
  // ✅ Compatible with the old pro routes (/pro/system|/pro/user -> /pro/multi|/pro/variable)
  if (to.path === '/pro/system') {
    next('/pro/multi')
    return
  }
  if (to.path === '/pro/user') {
    next('/pro/variable')
    return
  }

  const subModeKey = parseSubModeKey(to.path)

  if (subModeKey === null && to.path !== '/') {
    const match = to.path.match(/^\/(basic|pro|image)/)
    if (match) {
      const mode = match[1]

      let defaultSubMode: string
      if (mode === 'image') {
        defaultSubMode = 'text2image'
      } else if (mode === 'pro') {
        defaultSubMode = 'variable'
      } else {
        defaultSubMode = 'system'
      }

      console.warn(`[Router] Illegal subMode: ${to.path}, redirecting to /${mode}/${defaultSubMode}`)
      next(`/${mode}/${defaultSubMode}`)
      return
    }
  }

  next()
}
