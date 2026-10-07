# Task Plan: Test Area Version/Model Selection (basic-user first)

## Goal

In `/basic/user`, make the right-hand test area stop reading the editor textarea and instead choose its input from the current session's version chain (`v0..vn`), supporting:

- Independent prompt version selection for each result panel (`v0 / v1..vn / latest`)
- Independent test model selection for each result panel (left and right can differ)

Default comparison: `v0` vs `latest(vn)`; compare tests must run in parallel.

## Current Phase

Phase 5 (Verification and Delivery)

## Phases and Status

### Phase 1: Requirements and Current State Review (Completed)

- [x] Confirm requirements and constraints with the user (basic-user first, session-scoped, no draft option)
- [x] Identify the existing data flow and key files for version chains / test execution
- [x] Record key constraints in `findings.md`

### Phase 2: Solution Design (Completed)

- [x] Design the session persistence data model: `testPanels.{original,optimized}.{version,modelKey}`
- [x] Design the version resolution rules: `v0` / fixed `vN` / `latest` following
- [x] Design the UI integration: inject selectors into the result card header (slot)
- [x] Write the design document: `docs/architecture/test-area-version-model-selection.md`

### Phase 3: Implementation (basic-user) (Completed)

- [x] Session store: add `testPanels` and migrate old data (inherit `selectedTestModelKey`)
- [x] Component extension: add header-extra slots to `TestResultSection`; pass through in `TestAreaPanel`
- [x] `BasicUserWorkspace`: add per-panel version+model selectors; tests use the resolved prompt; compare runs in parallel
- [x] Evaluation: evaluate using the selected prompt/results (original/optimized/compare)

### Phase 4: UI/Layout Optimization (Completed)

- [x] Resolve header overflow: allow header/actions to wrap; constrain version/model selector widths

### Phase 5: Verification and Delivery (In progress)

- [x] `pnpm -F @prompt-optimizer/ui lint`
- [x] `pnpm -F @prompt-optimizer/ui typecheck`
- [x] `pnpm -F @prompt-optimizer/ui test`
- [ ] (Optional) Add e2e: cover the new selectors and parallel compare behavior in basic-user
- [ ] Confirm with the user whether to commit the code changes and docs (`docs/workspace` + `docs/architecture`)

## Key Decisions (Summary)

- Persist `testPanels` in the session store so selections remain stable across refreshes/restarts.
- Persist `version` as `0 | number | 'latest'`, which is easy to bind and supports `latest` following.
- Place the selectors in each result card header so A/B attribution is more intuitive; the header wraps responsively to avoid overflow.
