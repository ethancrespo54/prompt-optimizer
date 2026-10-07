# VCR Usage Guide

VCR (Video Cassette Recorder) is used to **record** and **replay** LLM API calls in automated tests, so tests run stably in offline/CI environments.

## Table of Contents

- [Quick Start](#quick-start)
- [Modes and Environment Variables](#modes-and-environment-variables)
- [Fixtures Directory Structure](#fixtures-directory-structure)
- [Writing Tests](#writing-tests)
- [Troubleshooting](#troubleshooting)

## Quick Start

```bash
# Default: auto mode (replay if a fixture exists; if a fixture is missing and the real API is not enabled, it fails or degrades, depending on the test/interception layer)
pnpm test

# Force replay (recommended for CI): a missing fixture or unintercepted request fails immediately
pnpm test:replay

# Re-record (real API): incurs costs, requires an API key
pnpm test:record

# Disable VCR (real API): incurs costs, requires an API key
pnpm test:real
```

## Modes and Environment Variables

VCR behavior is controlled by the following environment variables:

- `VCR_MODE`: `auto` | `record` | `replay` | `off`
- `ENABLE_REAL_LLM=true`: Allow the real API (used for `record`/`off`)
- `RUN_REAL_API=1`: Compatible with the existing switch in the core package (equivalent to `ENABLE_REAL_LLM=true`)

The project already provides scripts (root `package.json`):

- `pnpm test:record` is equivalent to `VCR_MODE=record ENABLE_REAL_LLM=true pnpm test`
- `pnpm test:replay` is equivalent to `VCR_MODE=replay pnpm test`
- `pnpm test:real` is equivalent to `VCR_MODE=off ENABLE_REAL_LLM=true pnpm test`

## Fixtures Directory Structure

The default fixtures directory is located at:

- `packages/core/tests/fixtures/`

Organized by provider/scenario name:

- `packages/core/tests/fixtures/llm/<provider>/<scenario>.json`

Example:

- `packages/core/tests/fixtures/llm/deepseek/optimize-simple-prompt.json`

## Writing Tests

In core package tests, prefer wrapping real calls with `withVCR()` (recording/replay is decided by VCR):

```ts
import { withVCR } from '../utils/vcr'

const response = await withVCR(
  'optimize-simple-prompt',
  { provider: 'deepseek', model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }], stream: true },
  async () => {
    // Put the real API call here (record/off modes actually send requests)
    return await llmService.optimizePromptStream(...)
  }
)
```

Core principles:

- Daily development/CI: use `replay` to ensure tests are repeatable offline
- When fixtures need updating: use `record` and explicitly enable the real API (`ENABLE_REAL_LLM=true`)
- Fixtures must be under version control (to avoid instability caused by missing fixtures in CI)

## Troubleshooting

1) `Fixture not found`

- Means the run is on a replay path but the fixture is missing.
- Fix: run `pnpm test:record` to generate the fixture, and commit `packages/core/tests/fixtures/`.

2) `Real LLM is disabled. Cannot record fixture.`

- Means recording is in progress but the real API is not enabled.
- Fix: run `pnpm test:record` (it sets `ENABLE_REAL_LLM=true` automatically), and make sure the corresponding API key is configured in `.env.local`.

3) An "unintercepted request" error appears during replay

- `pnpm test:replay` runs in a stricter way; any request not covered by fixtures/MSW should be treated as a failure.
- Fix: add the corresponding fixture or add interception/handlers; avoid tests silently accessing the network.
