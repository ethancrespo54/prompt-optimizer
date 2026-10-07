# Phase 4 Supplementary Test Case Plan

## Current Status

**Completed** (2026-01-09):
- ✅ VCR infrastructure (record/replay)
- ✅ UI error detection gate (Vitest + Playwright)
- ✅ Basic smoke tests (6 integration tests + 3 Store unit tests + 1 E2E smoke test)
- ✅ Gate verification passed (257 tests, execution time < 1 minute)

**To be added**:
- ⏳ Complete workflow tests (end-to-end scenarios)
- ⏳ LLM service integration tests (multi-provider, streaming responses)
- ⏳ Session Store integration tests (mode switching, concurrency protection)
- ⏳ Image generation + history/favorites tests

---

## Priority Analysis

### 🔴 P0 - High Priority (core features, must be added)

#### 1. LLM Service Integration Tests
**Importance**: ⭐⭐⭐⭐⭐
- **Reason**: The LLM is a core dependency and directly affects all optimization and testing features
- **Risks**: Multi-provider switching, streaming response anomalies, retry failures
- **Existing foundation**: The VCR system is done, so fixtures can be recorded quickly

**Test cases**:
```typescript
// packages/core/tests/integration/llm-service.spec.ts
describe('LLM Service Integration', () => {
  describe('Multi-provider support', () => {
    test('OpenAI provider works with VCR', async () => {})
    test('Gemini provider works with VCR', async () => {})
    test('DeepSeek provider works with VCR', async () => {})
    test('Custom provider works with VCR', async () => {})
  })

  describe('Streaming response', () => {
    test('Stream chunks are correctly parsed', async () => {})
    test('Stream errors are handled gracefully', async () => {})
    test('Stream abort works correctly', async () => {})
  })

  describe('Error handling', () => {
    test('Rate limit errors trigger retry', async () => {})
    test('Network errors are surfaced to UI', async () => {})
    test('Timeout errors are handled', async () => {})
  })

  describe('Model switching', () => {
    test('Switching between models preserves state', async () => {})
    test('Model parameters are correctly applied', async () => {})
  })
})
```

**Estimated time**: 2-3 days

---

#### 2. Basic-System/User Complete Workflow Tests
**Importance**: ⭐⭐⭐⭐⭐
- **Reason**: Basic mode is the most commonly used feature and needs end-to-end verification
- **Risks**: Lost optimization results, out-of-sync test results, iteration logic errors
- **Existing foundation**: Smoke tests have passed and need to be extended into complete scenarios

**Test cases**:
```typescript
// packages/ui/tests/integration/basic-complete-workflow.spec.ts
describe('Basic-System Complete Workflow', () => {
  test('End-to-end: optimize → test → iterate', async () => {
    // 1. Enter a prompt
    // 2. Click optimize and wait for the LLM response
    // 3. Verify the optimization result is displayed
    // 4. Test the original and optimized prompts
    // 5. Verify the test result comparison
    // 6. Iterate on the optimization
    // 7. Verify the iteration history records
  })

  test('State persistence after page reload', async () => {})
  test('Error recovery when LLM fails', async () => {})
})

describe('Basic-User Complete Workflow', () => {
  test('End-to-end: input → optimize → test with variables', async () => {})
  test('Variable replacement works correctly', async () => {})
})
```

**Estimated time**: 2-3 days

---

### 🟡 P1 - Medium Priority (enhance test coverage)

#### 3. Session Store Integration Tests
**Importance**: ⭐⭐⭐⭐
- **Reason**: The Store is the core of state management and is error-prone during mode switching
- **Risks**: Cross-mode state contamination, loss of persisted data
- **Existing foundation**: 3 Store unit tests are done

**Test cases**:
```typescript
// packages/ui/tests/integration/session-store-switching.spec.ts
describe('Session Store Mode Switching', () => {
  test('Switch from Basic to Context preserves common state', async () => {})
  test('Switch to Image mode isolates image-specific state', async () => {})
  test('Rapid mode switching does not cause state corruption', async () => {})
})

// packages/ui/tests/integration/session-store-persistence.spec.ts
describe('Session Store Persistence', () => {
  test('State survives page reload', async () => {})
  test('Migration from old storage format works', async () => {})
  test('Concurrent tabs handle storage conflicts', async () => {})
})
```

**Estimated time**: 1-2 days

---

#### 4. Context Mode Complete Workflow
**Importance**: ⭐⭐⭐⭐
- **Reason**: Context mode involves multi-turn conversation and variable management, so its complexity is high
- **Risks**: Variable replacement errors, lost conversation history, chain mapping errors
- **Existing foundation**: 4 smoke tests have passed

**Test cases**:
```typescript
// packages/ui/tests/integration/context-complete-workflow.spec.ts
describe('Context-System Multi-turn Conversation', () => {
  test('End-to-end: add messages → optimize → test → iterate', async () => {})
  test('V0 comparison works correctly', async () => {})
  test('Variable merging from all messages works', async () => {})
})

describe('Context-User Variable Management', () => {
  test('Custom variables CRUD operations', async () => {})
  test('Missing variable detection and auto-creation', async () => {})
  test('Variable preview updates in real-time', async () => {})
})
```

**Estimated time**: 2-3 days

---

### 🟢 P2 - Low Priority (optional enhancements)

#### 5. Image Generation + History/Favorites
**Importance**: ⭐⭐⭐
- **Reason**: The image features are relatively independent, and the existing smoke tests already cover the core logic
- **Risks**: ImageStorage large-file handling, IndexedDB limits
- **Existing foundation**: Image generation logic smoke tests are done

**Test cases**:
```typescript
// packages/core/tests/unit/services/image-storage.spec.ts
describe('ImageStorageService', () => {
  test('Store and retrieve base64 images', async () => {})
  test('Handle IndexedDB quota exceeded', async () => {})
  test('Cleanup old images correctly', async () => {})
})

// packages/ui/tests/integration/image-history-favorites.spec.ts
describe('Image History & Favorites', () => {
  test('History records are saved and displayed', async () => {})
  test('Favorite management (add/remove/filter)', async () => {})
  test('Category and tag filtering works', async () => {})
})
```

**Estimated time**: 2-3 days

---

## Supplementation Strategy

### 🎯 Incremental Supplementation (Recommended)

**Week 1** (high priority):
- Day 1-3: LLM service integration tests (P0)
- Day 4-6: Basic complete workflow tests (P0)

**Week 2** (medium priority):
- Day 7-8: Session Store integration tests (P1)
- Day 9-11: Context complete workflow tests (P1)

**Week 3+** (optional):
- Day 12-14: Image generation + history/favorites tests (P2)
- Afterwards: continuous optimization and enhancement

### ⚡ Quick Supplementation (Minimum Viable)

Only add the P0 high-priority tests:
- LLM service integration tests (2-3 days)
- Basic complete workflow tests (2-3 days)

**Reasons**:
- The current 257 tests already cover the core smoke scenarios
- After the P0 tests are added, core feature test coverage can reach 80%+
- P1/P2 tests can be added incrementally as needed

---

## Execution Recommendations

### ✅ Immediate Actions

1. **Commit the current progress first**
   ```bash
   git commit -m "test: establish test infrastructure (VCR + error gate + smoke tests)"
   ```

2. **Create the Phase 4 supplementary branch**
   ```bash
   git checkout -b feat/phase4-test-coverage
   ```

3. **Implement tests one by one by priority**
   - Commit immediately after finishing each test suite
   - Keep the gate tests passing at all times

### 🚫 Avoid Over-Engineering

- ❌ Do not chase 100% coverage
- ❌ Do not write too many tests for edge scenarios
- ✅ Focus on P0 core features and high-risk scenarios
- ✅ Use VCR to reduce the cost of real API calls

---

## Success Criteria

**Minimum viable criteria** (MVP):
- ✅ LLM service integration tests complete (multi-provider + streaming responses)
- ✅ Basic complete workflow tests complete (optimize + test + iterate)
- ✅ All tests pass the gate
- ✅ No flaky tests

**Ideal criteria** (Ideal):
- ✅ MVP criteria
- ✅ Session Store integration tests complete
- ✅ Context complete workflow tests complete
- ✅ Code coverage > 75%

---

## Next Actions

1. ✅ **Done**: Commit all test infrastructure files
2. ✅ **Done**: Verify the gate tests pass
3. ⏳ **In progress**: Create the Phase 4 supplementary plan (this document)
4. 🔜 **To do**: Implement the LLM service integration tests (P0)
5. 🔜 **To do**: Implement the Basic complete workflow tests (P0)

---

**Last updated**: 2026-01-09
**Status**: Supplementary plan complete, awaiting user confirmation of priorities
