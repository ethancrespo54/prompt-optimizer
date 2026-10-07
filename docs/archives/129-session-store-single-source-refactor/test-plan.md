# Session Store Persistence Verification Plan

## Fix Summary

Codex has implemented the architecture of "Session Store as the single source of truth for model selection":

- Model selection persistence uses the Session Store as the single source of truth
- PromptOptimizerApp reads and writes the currently active Session Store directly
- Removed the global sync bridge of BasicWorkspaceContainer
- The old global keys for model selection have been cleaned up (migration logic no longer exists)

## Test Goal

Verify whether the P0-level bug reported by users has been fixed:
- **Symptom**: In Basic mode, the optimization model and test model were both changed to deepseek, but after refreshing the page the model selection went back to siliconflow and openai
- **Expected**: After a refresh, the model selection stays as deepseek

## Test Steps

### 1. Basic Persistence Test

1. Visit http://localhost:18181
2. Enter Basic/System mode (/basic/system)
3. **Current state**: The optimization model on the left shows `siliconflow`, and the test model on the right shows `openai`
4. **Action**: Change both the left and right models to `deepseek`
5. **Verify**: Refresh the page (F5) and confirm both model dropdowns still show `deepseek` ✅

### 2. Mode Isolation Test

Verify whether the model selection of different modes is independent:

1. In Basic/System mode, select `deepseek` as the optimization model
2. Switch to Basic/User mode and select `gemini` as the optimization model
3. Switch to Pro mode and select `openai` as the optimization model
4. **Verify**:
   - Back in Basic/System, the optimization model should be `deepseek` ✅
   - Back in Basic/User, the optimization model should be `gemini` ✅
   - Back in Pro, the optimization model should be `openai` ✅

### 3. Migration Logic Test

Verify Session Store restoration:

1. **Existing user scenario**:
   - Open the app
   - **Verify**: The model selection in the Session Store should be restored correctly ✅

### 4. Cross-browser Test

If using the Electron desktop app:
1. Close the app
2. Reopen it
3. **Verify**: The model selection should be restored correctly ✅

## Test Record

### Tester
- Date: 2025-01-07
- Tester:

### Test Results

| Test item | Expected result | Actual result | Status |
|--------|---------|---------|------|
| Basic persistence test | deepseek retained | | ⏳ |
| Mode isolation test | Each mode independent | | ⏳ |
| Migration logic test | Restored correctly | | ⏳ |
| Cross-browser test | Electron works | | ⏳ |

### Notes

## Related Files

- `packages/ui/src/composables/model/useModelManager.ts` - Model manager (no longer responsible for model selection persistence)
- `packages/ui/src/stores/session/useBasicSystemSession.ts` - Basic/System Session Store
- `packages/ui/src/stores/session/useBasicUserSession.ts` - Basic/User Session Store
- `packages/ui/src/stores/session/useProMultiMessageSession.ts` - Pro Session Store
- `packages/ui/src/components/workspaces/BasicWorkspaceContainer.vue` - Basic container (sync removed)
- `packages/ui/src/components/app-layout/PromptOptimizerApp.vue` - Main app (reads and writes the Session directly)

## Next Steps

If the tests pass:
1. Confirm the Electron side must keep using PreferenceService (rather than localStorage)
2. Gradually extend the migration logic to cover other configuration items (theme, language, etc.)
3. Complete automated regression cases (mode isolation, rapid switching, restore after refresh)
