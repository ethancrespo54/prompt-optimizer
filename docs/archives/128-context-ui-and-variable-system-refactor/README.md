# 128 - Context Mode UI Rework and Variable System Refactor

## 📋 Feature Overview

Archives the design, tasks, and implementation record of the "Context mode (User/System) UI rework + variable system refactor". The key goals of this module include:

- Move the sub-mode selector to the navigation bar to unify the mode hierarchy and the user's mental model
- Move the quick action bar to the test area, closer to the usage scenario, freeing up space on the left
- Simplify the variable system: remove "conversation variables", introduce temporary variables in the test area, and clarify the three-layer variable priority

## ⏱️ Timeline

- **Start date**: 2025-10-21
- **Completion date**: 2025-10-23
- **Status**: ✅ Completed (the documents are an archive of the design/implementation records at the time)

## 📁 Document List

- [x] `analysis.md` - UI design analysis report (including phase goals and problem breakdown)
- [x] `plan.md` - UI rework task document (execution checklist/milestones)
- [x] `design.md` - Variable system refactor design document (including implementation details and variance records)
- [x] `implementation-codemirror.md` - CodeMirror 6 variable highlighting/completion implementation record (VariableAwareInput)

## 🔗 Related Implementation References (Code)

- `packages/ui/src/components/app-layout/PromptOptimizerApp.vue` (main assembly and navigation bar mode management)
- `packages/ui/src/components/context-mode/ContextUserWorkspace.vue` / `packages/ui/src/components/context-mode/ContextSystemWorkspace.vue`
- `packages/ui/src/components/TestAreaPanel.vue` (test area variable input and test entry point)
- `packages/ui/src/composables/context/useContextManagement.ts` (context management)
- `packages/ui/src/composables/variable/useTemporaryVariables.ts` (temporary variables, if enabled)
