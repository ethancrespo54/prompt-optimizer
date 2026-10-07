# Test 003: Code Storage Key Consistency Check

## 📋 Test Information
- **Test ID:** TEST-003
- **Test type:** Code review test
- **Priority:** High
- **Estimated execution time:** 10 minutes

## 🎯 Test Goal
Verify through code inspection that all storage operations use the unified constant definitions, with no hard-coded magic strings.

## 📝 Test Scope
1. Storage key usage in UI components
2. Storage key usage in core services
3. Storage key usage in test files
4. Consistency of constant definitions

## 🧪 Checklist

### UI Component Storage Key Usage Check

#### ThemeToggleUI.vue
- [ ] **Import constants** - `UI_SETTINGS_KEYS` is imported correctly
- [ ] **Use constants** - Uses `UI_SETTINGS_KEYS.THEME_ID` instead of `'theme-id'`
- [ ] **All references** - All getPreference and setPreference calls use the constants

**Code location to check:**
```typescript
// packages/ui/src/components/ThemeToggleUI.vue
import { UI_SETTINGS_KEYS } from '../constants/storage-keys';

// Should use:
await setPreference(UI_SETTINGS_KEYS.THEME_ID, theme.id);
const themeId = await getPreference(UI_SETTINGS_KEYS.THEME_ID, defaultTheme);

// Instead of:
await setPreference('theme-id', theme.id); // ❌
```

#### LanguageSwitch.vue
- [ ] **Import constants** - `UI_SETTINGS_KEYS` is imported correctly
- [ ] **Use constants** - Uses `UI_SETTINGS_KEYS.PREFERRED_LANGUAGE`

#### BuiltinTemplateLanguageSwitch.vue
- [ ] **Service consistency** - TemplateLanguageService uses the correct full key name

### Core Service Storage Key Usage Check

#### ModelManager
- [ ] **Import constants** - `CORE_SERVICE_KEYS` is imported correctly
- [ ] **Use constants** - Uses `CORE_SERVICE_KEYS.MODELS` instead of `'models'`

**Code location to check:**
```typescript
// packages/core/src/services/model/manager.ts
import { CORE_SERVICE_KEYS } from '../../constants/storage-keys';

export class ModelManager implements IModelManager {
  private readonly storageKey = CORE_SERVICE_KEYS.MODELS; // ✅
  // Instead of:
  // private readonly storageKey = 'models'; // ❌
}
```

#### TemplateManager
- [ ] **Import constants** - `CORE_SERVICE_KEYS` is imported correctly
- [ ] **Use constants** - Uses `CORE_SERVICE_KEYS.USER_TEMPLATES` instead of `'user-templates'`

**Code location to check:**
```typescript
// packages/core/src/services/template/manager.ts
this.config = {
  storageKey: config?.storageKey || CORE_SERVICE_KEYS.USER_TEMPLATES, // ✅
  // Instead of:
  // storageKey: config?.storageKey || 'user-templates', // ❌
};
```

#### HistoryManager
- [ ] **Import constants** - `CORE_SERVICE_KEYS` is imported correctly
- [ ] **Use constants** - Uses `CORE_SERVICE_KEYS.PROMPT_HISTORY` instead of `'prompt_history'`

#### TemplateLanguageService
- [ ] **Use the full key name** - Uses `'app:settings:ui:builtin-template-language'` instead of `'builtin-template-language'`

**Code location to check:**
```typescript
// packages/core/src/services/template/languageService.ts
export class TemplateLanguageService implements ITemplateLanguageService {
  private readonly STORAGE_KEY = 'app:settings:ui:builtin-template-language'; // ✅
  // Instead of:
  // private readonly STORAGE_KEY = 'builtin-template-language'; // ❌
}
```

### Constant Definition Consistency Check

#### UI Package Constant Definitions
- [ ] **File exists** - `packages/ui/src/constants/storage-keys.ts` exists
- [ ] **Includes core service keys** - Includes the `CORE_SERVICE_KEYS` definition
- [ ] **Type definitions are complete** - Includes all necessary type definitions

#### Core Package Constant Definitions
- [ ] **File exists** - `packages/core/src/constants/storage-keys.ts` exists
- [ ] **In sync with the UI package** - UI setting keys are consistent with the UI package
- [ ] **Exports are complete** - Exports all necessary constants and types

#### DataManager Sync
- [ ] **Uses unified constants** - DataManager's UI_SETTINGS_KEYS is consistent with the constants file
- [ ] **Imports are correct** - Imported from the constants file rather than defined again

### Test File Check

#### Unit Tests
- [ ] **ModelManager tests** - Use the correct storage key constants
- [ ] **TemplateManager tests** - Use the correct storage key constants
- [ ] **HistoryManager tests** - Use the correct storage key constants
- [ ] **TemplateLanguageService tests** - Use the correct full key name

**Code location to check:**
```typescript
// packages/core/tests/unit/template/languageService.test.ts
expect(mockStorage.getItem).toHaveBeenCalledWith('app:settings:ui:builtin-template-language'); // ✅
// Instead of:
// expect(mockStorage.getItem).toHaveBeenCalledWith('builtin-template-language'); // ❌
```

## 🔍 Automated Check Scripts

### Search for Magic Strings
```bash
# Search for possible magic string usage
grep -r "theme-id" packages/ --exclude-dir=node_modules
grep -r "preferred-language" packages/ --exclude-dir=node_modules
grep -r "builtin-template-language" packages/ --exclude-dir=node_modules
grep -r "'models'" packages/ --exclude-dir=node_modules
grep -r "'user-templates'" packages/ --exclude-dir=node_modules
grep -r "'prompt_history'" packages/ --exclude-dir=node_modules
```

### Verify Constant Usage
```bash
# Verify constant imports
grep -r "UI_SETTINGS_KEYS" packages/ui/src/
grep -r "CORE_SERVICE_KEYS" packages/core/src/
grep -r "TEMPLATE_SELECTION_KEYS" packages/ui/src/
```

## ✅ Verification Criteria

### Pass Criteria
- [ ] All UI components use constants instead of magic strings
- [ ] All core services use constants instead of magic strings
- [ ] Constant definitions are consistent across the two packages
- [ ] Test files use the correct key names
- [ ] No hard-coded storage key strings are found

### Fail Criteria
- Any code that directly uses string literals as storage keys is found
- Constant definitions are inconsistent or missing
- Test files use incorrect key names

## 📊 Check Results

### Execution Information
- **Check time:** [To be filled in]
- **Check scope:** [Number of files]
- **Check tool:** [Manual/Script]

### Problems Found
1. **File:** [File path]
   **Problem:** [Problem description]
   **Suggestion:** [Fix suggestion]

2. **File:** [File path]
   **Problem:** [Problem description]
   **Suggestion:** [Fix suggestion]

### Check Statistics
- **Number of files checked:** [Count]
- **Number of problems found:** [Count]
- **Files needing fixes:** [Count]
- **Files meeting the standard:** [Count]

## 🔄 Follow-Up Actions
- [ ] Fix all problems found
- [ ] Establish ESLint rules to prevent magic strings
- [ ] Update development documentation and coding standards
- [ ] Set up CI checks to ensure code quality

## 📝 Improvement Suggestions

### Tooling Suggestions
1. **ESLint rules** - Create custom rules to detect storage key magic strings
2. **TypeScript strict mode** - Use literal types to restrict storage keys
3. **Pre-commit hooks** - Automatically check code consistency before committing

### Documentation Suggestions
1. **Coding standards** - Clarify the storage key usage conventions
2. **Development guide** - Provide best practices for storage key usage
3. **Architecture documentation** - Describe the storage key management strategy
