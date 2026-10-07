# Findings and Decisions

## Requirements Summary

- Scope for this iteration: `basic-user` only (to be extended to other sub-modes later).
- The test area input must be decoupled from the editor textarea.
- Source of prompt versions: the session's history chain (`v0..vn`).
  - `v0`: the original prompt (does not exist as a record in the history chain)
  - `v1..vn`: version numbers in the history chain
- Each test result panel selects independently:
  - Prompt version (`v0..vn` + `latest`)
  - Model (left and right may differ)
- Default comparison: `v0` vs `latest(vn)`.
- Compare tests run in parallel.
- Selecting a draft/unsaved prompt is not allowed.

## Code/Structure Findings

- The version chain model comes from core history:
  - `packages/core/src/services/history/types.ts` defines `PromptRecord` / `PromptRecordChain`.
  - History chain version numbers are `version = 1..n`; `v0` is represented separately by the original prompt.
- Current basic-user test entry point:
  - `packages/ui/src/components/basic-mode/BasicUserWorkspace.vue` → `<TestAreaPanel>`
  - Test execution is driven by `packages/ui/src/composables/workspaces/useBasicWorkspaceLogic.ts#handleTest`.
- UI container structure:
  - `TestAreaPanel` contains: `TestControlBar` + `TestResultSection`.
  - `TestResultSection` is responsible for the result card header + the evaluation entry point.
- `SelectWithConfig` injects `style: { minWidth: '160px' }` by default (see `packages/ui/src/components/SelectWithConfig.vue`).
  - When placed in the result card header, it noticeably squeezes the title area and easily overflows on narrow screens.

## Technical Decisions

| Decision | Rationale |
| --- | --- |
| Persist the per-panel version+model selection (`testPanels`) in `useBasicUserSession` | The session already persists compare/testContent and other state; this matches the "session-scoped" expectation. |
| Represent `version` as `0 \| number \| 'latest'` | Easy to persist and bind to a select; `latest` can follow newly added versions. |
| Resolve the selected value into prompt text through a deterministic resolver | Decouples the UI from the test logic, and falls back for missing/invalid versions. |
| Add header-extra slots to `TestResultSection`, passed through by `TestAreaPanel` | Components stay generic; each workspace injects only its own control area. |

## UI/Layout Decisions (This Iteration)

| Decision | Rationale |
| --- | --- |
| Allow the result card header/actions to wrap (flex-wrap) | Avoids title + selectors + evaluation entry overflowing on narrow screens. |
| Constrain selector widths: version fixed at `100px`; model overridden to `min-width: 120px; width: 160px` | Resolves the width pressure from `SelectWithConfig`'s default minWidth=160 while remaining usable. |
| Use `NFlex` for alignment and spacing inside header-extra | More controllable than `NSpace wrap=false`, and more stable when the header wraps. |

## Resources

- Core history types: `packages/core/src/services/history/types.ts`
- Basic test logic: `packages/ui/src/composables/workspaces/useBasicWorkspaceLogic.ts`
- Basic-user workspace: `packages/ui/src/components/basic-mode/BasicUserWorkspace.vue`
- Test area components: `packages/ui/src/components/TestAreaPanel.vue` / `packages/ui/src/components/TestResultSection.vue` / `packages/ui/src/components/TestControlBar.vue`
- Design document: `docs/architecture/test-area-version-model-selection.md`
