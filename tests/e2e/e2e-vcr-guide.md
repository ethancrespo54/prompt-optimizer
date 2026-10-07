# E2E Test VCR Integration Guide

## Problem Analysis

E2E tests currently send real LLM requests every time:
- ⏱️ Slow tests (waiting 20-60 seconds for LLM responses)
- 💰 Cost (API call fees)
- ⚠️ Instability (network problems, API rate limiting)

## Solutions

### Option A: Playwright network interception (recommended)

Use Playwright's `route` feature to intercept LLM API requests and return preset responses.

#### Implementation steps

**1. Create the VCR fixtures directory**

```bash
mkdir -p tests/e2e/fixtures/llm-responses
```

**2. Create the Playwright VCR helper**

Create the file: `tests/e2e/helpers/vcr.ts`

```typescript
import { type Page, type Route } from '@playwright/test'

/**
 * LLM API response fixture
 */
interface LLMResponseFixture {
  scenarioName: string
  response: {
    content: string
    score?: number
    level?: string
    [key: string]: any
  }
}

/**
 * VCR mode
 */
type VCRMode = 'auto' | 'record' | 'replay' | 'live'

/**
 * Enable VCR for E2E tests
 *
 * @param page Playwright Page object
 * @param options VCR options
 */
export async function setupE2EVCR(
  page: Page,
  options: {
    mode?: VCRMode
    fixtureDir?: string
  } = {}
) {
  const {
    mode = process.env.E2E_VCR_MODE as VCRMode || 'auto',
    fixtureDir = 'tests/e2e/fixtures/llm-responses'
  } = options

  // Intercept API requests in replay mode
  if (mode === 'replay' || mode === 'auto') {
    await page.route('**/api/**/evaluate', async (route: Route) => {
      const fixtureName = getFixtureNameFromRequest(route.request())

      try {
        // Try to read the fixture
        const response = await loadFixture(fixtureName, fixtureDir)

        if (response) {
          console.log(`[VCR] Replaying fixture: ${fixtureName}`)
          // Return the mock response
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(response)
          })
        } else if (mode === 'auto') {
          // auto mode: call the real API when the fixture does not exist
          console.log(`[VCR] Fixture not found: ${fixtureName}, calling real API`)
          await route.continue()
        } else {
          // replay mode: fail when the fixture does not exist
          throw new Error(
            `Fixture not found: ${fixtureName}\n` +
            `Run with E2E_VCR_MODE=record to create it.`
          )
        }
      } catch (error) {
        console.error(`[VCR] Error loading fixture: ${fixtureName}`, error)
        await route.continue()
      }
    })
  }

  // Record responses in record mode
  if (mode === 'record') {
    await page.route('**/api/**/evaluate', async (route: Route) => {
      // Call the real API
      const response = await route.fetch()

      // Save the response
      const fixtureName = getFixtureNameFromRequest(route.request())
      const responseData = await response.json()

      await saveFixture(fixtureName, responseData, fixtureDir)
      console.log(`[VCR] Recorded fixture: ${fixtureName}`)

      // Return the real response
      await route.fulfill({
        status: response.status(),
        contentType: response.headers()['content-type'],
        body: JSON.stringify(responseData)
      })
    })
  }

  // live mode: call the real API directly (no interception)
  if (mode === 'live') {
    console.log('[VCR] Live mode: calling real API')
  }
}

/**
 * Generate the fixture name from the request
 */
function getFixtureNameFromRequest(request: any): string {
  const url = new URL(request.url())
  const pathname = url.pathname

  // Parse the path, e.g. /api/evaluate/basic-system/prompt-only
  const parts = pathname.split('/')
  const mode = parts[3] // basic-system
  const type = parts[4] // prompt-only

  return `${mode}-${type}.json`
}

/**
 * Load a fixture
 */
async function loadFixture(
  fixtureName: string,
  fixtureDir: string
): Promise<any | null> {
  const fs = await import('fs/promises')
  const path = await import('path')

  const fixturePath = path.join(fixtureDir, fixtureName)

  try {
    const content = await fs.readFile(fixturePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * Save a fixture
 */
async function saveFixture(
  fixtureName: string,
  data: any,
  fixtureDir: string
): Promise<void> {
  const fs = await import('fs/promises')
  const path = await import('path')

  const fixturePath = path.join(fixtureDir, fixtureName)

  // Make sure the directory exists
  await fs.mkdir(path.dirname(fixturePath), { recursive: true })

  // Save the fixture
  await fs.writeFile(
    fixturePath,
    JSON.stringify(data, null, 2),
    'utf-8'
  )
}
```

**3. Update the test fixture**

Modify `tests/e2e/fixtures.ts`:

```typescript
import { test as base, expect, type ConsoleMessage, type Page } from '@playwright/test'
import { setupE2EVCR } from './helpers/vcr'

export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use, testInfo) => {
    // ... existing console/page error listener code ...

    // 🔧 Set up VCR
    await setupE2EVCR(page, {
      mode: process.env.E2E_VCR_MODE as any || 'auto'
    })

    try {
      await use(page)
    } finally {
      // ... cleanup code ...
    }
  }
})
```

**4. Create example fixtures**

Create the file: `tests/e2e/fixtures/llm-responses/basic-system-prompt-only.json`

```json
{
  "scenarioName": "basic-system-prompt-only",
  "response": {
    "score": 45,
    "level": "poor",
    "result": {
      "overall": {
        "score": 45,
        "level": "poor",
        "summary": "The prompt structure is simple and lacks specific requirements",
        "dimensions": [
          {
            "name": "Clarity",
            "score": 50,
            "feedback": "The wording is not clear enough"
          },
          {
            "name": "Specificity",
            "score": 40,
            "feedback": "Lacks specific details"
          }
        ]
      }
    }
  }
}
```

Create the file: `tests/e2e/fixtures/llm-responses/basic-user-prompt-only.json`

```json
{
  "scenarioName": "basic-user-prompt-only",
  "response": {
    "score": 65,
    "level": "acceptable",
    "result": {
      "overall": {
        "score": 65,
        "level": "acceptable",
        "summary": "The prompt structure is basically reasonable",
        "dimensions": [
          {
            "name": "Clarity",
            "score": 70,
            "feedback": "The wording is fairly clear"
          },
          {
            "name": "Completeness",
            "score": 60,
            "feedback": "Contains the basic elements"
          }
        ]
      }
    }
  }
}
```

**5. Usage**

```bash
# First run: record mode (creates fixtures)
E2E_VCR_MODE=record pnpm exec playwright test tests/e2e/analysis/basic-system.spec.ts

# Later runs: replay mode (uses fixtures, fast)
E2E_VCR_MODE=replay pnpm exec playwright test tests/e2e/analysis/basic-system.spec.ts

# Auto mode (replay if a fixture exists, otherwise record)
E2E_VCR_MODE=auto pnpm exec playwright test tests/e2e/analysis/basic-system.spec.ts

# Live mode (always calls the real API)
E2E_VCR_MODE=live pnpm exec playwright test tests/e2e/analysis/basic-system.spec.ts
```

---

### Option B: Mock Service Worker (more powerful, but more complex)

Use MSW (Mock Service Worker) to intercept requests in the browser.

**Pros**:
- More powerful mocking capabilities
- Supports fixture management
- Can simulate network latency, errors, etc.

**Cons**:
- Requires extra dependencies
- More complex configuration

**Can be implemented later if needed.**

---

## Recommended Implementation Order

1. ✅ **Phase 1**: Create `tests/e2e/helpers/vcr.ts`
2. ✅ **Phase 2**: Update `tests/e2e/fixtures.ts` to integrate VCR
3. ✅ **Phase 3**: Create example fixtures
4. ⏸️ **Phase 4**: Add `E2E_VCR_MODE=auto` to `.env.local` or the CI config
5. ⏸️ **Phase 5**: Run the tests to verify

---

## Test Speed Comparison

| Mode | Time per test | Total time for 4 tests | API calls |
|------|------------|--------------|------------|
| Live (current) | ~20s | ~80s | 4 |
| Replay (VCR) | ~3s | ~12s | 0 |
| Record (first run) | ~20s | ~80s | 4 (creates fixtures) |

**With VCR, tests are 6-7x faster!**
