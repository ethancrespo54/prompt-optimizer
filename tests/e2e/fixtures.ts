import { test as base, expect, type ConsoleMessage, type Page, type BrowserContext } from '@playwright/test'
import { setupVCRForTest } from './helpers/vcr'

const IGNORE_CONSOLE_PATTERNS: RegExp[] = [
  /favicon\.ico/i,
  /ResizeObserver loop limit exceeded/i,
  /ResizeObserver loop completed with undelivered notifications/i,
  // Vue Router warnings during route migration (pro/user -> pro/variable, pro/system -> pro/multi)
  /Vue Router warn.*No match found for location with path "\/(pro\/user|pro\/system)"/i,
  /Router.*Illegal subMode.*redirect/i
]

function shouldIgnoreConsoleMessage(message: string): boolean {
  return IGNORE_CONSOLE_PATTERNS.some((pattern) => pattern.test(message))
}

function formatConsoleMessage(msg: ConsoleMessage): string {
  const type = msg.type()
  const location = msg.location()
  const loc = location.url ? ` @ ${location.url}:${location.lineNumber}:${location.columnNumber}` : ''
  return `[console.${type}] ${msg.text()}${loc}`
}


/**
 * Custom test fixture that extends page functionality
 *
 * Storage isolation strategy:
 * 1. Generate a unique test database name for each test
 * 2. Clean up old test databases before each test
 * 3. Inject the database name via an init script
 * 4. Fully parallel tests are supported, with no cross-test state leakage
 */
export const test = base.extend<{ context: BrowserContext; page: Page }>({
  // Create an independent BrowserContext for each test
  context: async ({ browser }, use) => {
    // ✅ Create a new BrowserContext with all storage disabled (avoids cross-test state leakage)
    const context = await browser.newContext({
      // Disable localStorage and sessionStorage
      storageState: undefined, // do not load any storage state
      // Other context-level configuration can be added here
    })
    await use(context)
    await context.close()
  },

  // Create the page inside the independent context
  page: async ({ context }, use, testInfo) => {
    const page = await context.newPage()
    const problems: string[] = []

    // ✅ Step 1: generate a unique database name for this test
    // Use workerIndex + timestamp + random to ensure uniqueness
    const testDbName = `test-db-${testInfo.workerIndex}-${Date.now()}-${Math.random().toString(36).substring(7)}`

    // ✅ Step 2: inject the test configuration into the page (merged into a single addInitScript call)
    await page.addInitScript((dbName) => {
      // Clear localStorage and sessionStorage (avoids cross-test state leakage).
      // Note: when navigation fails and lands on a browser error page (e.g. chrome-error://), accessing storage may throw a SecurityError.
      // Handle this gracefully so the test infrastructure does not misreport "service not ready / connection interrupted" as a page script error.
      try {
        localStorage.clear()
      } catch {}
      try {
        sessionStorage.clear()
      } catch {}
      // Inject the test database name
      ;(window as any).__TEST_DB_NAME__ = dbName
    }, testDbName)

    const onConsole = (msg: ConsoleMessage) => {
      const type = msg.type()
      if (type !== 'error' && type !== 'warning') return

      const text = msg.text()
      if (shouldIgnoreConsoleMessage(text)) return
      problems.push(formatConsoleMessage(msg))
    }

    const onPageError = (error: Error) => {
      const message = error?.stack ? error.stack : String(error)
      if (shouldIgnoreConsoleMessage(message)) return
      problems.push(`[pageerror] ${message}`)
    }

    page.on('console', onConsole)
    page.on('pageerror', onPageError)

    // 🎬 Set up VCR (record/replay LLM API calls)
    // Extract the relative path from titlePath, stripping the tests/e2e/ prefix
    const fullPath = testInfo.titlePath[0] || 'unknown-test'
    const testName = fullPath.replace(/^tests\/e2e\//, '')
    const testCase = testInfo.title || 'unknown-case'
    await setupVCRForTest(page, testName, testCase)

    try {
      await use(page)
    } finally {
      page.off('console', onConsole)
      page.off('pageerror', onPageError)
      await page.close()
      // No need to explicitly clean up the current test database
      // Each test uses its own BrowserContext, and its storage (IndexedDB/localStorage, etc.) is released when the test ends
    }

    if (testInfo.status === 'skipped') return
    if (problems.length === 0) return

    await testInfo.attach('console-and-page-errors', {
      body: problems.join('\n\n'),
      contentType: 'text/plain'
    })

    throw new Error(
      `Browser console/page errors detected (${problems.length}). See attachment: console-and-page-errors\n\n` +
      problems.join('\n\n')
    )
  }
})

export { expect }
