/**
 * Global test setup file
 * Provides common mocks and environment configuration for all tests
 */

import { vi } from 'vitest'
import { config } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import enUS from '../src/i18n/locales/en-US'
import { setupErrorDetection } from './utils/error-detection'

// Create an i18n instance for tests
const i18n = createI18n({
  legacy: false,
  locale: 'en-US',
  fallbackLocale: 'en-US',
  messages: {
    'en-US': enUS,
  }
})

// Configure Vue Test Utils global plugins
config.global.plugins = [i18n]

// Configure the Naive UI global plugin
// To avoid configuring Naive UI manually in every test, we configure it in the global setup
config.global.stubs = {
  // Keep Teleport to support Naive UI's popup components
  Teleport: true
}

// Create a global message API mock (Naive UI depends on it)
if (typeof window !== 'undefined') {
  (window as any).$message = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn()
  }
}

// Mock navigator.clipboard API (JSDOM doesn't provide this)
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue('mocked clipboard content')
  }
})

// Mock document.execCommand for fallback clipboard functionality
Object.assign(document, {
  execCommand: vi.fn().mockReturnValue(true)
})

// Mock window.getComputedStyle (needed for Vue Transition and DOM tests)
// Vue's Transition component needs transitionDelay, transitionDuration, etc.
const mockComputedStyle = {
  transitionDelay: '',
  transitionDuration: '',
  transitionProperty: '',
  animationDelay: '',
  animationDuration: '',
  animationName: '',
  display: 'block',
  getPropertyValue: vi.fn().mockReturnValue('')
}
Object.assign(window, {
  getComputedStyle: vi.fn().mockReturnValue(mockComputedStyle)
})

// Mock ResizeObserver (commonly used in modern components)
// Use a real class instead of vi.fn().mockImplementation(), because some libraries instantiate at module top level
class MockResizeObserver {
  callback: ResizeObserverCallback | null = null
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  constructor(callback?: ResizeObserverCallback) {
    this.callback = callback || null
  }
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

// Mock IntersectionObserver (used for lazy loading and scroll detection)
class MockIntersectionObserver {
  callback: IntersectionObserverCallback | null = null
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn().mockReturnValue([])
  root = null
  rootMargin = ''
  thresholds: number[] = []
  constructor(callback?: IntersectionObserverCallback) {
    this.callback = callback || null
  }
}
global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver

// Mock MutationObserver (used by CodeMirror and other DOM manipulation libraries)
class MockMutationObserver {
  callback: MutationCallback | null = null
  observe = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn().mockReturnValue([])
  constructor(callback?: MutationCallback) {
    this.callback = callback || null
  }
}
global.MutationObserver = MockMutationObserver as unknown as typeof MutationObserver

// Mock window.matchMedia (used for responsive design)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock scrollTo methods
Object.assign(window, {
  scrollTo: vi.fn(),
  scroll: vi.fn(),
})

Object.assign(Element.prototype, {
  scrollTo: vi.fn(),
  scroll: vi.fn(),
  scrollIntoView: vi.fn(),
})

// CodeMirror relies on Range geometry methods which are incomplete in jsdom.
// Provide a minimal polyfill to avoid noisy test stderr.
if (typeof Range !== 'undefined') {
  const proto = Range.prototype as any
  if (typeof proto.getClientRects !== 'function') {
    proto.getClientRects = () => []
  }
  if (typeof proto.getBoundingClientRect !== 'function') {
    proto.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
      toJSON: () => ({})
    })
  }
}

console.log('[Test Setup] Global browser API mocks initialized')

// ========== Pinia service cleanup (prevents test pollution) ==========
import { afterEach } from 'vitest'
import { setPiniaServices } from '../src/plugins/pinia'

/**
 * Global test cleanup: make sure Pinia services are cleaned up after every test case
 * Avoids state pollution between test cases
 *
 * This is the "fallback mechanism" suggested by Codex:
 * - Even if a test case forgets to clean up manually, the global afterEach cleans up automatically
 * - Works even better together with the helpers in pinia-test-helpers.ts
 */
afterEach(() => {
  setPiniaServices(null)
})

console.log('[Test Setup] Pinia services cleanup registered')

// ========== UI error detection (console + uncaught exceptions) ==========
setupErrorDetection()
