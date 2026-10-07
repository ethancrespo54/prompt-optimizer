# 129-session-store-single-source-refactor - Session Store Single Source of Truth Architecture Refactor

## Overview
Completed the Session Store architecture refactor, implementing the Single Source of Truth principle, resolving cross-mode state pollution, adding an image storage service, and optimizing code splitting.

## Status
✅ Completed (the migration guide is a long-term plan)

## Key Results

### Core Architecture Improvements
- ✅ Added ImageStorageService (standalone IndexedDB, with LRU cache support)
- ✅ Hardened Session Store persistence protection to prevent data overwrites
- ✅ Serialized the restore and save flows to avoid memory peaks
- ✅ Split monolithic components into fine-grained workspaces

### Code Optimization
- ✅ Removed unnecessary image migration logic
- ✅ Cleaned up deprecated storage keys and added backward-compatibility comments
- ✅ Removed the static exports of Basic components to optimize code splitting
- ✅ Main bundle reduced by about 57KB, improving first-screen loading

### Component Refactor
- ✅ Deleted the BasicModeWorkspace monolithic component (635 lines)
- ✅ Added BasicSystemWorkspace (680 lines)
- ✅ Added BasicUserWorkspace (685 lines)
- ✅ Deleted the ImageWorkspace monolithic component (1606 lines)
- ✅ Added ImageText2ImageWorkspace (2205 lines)
- ✅ Added ImageImage2ImageWorkspace (2205 lines)

## Document List

- [x] **bug-fix-testresults-display.md** - P0 bug fix record
  - Problem: Test results are not displayed in Basic mode
  - Root cause: A missing `.value` on a ComputedRef access
  - Fix: Optimize the reactive data flow

- [x] **architecture-comparison.md** - Architecture comparison of the three modes
  - Basic mode: Store → Logic → Component
  - Context mode: Tester composable → Component
  - Image mode: Direct Store connection → Component
  - Unified goal: Store + Operations

- [x] **test-plan.md** - Session persistence test plan
  - Basic persistence test
  - Mode isolation test
  - Migration logic test
  - Cross-browser test

## Follow-up Plan

The Logic → Operations migration guide has been moved back to `docs/workspace/architecture-migration-guide.md`, and includes:
- Phase 1: Infrastructure preparation
- Phase 2: Basic mode migration
- Phase 3: Context mode migration
- Phase 4: Image mode alignment
- Phase 5: Cleanup and optimization

## Technical Highlights

### ImageStorageService Design
- **Table separation**: metadata and data live in separate tables, avoiding loading a lot of base64 during queries
- **Database migration**: Provides a complete v1 → v2 upgrade path, processed in batches to avoid memory spikes
- **Quota management**: LRU strategy + automatic cleanup + configurable thresholds
- **Transaction guarantees**: Uses Dexie transactions to ensure data consistency

### Session Store Defensive Hardening
- **No saving before restore**: Avoids overwriting persisted data
- **Serialized processing**: Both restore and save are serialized to avoid memory peaks caused by concurrency
- **Concurrency lock protection**: Uses a global lock to prevent save operation conflicts

### Code Splitting Optimization
- **Removed static exports**: Basic components are now dynamically imported through the router
- **Successful splitting**: Generates standalone chunks (23KB × 2)
- **Performance gain**: Main bundle reduced by 57KB, faster first-screen loading

## Related Commits

- `5ea1004` - fix(ui): fix the cross-mode state pollution problem and implement the single source of truth architecture
- `a364799` - fix(ui): harden the defensiveness of image mode model selection
- `687a4f1` - fix(ui): fix the P0 problem of session state persistence
- `3ede3d8` - refactor(ui): refactor ImageWorkspace to use the session store as the single source of truth and fix history loading
- `2b669b9` - refactor(ui): complete the single source of truth architecture and optimize code splitting

## Code Statistics

### Final Commit (2b669b9)
- **Total changes**: 91 files
- **Added**: +13,757 lines
- **Deleted**: -4,989 lines
- **Net increase**: +8,768 lines

### Main Added Files
- `packages/core/src/services/image/storage.ts` (457 lines)
- `packages/core/src/services/image/index.ts` (47 lines)
- `packages/ui/src/components/basic-mode/BasicSystemWorkspace.vue` (680 lines)
- `packages/ui/src/components/basic-mode/BasicUserWorkspace.vue` (685 lines)
- `packages/ui/src/components/image-mode/ImageImage2ImageWorkspace.vue` (2,205 lines)

### Main Deleted Files
- `packages/ui/src/components/basic-mode/BasicModeWorkspace.vue` (-635 lines)
- `packages/ui/src/composables/image/useImageWorkspace.ts` (-927 lines)

## Related Architecture Documents

- **Preceding refactor**: [117-pinia-refactoring](../117-pinia-refactoring/) - Introduction of Pinia state management
- **Core architecture**: [docs/architecture/storage-key-architecture.md](../../architecture/storage-key-architecture.md)
- **Developer guide**: [docs/developer/technical-development-guide.md](../../developer/technical-development-guide.md)

## Lessons Learned

### What Worked
1. ✅ **Single source of truth principle**: The Session Store is the sole data source, avoiding state divergence
2. ✅ **Defensive programming**: No saving before restore, avoiding data overwrites
3. ✅ **Serialized processing**: Large objects are serialized one at a time to avoid memory peaks
4. ✅ **Code splitting first**: Remove unnecessary static exports so dynamic imports take effect

### Things to Watch Out For
1. ⚠️ A ComputedRef in `<script setup>` needs an explicit `.value`
2. ⚠️ A computed getter should not return a temporary object (it breaks dependency tracking)
3. ⚠️ Concurrent saves need global lock protection
4. ⚠️ The cleanup strategy for image storage should be based on `accessedAt` (LRU)

### Future Optimization Directions
1. Complete the Logic → Operations migration (migration-guide.md)
2. Add automated test coverage
3. Performance monitoring and optimization (streaming token updates)
4. Strengthen error boundaries and exception handling
