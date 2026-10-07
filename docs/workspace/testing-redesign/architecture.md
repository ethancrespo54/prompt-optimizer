# Test Strategy Redesign - Architecture Overview

## Goal

Turn "UI errors that can only be found by manually watching the console" into test failures that can be **intercepted automatically, reproduced, and used as gates**.

Constraints:

- Gate execution time < 10 minutes
- Runs offline by default (CI does not depend on real API keys)
- Real LLM APIs are accessed only through explicit commands (to avoid unexpected costs)

## Test Layers

1) **core unit/integration (Vitest)**

- Coverage: VCR, LLM mocks, stream handling, and other logic-layer capabilities that can be purely functional or mocked
- Goal: fast, stable, and enforceable replay in CI (`VCR_MODE=replay`)

2) **ui unit/integration (Vitest + Vue Test Utils)**

- Coverage: composables, data flow between stores and the UI, key interactions
- Key gate: any `console.error/warn`, `unhandledrejection`, or `window error` should fail the test

3) **Browser E2E (Playwright)**

- Coverage: startup, routing, and key dialog/operation flows in a real browser
- Key gate: any `pageerror` or `console error/warn` should fail the test
- Run strategy: the gate runs only a small set (regression/smoke); full E2E can run in CI/nightly

## UI Error Interception Gates

### Vitest (ui)

- File: `packages/ui/tests/utils/error-detection.ts`
- Enabled in `packages/ui/tests/setup.ts`:
  - Wrap `console.error` / `console.warn`: fail by default (ignore patterns supported)
  - Listen to `window.onerror` / `unhandledrejection`: fail by default

### Playwright (E2E)

- File: `tests/e2e/fixtures.ts`
- Export `{ test, expect }` uniformly from `./fixtures`:
  - Listen to `page.on('pageerror')`
  - Listen to error/warn from `page.on('console')`
  - Fail by default (ignore patterns supported)

## VCR (LLM Record/Replay)

### Goal

Make tests that "depend on external LLM services" **strictly offline** (replay) in CI, while allowing fixtures to be re-recorded (record) when needed.

### Mechanism

- `packages/core/tests/utils/vcr.ts`: VCR modes and fixture reading/writing
  - `VCR_MODE=record|replay|auto|off`
  - `ENABLE_REAL_LLM=true` / `RUN_REAL_API=1` control whether real APIs are allowed
- `packages/core/tests/utils/llm-mock-service.ts`: MSW handlers (Node-side interception)
- `packages/core/tests/setup.js`: decides whether to enable MSW in core tests based on environment variables

### Recommended Strategy

- CI: `pnpm test:replay` (strict, no network access)
- Everyday local use: `pnpm test:replay` or `pnpm test`
- To update fixtures: `pnpm test:record` (explicitly enables real APIs)

## Gates (Phase 5)

The goals of the gate scripts are:

- Fast enough (<10 minutes)
- Strong enough (able to catch UI console errors, uncaught exceptions, and key regressions)

Recommended split:

- `pnpm test:gate`: the fast gate run on pre-commit
- `pnpm test:gate:full`: run in CI or manually locally (includes heavier cases such as E2E/visual regression)
