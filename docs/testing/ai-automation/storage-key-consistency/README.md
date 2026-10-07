# Storage Key Consistency Tests

## 📋 Test Purpose

Verify that all storage key usage in the application follows the unified constant definitions, avoiding problems such as incomplete data export and inconsistent key names caused by magic values.

## 🎯 Test Background

While fixing the incomplete user settings export problem, several storage key consistency problems were found:

### Problems Found
1. **Theme setting key name mismatch** - ThemeToggleUI.vue used `'theme-id'` instead of `'app:settings:ui:theme-id'`
2. **Built-in template language key name mismatch** - TemplateLanguageService used `'builtin-template-language'` instead of `'app:settings:ui:builtin-template-language'`
3. **Core services used magic values** - ModelManager, TemplateManager, and HistoryManager used string literals directly

### Fixes
1. Create a unified storage key constants file
2. Update all components and services to use the constants
3. Establish AI automated tests to ensure consistency

## 🧪 Test Scenarios

### Scenario 1: Data Export Completeness Verification
**Test purpose:** Verify that all user settings can be exported correctly

**AI execution guidance:**
```javascript
// 1. Set various user preferences
browser_click(element="Theme toggle button", ref="theme-toggle");
browser_wait_for(time=1);

browser_click(element="Language toggle button", ref="language-toggle");
browser_wait_for(time=1);

browser_click(element="Built-in template language toggle button", ref="builtin-lang-toggle");
browser_wait_for(time=1);

// 2. Select different models
browser_click(element="Model Manager button", ref="model-manager");
browser_wait_for(time=2);
// Select the optimization model and the test model
browser_press_key("Escape");

// 3. Export data
browser_click(element="Data management button", ref="data-manager");
browser_wait_for(time=1);
browser_click(element="Export data button", ref="export-button");
browser_wait_for(time=3);
```

**Verification points:**
- [ ] The exported JSON contains all 8 user setting items
- [ ] The theme setting is exported correctly (`app:settings:ui:theme-id`)
- [ ] The language setting is exported correctly (`app:settings:ui:preferred-language`)
- [ ] The built-in template language setting is exported correctly (`app:settings:ui:builtin-template-language`)
- [ ] The model selection settings are exported correctly
- [ ] The template selection settings are exported correctly

### Scenario 2: Data Import Compatibility Verification
**Test purpose:** Verify backward compatibility with the old version data format

**AI execution guidance:**
```javascript
// 1. Prepare old-format test data
const legacyData = {
  "version": 1,
  "data": {
    "userSettings": {
      "theme-id": "dark",
      "preferred-language": "en-US",
      "builtin-template-language": "zh-CN",
      "app:selected-optimize-model": "gemini"
    }
  }
};

// 2. Import the test data
browser_click(element="Data management button", ref="data-manager");
browser_wait_for(time=1);
// Upload the test file
browser_click(element="Import data button", ref="import-button");
browser_wait_for(time=2);

// 3. Verify the settings after import
browser_snapshot();
```

**Verification points:**
- [ ] Old version key names are correctly converted to new version key names
- [ ] The settings take effect after import (theme, language, etc.)
- [ ] The console shows key name conversion information
- [ ] Re-exported data uses the new key name format

### Scenario 3: Storage Key Constant Usage Verification
**Test purpose:** Verify through code inspection that all storage operations use constants

**AI execution guidance:**
```javascript
// This is a code review test that requires inspecting the source code
// 1. Check whether UI components use constants
// 2. Check whether core services use constants
// 3. Check whether test files use constants
```

**Verification points:**
- [ ] ThemeToggleUI.vue uses `UI_SETTINGS_KEYS.THEME_ID`
- [ ] LanguageSwitch.vue uses `UI_SETTINGS_KEYS.PREFERRED_LANGUAGE`
- [ ] TemplateLanguageService uses the correct full key name
- [ ] ModelManager uses `CORE_SERVICE_KEYS.MODELS`
- [ ] TemplateManager uses `CORE_SERVICE_KEYS.USER_TEMPLATES`
- [ ] HistoryManager uses `CORE_SERVICE_KEYS.PROMPT_HISTORY`

## 📊 Test Result Record

### Test Execution Record
- **Execution time:** [To be filled in]
- **Test environment:** [Web/Desktop]
- **Execution result:** [Pass/Fail]

### Problems Found
1. [Problem description]
2. [Problem description]

### Fix Suggestions
1. [Fix suggestion]
2. [Fix suggestion]

## 🔄 Continuous Monitoring

### Automated Checkpoints
1. **Build-time check** - Ensure all storage keys use constant definitions
2. **Test coverage** - Verify the completeness of the storage key constants
3. **Code review** - Prohibit using string literals directly as storage keys

### Preventive Measures
1. **ESLint rules** - Detect the use of magic strings
2. **TypeScript types** - Enforce the use of storage key types
3. **Documentation updates** - Maintain the storage key usage guide

## 📝 Related Documents

- [Storage key constant definitions](../../../../packages/ui/src/constants/storage-keys.ts)
- [Core service storage keys](../../../../packages/core/src/constants/storage-keys.ts)
- [Data manager implementation](../../../../packages/core/src/services/data/manager.ts)
