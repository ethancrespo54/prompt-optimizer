# Test Running Guide (Gates)

The goal of this project's tests is to **automatically catch UI console errors / uncaught exceptions**, and to use VCR so that LLM-related tests run offline and stably in CI.

## Common Commands

```bash
# Fast gate (for pre-commit)
pnpm test:gate

# Full gate (for manual local runs / CI, includes E2E)
pnpm test:gate:full

# Force replay (recommended for CI: missing fixtures / unintercepted requests fail)
pnpm test:replay

# Re-record fixtures (real API, incurs costs)
pnpm test:record
```

## VCR

- Usage guide: `docs/testing/vcr-usage-guide.md`
- Default fixtures directory: `packages/core/tests/fixtures/`

## UI Error Gates

- Vitest (UI package): `packages/ui/tests/utils/error-detection.ts`
- Playwright (E2E): `tests/e2e/fixtures.ts`
