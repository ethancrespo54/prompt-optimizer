# Test Strategy Redesign - Research Findings

## Technology Selection Comparison and Recommendations (2025-2026)

### 1. Unit/Integration Test Framework: Vitest vs Jest

#### Performance Comparison

| Metric | Vitest | Jest |
|------|--------|------|
| **Execution speed** | 30-70% faster | Baseline |
| **Cold start** | 4x faster (esbuild) | Baseline (Babel/ts-jest) |
| **Memory usage** | 30% lower | Baseline |
| **Watch mode** | HMR, near-instant | Requires re-running |

**Real benchmarks**:
- Vitest is sometimes slightly slower on large projects, but its watch mode experience is far better than Jest's
- [Source: DEV Community benchmark](https://dev.to/thejaredwilcurt/vitest-vs-jest-benchmarks-on-a-5-year-old-real-work-spa-4mf1)

#### TypeScript Support

**Vitest**:
- ✅ Works out of the box, no configuration needed
- ✅ Reuses Vite's esbuild pipeline
- ✅ Native ESM support

**Jest**:
- ⚠️ Requires ts-jest or Babel transpilation
- ⚠️ ESM support is still experimental (Jest 30)
- ⚠️ Complex configuration

#### Vue 3 Ecosystem Fit

**Vitest**:
- ✅ Developed by the Vite team (Evan You created both Vite and Vue)
- ✅ A natural fit for Vue 3 + Vite projects
- ✅ Officially recommended by Nuxt

**Jest**:
- ⚠️ Requires extra configuration for the Vue transformer
- ⚠️ Does not support Vite's HMR

#### Ecosystem Maturity

**Jest**:
- ✅ 35 million monthly downloads
- ✅ Battle-tested since 2014
- ✅ 44k GitHub stars
- ✅ Dominant in the React ecosystem

**Vitest**:
- ⚠️ 3.8 million monthly downloads
- ⚠️ Relatively new (but growing quickly)
- ✅ Deeply integrated with the Vite ecosystem

#### Recommendation

**✅ Keep Vitest** (already in use)

**Reasons**:
1. **The project already uses Vite + Vue 3**: a natural fit, no migration needed
2. **Better TypeScript support**: works out of the box with no extra configuration
3. **Clear performance advantage**: watch mode experience is far better than Jest
4. **The ecosystem is mature enough**: Vitest 4.0 is stable and the community is active

[Source: Medium - Jest vs Vitest 2025](https://medium.com/@ruverd/jest-vs-vitest-which-test-runner-should-you-use-in-2025-5c85e4f2bda9)

---

### 2. E2E Test Framework: Playwright vs Cypress

#### Performance Comparison

| Metric | Playwright | Cypress |
|------|-----------|---------|
| **Parallel execution** | ✅ Built in, free | ⚠️ Paid or self-configured |
| **Execution speed** | 35-45% faster (parallel) | Baseline |
| **Cross-browser** | Chromium/Firefox/WebKit | Chromium/Firefox (limited) |
| **Mobile device emulation** | ✅ Native support | ⚠️ Limited |

#### Architectural Differences

**Playwright**:
- Runs outside the browser and controls it through CDP (Chrome DevTools Protocol)
- Supports true parallel execution
- Supports multiple tabs and multiple windows

**Cypress**:
- Runs inside the browser
- Parallelism requires extra configuration or a paid service
- Single-tab limitation

#### Use Case Comparison

**Playwright is suited for**:
- ✅ Cross-browser testing (Safari support)
- ✅ Large-scale parallel execution (CI/CD speedup)
- ✅ Complex interactions (multiple tabs, file upload/download)
- ✅ Stability first (fewer flaky tests)

**Cypress is suited for**:
- ✅ Quick onboarding and visual debugging
- ✅ Small teams, Chrome first
- ✅ Developer experience first

#### Recommendation

**✅ Keep Playwright** (already in use)

**Reasons**:
1. **Matches project needs**: stable, fast parallel execution is required
2. **Cross-browser support**: Safari testing may be needed in the future
3. **CI/CD friendly**: free parallelism with no extra cost
4. **2025 trend**: the Playwright community is growing rapidly

[Source: BugBug - Cypress vs Playwright 2025](https://bugbug.io/blog/test-automation-tools/cypress-vs-playwright/)
[Source: Medium - Cypress vs Playwright 2025](https://medium.com/@crissyjoshua/cypress-vs-playwright-who-owns-the-top-spot-in-2025-c248c021508f)

---

### 3. HTTP Mocking / VCR Pattern: Technology Selection

#### Option Comparison

| Option | Pros | Cons | Rating |
|------|------|------|--------|
| **MSW (Mock Service Worker)** | Network-layer interception, works in browser + Node, type-safe | Complex initial setup | ⭐⭐⭐⭐⭐ |
| **nock** | Simple and easy to use, HTTP mocking | Node.js only | ⭐⭐⭐ |
| **Polly.js** | Automatic record-replay | Not actively maintained (since 2021) | ⭐⭐ |
| **Custom VCR** | Full control | High development cost | ⭐⭐⭐⭐ |

#### Core Advantages of MSW

**Network-layer interception**:
```typescript
// MSW uses the Service Worker API to intercept real requests
// No need to modify production code
fetch('/api/optimize') // Will be intercepted by MSW
```

**Framework-agnostic**:
- Works whether you use fetch, Axios, or GraphQL
- The same set of handlers can be used for development, testing, and demos

**Type-safe**:
```typescript
// Path params, request body, and response body are all typed
http.post<OptimizeRequest, OptimizeResponse>('/api/optimize', ...)
```

**Best practices (2025-2026)**:

1. **Centralize handler management**
```typescript
// mocks/handlers.ts
export const handlers = [
  http.post('/api/optimize', () => {
    return HttpResponse.json({ optimizedPrompt: '...' })
  })
]
```

2. **Environment-specific integration**
```typescript
// Node.js (Vitest)
const server = setupServer(...handlers)
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Browser (Playwright)
const worker = setupWorker(...handlers)
await worker.start()
```

3. **Simulate real scenarios**
```typescript
// Simulate latency
http.get('/api/slow', () => delay(2000))

// Simulate errors
http.get('/api/error', () => HttpResponse.error())

// Simulate streaming responses (requires customization)
http.post('/api/stream', async () => {
  const stream = new ReadableStream(...)
  return new HttpResponse(stream)
})
```

[Source: MSW official documentation](https://mswjs.io/)
[Source: Callstack - A Comprehensive Guide to MSW](https://www.callstack.com/blog/guide-to-mock-service-worker-msw)

#### VCR Automated Record-Replay Architecture

**Recommended approach**: MSW + custom fixture management

```
┌────────────────────────────────────────────┐
│  Test code                                 │
│  test('optimize prompt', async () => {...})│
└────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────┐
│  VCR Middleware                            │
│  - Check whether the fixture exists        │
│  - Exists: MSW replays the fixture         │
│  - Missing: call the real API and record   │
└────────────────────────────────────────────┘
                    ↓
        ┌───────────┴──────────┐
        ↓                       ↓
┌───────────────┐       ┌──────────────┐
│  Mock mode    │       │  Real API    │
│  MSW handlers │       │  Record      │
│               │       │  response    │
└───────────────┘       └──────────────┘
```

#### Recommendation

**✅ MSW + custom fixtures**

**Reasons**:
1. **Network-layer interception**: closest to the real environment
2. **Cross-environment reuse**: works with both Vitest and Playwright
3. **Type safety**: TypeScript first
4. **Active ecosystem**: continuously updated with good community support

[Source: Leapcell - MSW Testing Practices](https://leapcell.io/blog/seamless-api-mocking-in-tests-with-mock-service-worker)

---

### 4. Visual Regression Testing: Technology Selection

#### Option Comparison

| Option | Type | Pros | Cons | Cost |
|------|------|------|------|------|
| **Playwright Visual Testing** | Built-in code | Free, easy integration, runs locally | Pixel-level sensitivity, baseline management is manual | Free |
| **Percy** | Cloud service | Smart comparison, cross-browser, UI review | Depends on an external service, paid | From $149/month |
| **Chromatic** | Cloud service (Storybook) | Storybook integration, component-driven | Limited to Storybook, paid | From $99/month |
| **Applitools Eyes** | Cloud service (AI) | AI-driven, intelligently ignores differences | Expensive, depends on an external service | From $799/month |

#### Playwright Visual Testing in Detail

**Basic usage**:
```typescript
test('visual regression test', async ({ page }) => {
  await page.goto('/')

  // Generate a baseline or compare against it
  await expect(page).toHaveScreenshot('homepage.png', {
    maxDiffPixels: 100,    // Allow a 100-pixel difference
    threshold: 0.2,        // 20% difference threshold
    animations: 'disabled' // Disable animations
  })
})
```

**Baseline management**:
```bash
# First run: generate the baseline
pnpm test:e2e --update-snapshots

# Subsequent runs: automatic comparison
pnpm test:e2e

# On failure: comparison images are generated
# tests/e2e/.screenshots/
# ├── homepage-actual.png
# ├── homepage-expected.png
# └── homepage-diff.png
```

**Pros**:
- ✅ Completely free
- ✅ Runs locally, no external service needed
- ✅ Generates comparison images on failure
- ✅ Pixel-level precision

**Cons**:
- ⚠️ Font rendering differences (across OSes)
- ⚠️ Animations/loading require waiting
- ⚠️ Baseline updates need manual review

**Best practices**:
1. **Use a unified Docker environment** (reduces cross-OS differences)
2. **Disable animations** (animations: 'disabled')
3. **Wait for a stable state** (waitForLoadState)
4. **Set a reasonable threshold** (threshold: 0.1-0.3)

#### Recommendation

**✅ Playwright Visual Testing**

**Reasons**:
1. **Cost**: completely free, no subscription fees
2. **Integration**: Playwright is already in use, no extra tools needed
3. **Control**: runs locally, baselines are kept under version control
4. **Project needs**: complex AI-based comparison is not needed at first

**Future considerations**:
- If the team grows and the baseline review burden becomes too heavy, consider Percy/Chromatic
- If cross-browser visual comparison is needed, consider a cloud service

---

### 5. Vue Component Testing: Vue Test Utils vs Testing Library

#### Option Comparison

| Feature | Vue Test Utils | Testing Library (Vue) |
|------|---------------|----------------------|
| **Philosophy** | Test implementation details | Test user behavior |
| **API style** | Wrapper with full access to component internals | Query the DOM and simulate user interactions |
| **Learning curve** | Vue-specific, requires knowing the component API | Framework-agnostic, close to the user's perspective |
| **Refactoring friendliness** | ⚠️ Tests must change when the implementation changes | ✅ Tests stay the same if the UI does not change |

**Vue Test Utils example**:
```typescript
const wrapper = mount(Component)
wrapper.vm.someMethod() // Access the component instance directly
expect(wrapper.vm.someData).toBe('value')
```

**Testing Library example**:
```typescript
render(Component)
const button = screen.getByRole('button', { name: /submit/i })
await userEvent.click(button)
expect(screen.getByText('Success')).toBeInTheDocument()
```

#### Recommendation

**✅ Vue Test Utils (primary) + Testing Library (supplementary)**

**Reasons**:
1. **The project already uses Vue Test Utils**: migration cost is high
2. **Implementation details need to be tested**: some tests do need access to component internals (such as Pinia Store integration)
3. **Introduce Testing Library gradually**: new tests should prefer the Testing Library style

**Guiding principles**:
- **Component unit tests**: Vue Test Utils (test component logic)
- **Integration tests**: Testing Library style (test user behavior)
- **E2E tests**: Playwright (real user perspective)

---

### 6. Tech Stack Summary and Recommendations

| Layer | Recommended Tool | Decision |
|------|---------|------|
| **Unit/integration tests** | Vitest 4.0 | ✅ Keep the existing choice |
| **E2E tests** | Playwright 1.56 | ✅ Keep the existing choice |
| **HTTP mocking** | MSW 2.0 + custom VCR | ✅ New implementation |
| **Visual regression** | Playwright Visual Testing | ✅ New implementation |
| **Vue component tests** | Vue Test Utils + Testing Library | ✅ Keep + supplement |
| **Pinia tests** | Existing pinia-test-helpers | ✅ Keep + enhance |

**Key decisions**:
1. **No large-scale migration needed**: the existing stack (Vitest + Playwright) is already the 2025 best practice
2. **Focus on enhancement**: VCR mode, visual regression, UI error detection
3. **Cost first**: choose free open-source options (Playwright Visual Testing) and avoid cloud service subscriptions

**Next actions**:
- [ ] Implement the MSW + VCR infrastructure
- [ ] Configure Playwright visual regression tests
- [ ] Implement the global error detection mechanism

## Current Project State

### Existing Test Foundation

**Test file statistics** (explored 2026-01-09):
- Total: 111 test files
- Core package: 71 (52 unit + 19 integration)
- UI package: 21 (18 unit + 2 integration + 1 E2E)
- E2E tests: 6 (root directory)
- Others: 12

**Test frameworks**:
- Vitest 4.0.15 - unit/integration tests
- Playwright 1.56.1 - E2E tests
- @vue/test-utils 2.4.5 - Vue component tests
- jsdom 26.0.0 - DOM simulation environment

**Test configuration files**:
- `vitest.config.ts` (UI/Web) - jsdom environment, 5-second timeout
- `vitest.config.js` (Core) - node environment, 30-second timeout
- `playwright.config.ts` - Chromium browser, port 15555
- `packages/ui/tests/setup.ts` - global test setup (i18n, Naive UI, Mock APIs)
- `packages/core/tests/setup.js` - Core global setup (localStorage Mock)

**Test helper utilities**:
- `packages/ui/tests/utils/pinia-test-helpers.ts` - Pinia test utilities
  - `createTestPinia()` - create a test Pinia instance
  - `createPreferenceServiceStub()` - PreferenceService stub
  - `withMockPiniaServices()` - test entry point with automatic cleanup

### Key Findings

#### 1. Areas with Insufficient Test Coverage

**UI package tests are weak**:
- Only 18 component unit tests (compared with 52 in Core)
- Missing Workspace component tests (BasicSystemWorkspace, BasicUserWorkspace, etc.)
- Missing tests for routing and overall Store flows

**Desktop/Extension have no tests at all**:
- Desktop package: 0 tests (Electron main process and IPC communication are not covered)
- Extension package: 0 tests (Chrome Extension functionality is not covered)

**Performance tests are missing**:
- The `/packages/core/tests/performance` directory exists but is empty

#### 2. Problems with Current Tests

**UI errors cannot be detected**:
- Console errors require manually checking DevTools
- Component rendering errors cannot be caught by unit tests
- State synchronization issues can only be found through manual interaction
- Visual rendering errors require manual inspection of the UI

**Tests are unreliable**:
- Missing real API integration tests (only a few `real-api.test.ts`)
- The mock service cannot simulate streaming responses
- No visual regression tests

**Low execution efficiency**:
- No coverage gate configured
- No pre-commit hook
- No test grouping (fast/full)

#### 3. Recent Refactor (Session Store as the Single Source of Truth)

**Refactor background** (commit 5ea1004):
- Implemented Pinia Session Stores as the single source of truth
- 6 Session Stores: BasicSystem, BasicUser, ProSystem, ProUser, ImageText2Image, ImageImage2Image
- Key mechanisms: state isolation, persistence protection, concurrency locks, sequential restore

**Key risk points** (need focused testing):
- Cross-mode state contamination
- Persistence protection mechanism (saving is forbidden before restore completes)
- Concurrency races (saveInFlight/isSwitching locks)
- Compare mode consistency (originalResult vs optimizedResult)
- Sub-mode isolation (System/User state is independent)

### Tech Stack Analysis

**Frontend framework**:
- Vue 3 + TypeScript + Composition API
- Pinia state management (standalone refs, not wrapped state)
- Naive UI component library

**Core services** (`packages/core/src/services/`):
- LLM service: OpenAI, Gemini, DeepSeek, custom models
- Prompt service: optimization, testing, evaluation
- Template service: CSP-safe processing, variable replacement
- Image service: IndexedDB storage, LRU cleanup
- Storage service: multiple adapters (localStorage, IndexedDB, file system)
- Preference service: user preferences, cross-platform sync

**Multi-platform support**:
- Web: built with Vite
- Desktop: Electron + IPC proxy
- Extension: Chrome Extension

## UI Error Detection Technology Research

### 1. Console Error Detection

#### Vitest Environment

**Option A: Global console spy**
```typescript
// tests/setup.ts
const originalError = console.error
const originalWarn = console.warn
const errors: string[] = []

global.console.error = (...args) => {
  errors.push(args.join(' '))
  originalError(...args)
}

afterEach(() => {
  if (errors.length > 0) {
    throw new Error(`Console errors detected: ${errors.join('\n')}`)
  }
  errors.length = 0
})
```

**Pros**:
- Automatically captures all console.error/warn
- Provides clear error messages when a test fails
- No need to modify existing tests

**Cons**:
- May produce false positives (legitimate warnings from some libraries)
- Needs an allowlist mechanism

**Option B: Vue warn handler**
```typescript
// tests/setup.ts
import { createApp } from 'vue'

const app = createApp({})
app.config.warnHandler = (msg, instance, trace) => {
  throw new Error(`Vue warning: ${msg}\n${trace}`)
}
```

**Pros**:
- Dedicated to capturing Vue warnings
- Provides component stack information

**Cons**:
- Limited to Vue warnings; cannot capture other errors

**Recommendation**: Combine Option A + Option B, with an allowlist to filter legitimate warnings

#### Playwright Environment

**Option: page.on('console') listener**
```typescript
// playwright.config.ts
test.beforeEach(async ({ page }) => {
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      throw new Error(`Console ${msg.type()}: ${msg.text()}`)
    }
  })

  page.on('pageerror', error => {
    throw new Error(`Uncaught exception: ${error.message}`)
  })
})
```

**Pros**:
- Captures real browser console errors
- Captures uncaught exceptions

**Cons**:
- Needs to be configured for each test

**Recommendation**: Enable it in the global Playwright configuration

### 2. Visual Rendering Detection

#### Option Comparison

| Option | Tool | Pros | Cons | Rating |
|------|------|------|------|--------|
| **Screenshot comparison** | Playwright Visual Testing | Built in, no extra service | Pixel-level comparison is sensitive | ⭐⭐⭐⭐ |
| **Cloud services** | Percy, Chromatic | Smart comparison, UI review | Paid, depends on an external service | ⭐⭐⭐ |
| **DOM structure verification** | Testing Library | Fast, stable | Cannot detect style issues | ⭐⭐⭐⭐⭐ |

**Recommended approach**: DOM structure verification + Playwright screenshot comparison

#### Playwright Visual Testing

```typescript
// tests/e2e/visual-regression.spec.ts
test('Basic workspace visual comparison', async ({ page }) => {
  await page.goto('/')
  await page.getByText(/Basic.*System/i).click()

  // Generate a baseline or compare against it
  await expect(page).toHaveScreenshot('basic-system-workspace.png', {
    maxDiffPixels: 100, // Allow a 100-pixel difference
    threshold: 0.2      // 20% difference threshold
  })
})
```

**Baseline management**:
- First run: `pnpm test:e2e --update-snapshots` generates the baseline
- Subsequent runs: automatic comparison; fails if the difference exceeds the threshold
- Baseline storage: `tests/e2e/.screenshots/`
- Kept under version control

**Pros**:
- Automated, no cloud service needed
- Pixel-level precise comparison
- Generates comparison images on failure

**Cons**:
- Font rendering differences (requires headless browser consistency)
- Animation/loading states require waiting
- Baseline updates need manual review

#### DOM Structure Verification

```typescript
// packages/ui/tests/unit/components/BasicSystemWorkspace.spec.ts
test('should render all required elements', () => {
  const wrapper = mount(BasicSystemWorkspace)

  // Verify key elements exist
  expect(wrapper.find('[data-testid="prompt-input"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="optimize-button"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="test-area"]').exists()).toBe(true)

  // Verify CSS classes
  expect(wrapper.find('.workspace-container').classes()).toContain('theme-light')

  // Verify visibility
  expect(wrapper.find('[data-testid="optimize-button"]').isVisible()).toBe(true)
})
```

**Pros**:
- Fast, stable
- No pixel-level sensitivity
- Semantic verification

**Cons**:
- Cannot detect style issues (color, fonts, layout details)

**Recommendation**: Use DOM verification for component tests and screenshot comparison for E2E tests

### 3. State Synchronization Detection

#### Option: Pinia Store Listening + UI Assertions

```typescript
// packages/ui/tests/integration/state-sync.spec.ts
test('Store updates should sync to the UI', async () => {
  const { pinia } = createTestPinia()
  const wrapper = mount(BasicSystemWorkspace, {
    global: { plugins: [pinia] }
  })

  const store = useBasicSystemSession(pinia)

  // Update the Store
  store.updatePrompt('New Prompt')

  await wrapper.vm.$nextTick()

  // Verify the UI is in sync
  const input = wrapper.find('[data-testid="prompt-input"]')
  expect(input.element.value).toBe('New Prompt')
})

test('UI updates should sync to the Store', async () => {
  const { pinia } = createTestPinia()
  const wrapper = mount(BasicSystemWorkspace, {
    global: { plugins: [pinia] }
  })

  const store = useBasicSystemSession(pinia)
  const input = wrapper.find('[data-testid="prompt-input"]')

  // Update the UI
  await input.setValue('User Input')

  // Verify the Store is in sync
  expect(store.prompt).toBe('User Input')
})
```

**Detecting reactivity failures**:
```typescript
test('computed should trigger correctly', async () => {
  const { pinia } = createTestPinia()
  const store = useBasicSystemSession(pinia)

  // Watch for computed changes
  let computedTriggered = false
  const stopWatch = watch(
    () => store.hasOptimizedResult,
    () => { computedTriggered = true }
  )

  // Trigger a dependency change
  store.updateOptimizedResult({
    optimizedPrompt: 'Result',
    reasoning: 'Reason',
    chainId: 'chain',
    versionId: 'ver'
  })

  await nextTick()
  expect(computedTriggered).toBe(true)
  stopWatch()
})
```

### 4. Interaction Behavior Detection

#### Option: User Event Simulation + Behavior Assertions

**Button click response**:
```typescript
test('the optimize button should trigger the optimization flow', async () => {
  const mockOptimize = vi.fn().mockResolvedValue({
    optimizedPrompt: 'Optimized',
    reasoning: 'Reason',
    chainId: 'chain',
    versionId: 'ver'
  })

  const { pinia, services } = createTestPinia({
    promptService: { optimizePrompt: mockOptimize }
  })

  const wrapper = mount(BasicSystemWorkspace, {
    global: { plugins: [pinia] }
  })

  // Set the input
  const store = useBasicSystemSession(pinia)
  store.updatePrompt('Test Prompt')

  // Click the button
  const button = wrapper.find('[data-testid="optimize-button"]')
  await button.trigger('click')

  // Verify the behavior
  expect(mockOptimize).toHaveBeenCalledWith(
    'Test Prompt',
    expect.any(Object)
  )

  await wrapper.vm.$nextTick()
  expect(store.optimizedPrompt).toBe('Optimized')
})
```

**Form submission flow**:
```typescript
test('form submission should validate and save', async () => {
  const { page } = await context.newPage()
  await page.goto('/')

  // Fill in the form
  await page.fill('[data-testid="title-input"]', 'Test Title')
  await page.fill('[data-testid="content-input"]', 'Test Content')

  // Submit
  const submitButton = page.getByRole('button', { name: /save/i })
  await submitButton.click()

  // Verify the success message
  await expect(page.locator('.n-message')).toContainText('Saved successfully')

  // Verify data persistence
  await page.reload()
  await expect(page.locator('[data-testid="title-input"]')).toHaveValue('Test Title')
})
```

**Modal behavior**:
```typescript
test('closing the modal should clean up state', async () => {
  const wrapper = mount(ImportExportDialog, {
    props: { show: true }
  })

  // Trigger close
  await wrapper.find('[data-testid="close-button"]').trigger('click')

  // Verify emit
  expect(wrapper.emitted('update:show')).toBeTruthy()
  expect(wrapper.emitted('update:show')[0]).toEqual([false])

  // Verify state cleanup
  const internalState = wrapper.vm.exportData
  expect(internalState).toBeNull()
})
```

## VCR Pattern Technology Research

### Record-Replay Library Comparison

| Library | Pros | Cons | Rating |
|-----|------|------|--------|
| **MSW (Mock Service Worker)** | Intercepts fetch/XHR, supports browser and Node | Handlers must be written manually | ⭐⭐⭐⭐⭐ |
| **nock** | HTTP mocking, simple and easy to use | Node.js only | ⭐⭐⭐ |
| **Polly.js** | Automatic record-replay, rich adapters | Not actively maintained (last updated 2021) | ⭐⭐ |
| **Custom VCR** | Full control, highly customizable | High development cost | ⭐⭐⭐⭐ |

**Recommended approach**: MSW + custom fixture management

### MSW + Custom VCR Implementation

#### Architecture Design

```
┌─────────────────────────────────────────────────────┐
│  Test code                                          │
│  test('optimize prompt', async () => { ... })       │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  VCR Middleware                                     │
│  - Check whether the fixture exists                 │
│  - Exists: replay the fixture (Mock)                │
│  - Missing: call the real API and record            │
└─────────────────────────────────────────────────────┘
                        ↓
         ┌──────────────┴──────────────┐
         ↓                              ↓
┌──────────────────┐          ┌──────────────────┐
│  Mock mode       │          │  Real API mode   │
│  MSW handlers    │          │  Real LLM        │
│  Read fixtures   │          │  service         │
│                  │          │  Record response │
└──────────────────┘          └──────────────────┘
```

#### Fixtures File Structure

```
packages/core/tests/fixtures/
├── llm/
│   ├── openai/
│   │   ├── chat-completion-simple.json
│   │   ├── chat-completion-streaming.json
│   │   └── error-rate-limit.json
│   ├── gemini/
│   │   └── generate-content.json
│   └── deepseek/
│       └── chat-completion.json
├── prompt/
│   ├── optimize-basic-system.json
│   ├── optimize-context-multi.json
│   └── test-prompt.json
└── image/
    ├── text2image-success.json
    └── image2image-success.json
```

**Fixture format**:
```json
{
  "request": {
    "provider": "openai",
    "model": "gpt-4",
    "messages": [
      { "role": "user", "content": "Help me write an email" }
    ],
    "stream": true
  },
  "response": {
    "type": "streaming",
    "chunks": [
      { "content": "Dear ", "timestamp": 0 },
      { "content": "Manager Zhang", "timestamp": 50 },
      { "content": ":", "timestamp": 100 }
    ],
    "finalResult": {
      "content": "Dear Manager Zhang: ...",
      "usage": { "prompt_tokens": 10, "completion_tokens": 50 }
    }
  },
  "metadata": {
    "recordedAt": "2026-01-09T10:30:00Z",
    "scenarioName": "optimize-basic-system",
    "duration": 1500
  }
}
```

#### VCR Utility Implementation

```typescript
// packages/core/tests/utils/vcr.ts
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

interface VCROptions {
  fixturePath: string
  mode: 'auto' | 'record' | 'replay' | 'off'
}

export class VCR {
  constructor(private options: VCROptions) {}

  async intercept<T>(
    key: string,
    realFn: () => Promise<T>
  ): Promise<T> {
    const fixturePath = this.getFixturePath(key)

    // Mode check
    if (this.options.mode === 'off') {
      return realFn()
    }

    if (this.options.mode === 'replay' ||
        (this.options.mode === 'auto' && existsSync(fixturePath))) {
      // Replay mode
      const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'))
      return this.simulateResponse(fixture)
    }

    if (this.options.mode === 'record' ||
        (this.options.mode === 'auto' && !existsSync(fixturePath))) {
      // Record mode
      const result = await realFn()
      const fixture = this.serializeResult(key, result)
      writeFileSync(fixturePath, JSON.stringify(fixture, null, 2))
      return result
    }
  }

  private simulateResponse<T>(fixture: any): Promise<T> {
    // Simulate latency
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(fixture.response.finalResult)
      }, fixture.metadata.duration || 100)
    })
  }

  private getFixturePath(key: string): string {
    return join(this.options.fixturePath, `${key}.json`)
  }
}
```

#### Streaming Response Mock

```typescript
// packages/core/tests/utils/stream-simulator.ts
export class StreamSimulator {
  constructor(private chunks: Array<{ content: string, timestamp: number }>) {}

  async *generate(): AsyncGenerator<string> {
    let lastTimestamp = 0

    for (const chunk of this.chunks) {
      // Simulate real latency
      const delay = chunk.timestamp - lastTimestamp
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      yield chunk.content
      lastTimestamp = chunk.timestamp
    }
  }
}

// Usage example
const simulator = new StreamSimulator(fixture.response.chunks)
for await (const chunk of simulator.generate()) {
  callback(chunk)
}
```

### Environment Variable Control

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    env: {
      // Use Mock by default (VCR replay)
      VCR_MODE: process.env.VCR_MODE || 'auto',

      // Optional: force the use of real APIs
      ENABLE_REAL_LLM: process.env.ENABLE_REAL_LLM || 'false'
    }
  }
})
```

**Test commands**:
```bash
# Default: auto mode (replay if a fixture exists, otherwise record)
pnpm test

# Force record (update all fixtures)
VCR_MODE=record pnpm test

# Force replay (use fixtures only; fail if missing)
VCR_MODE=replay pnpm test

# Disable VCR (always use real APIs)
VCR_MODE=off pnpm test
# or
ENABLE_REAL_LLM=true pnpm test
```

## Test Layering and Execution Time Optimization

### Goal

Pre-commit tests must take < 10 minutes, layered as follows:

| Layer | Execution time | Test type | Description |
|------|---------|---------|------|
| **Fast** | 1-2 minutes | Unit tests (pure logic) | No I/O, no Mock, pure computation |
| **Standard** | 3-4 minutes | Unit + integration (Mock) | VCR replay, Pinia tests |
| **Full** | 5-6 minutes | E2E (browser) | Playwright, visual regression |
| **Total** | **< 10 minutes** | Full pre-commit test run | Fast + Standard + Full |

### Parallelization Strategy

**Vitest parallelization**:
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    // Maximum concurrent workers (CPU cores - 1)
    maxWorkers: Math.max(1, os.cpus().length - 1),

    // Minimum concurrent workers
    minWorkers: 1,

    // Isolation mode for each worker
    pool: 'threads', // or 'forks'

    // Timeout configuration
    testTimeout: 5000,
    hookTimeout: 10000
  }
})
```

**Playwright parallelization**:
```typescript
// playwright.config.ts
export default defineConfig({
  // Concurrent workers
  workers: process.env.CI ? 1 : undefined, // Serial in CI, parallel locally

  // Sharding
  shard: process.env.SHARD ? {
    current: parseInt(process.env.SHARD_INDEX),
    total: parseInt(process.env.SHARD_TOTAL)
  } : undefined,

  // Retry on failure
  retries: process.env.CI ? 2 : 0
})
```

**CI sharded execution**:
```yaml
# .github/workflows/test.yml
jobs:
  e2e:
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - name: Run E2E tests (shard ${{ matrix.shard }}/4)
        run: pnpm test:e2e
        env:
          SHARD_INDEX: ${{ matrix.shard }}
          SHARD_TOTAL: 4
```

### Marking Slow Tests

```typescript
// packages/ui/tests/unit/slow.spec.ts
test.skipIf(process.env.SKIP_SLOW === 'true')(
  'large dataset performance test',
  async () => {
    // Time-consuming test
  },
  { timeout: 60000 }
)
```

**Fast mode**:
```bash
# Skip slow tests (quick verification before committing)
SKIP_SLOW=true pnpm test

# Full tests (CI or before release)
pnpm test
```

## Unresolved Issues

### 1. Visual Regression Test Baseline Management

**Problem**:
- Baseline screenshots may differ slightly across operating systems
- Font rendering is inconsistent across Windows/Mac/Linux

**To investigate**:
- A unified test environment in Docker containers
- Cloud baseline storage (Percy, Chromatic)
- Difference threshold tuning

### 2. Completeness of Streaming Response Recording

**Problem**:
- How can the timing of streaming responses be recorded accurately?
- How should the delay between chunks be simulated?

**To implement**:
- High-precision timestamp recording (ms level)
- Simulated network jitter

### 3. Electron Desktop Testing

**Problem**:
- How does Playwright test Electron apps?
- How should IPC communication be mocked?

**To investigate**:
- Electron support in `@playwright/test`
- Spectron (deprecated; an alternative needs to be found)

## Next Actions

1. **Complete the Phase 1 research**
   - [ ] Select the visual regression testing tool (Playwright Visual Testing)
   - [ ] Design the VCR system architecture (MSW + custom fixtures)
   - [ ] Design the test layering strategy (Fast/Standard/Full)

2. **Start the Phase 2 implementation**
   - [ ] Implement the VCR infrastructure
   - [ ] Record the first batch of fixtures (OpenAI, DeepSeek)

3. **Produce the architecture documentation**
   - [ ] Write `architecture.md`
   - [ ] Update the `task_plan.md` decision log
