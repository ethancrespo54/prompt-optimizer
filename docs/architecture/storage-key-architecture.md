# Storage Key Architecture Design

## 📋 Overview

This document explains the two uses of storage keys in the application and the relationship between them, and resolves the architectural problem of incomplete data export.

## 🔍 The Two Uses of Storage Keys

### 1. Storage Layer Usage (Physical Storage Keys)

**Purpose:** Actual data storage operations (localStorage, Dexie, file storage, etc.)

#### UI Settings Managed by PreferenceService
```typescript
// PreferenceService adds the 'pref:' prefix
private readonly PREFIX = 'pref:';

// Logical key name -> physical storage key name
'app:settings:ui:theme-id' -> 'pref:app:settings:ui:theme-id'
'app:settings:ui:preferred-language' -> 'pref:app:settings:ui:preferred-language'
'app:selected-optimize-model' -> 'pref:app:selected-optimize-model'
'app:selected-test-model' -> 'pref:app:selected-test-model'
'app:selected-optimize-template' -> 'pref:app:selected-optimize-template'
'app:selected-user-optimize-template' -> 'pref:app:selected-user-optimize-template'
'app:selected-iterate-template' -> 'pref:app:selected-iterate-template'
```

#### Directly Stored Data
```typescript
// Core services use storage directly, without a prefix
'models'                                    // ModelManager
'user-templates'                           // TemplateManager
'prompt_history'                          // HistoryManager
```

### 2. Import/Export JSON Keys (Logical Key Names)

**Purpose:** JSON data exchange format, used for data import and export

```json
{
  "version": 1,
  "data": {
    "userSettings": {
      "app:settings:ui:theme-id": "dark",           // Logical key name
      "app:settings:ui:preferred-language": "zh-CN", // Logical key name
      "app:settings:ui:builtin-template-language": "zh-CN", // Now also goes through PreferenceService
      "app:selected-optimize-model": "gemini",
      "app:selected-test-model": "siliconflow",
      "app:selected-optimize-template": "general-optimize",
      "app:selected-user-optimize-template": "user-template-id",
      "app:selected-iterate-template": "iterate"
    },
    "models": [...],
    "userTemplates": [...],
    "history": [...]
  }
}
```

## ❌ Architectural Problem Found

### Problem Description
When exporting, DataManager looked up storage directly using logical key names, but the keys actually stored may carry a prefix, so the data could not be found.

### Root Cause
```typescript
// ❌ The original faulty implementation
for (const key of UI_SETTINGS_KEYS) {
  const value = await this.storage.getItem(key); // Looks up 'app:settings:ui:theme-id'
  // But what is actually stored is 'pref:app:settings:ui:theme-id'
}
```

### Impact
- The exported JSON contained only 4 settings instead of the expected 8
- UI settings stored via PreferenceService could not be exported
- User preferences might not be restored correctly on data import

## ✅ Solution

### Architectural Improvement
DataManager now distinguishes the two storage methods and uses the correct service to fetch data:

```typescript
// Setting keys stored via PreferenceService
const PREFERENCE_BASED_KEYS = [
  'app:settings:ui:theme-id',
  'app:settings:ui:preferred-language',
  'app:selected-optimize-model',
  'app:selected-test-model',
  'app:selected-optimize-template',
  'app:selected-user-optimize-template',
  'app:selected-iterate-template'
] as const;

// Setting keys stored directly
const DIRECT_STORAGE_KEYS = [
  'app:settings:ui:builtin-template-language',
] as const;
```

### Export Logic Fix
```typescript
// ✅ Fixed export logic
// Export settings stored via PreferenceService
for (const key of PREFERENCE_BASED_KEYS) {
  const value = await this.preferenceService.get(key, null);
  if (value !== null) {
    userSettings[key] = String(value);
  }
}

// Export directly stored settings
for (const key of DIRECT_STORAGE_KEYS) {
  const value = await this.storage.getItem(key);
  if (value !== null) {
    userSettings[key] = value;
  }
}
```

### Import Logic Fix
```typescript
// ✅ Fixed import logic
if (PREFERENCE_BASED_KEYS.includes(normalizedKey as any)) {
  // Store via PreferenceService
  await this.preferenceService.set(normalizedKey, value);
} else if (DIRECT_STORAGE_KEYS.includes(normalizedKey as any)) {
  // Store directly
  await this.storage.setItem(normalizedKey, value);
}
```

## 🏗️ Architectural Principles

### 1. Layered Storage
- **PreferenceService layer** - Manages user preference settings and adds a prefix to avoid conflicts
- **Direct storage layer** - Manages application data and uses the original key names

### 2. Key Name Mapping
- **Logical key names** - Used in business logic and data exchange, keeping semantics clear
- **Physical key names** - Used for actual storage, and may include a prefix or other decoration

### 3. Service Responsibilities
- **PreferenceService** - Responsible for storing and retrieving user preferences
- **DataManager** - Responsible for data import and export, and knows how to correctly obtain each kind of data
- **Core services** - Responsible for managing business data, using the appropriate storage method

## 📊 Storage Key Classification

| Key | Storage Method | Physical Key | Purpose |
|------|----------|----------|------|
| `app:settings:ui:theme-id` | PreferenceService | `pref:app:settings:ui:theme-id` | Theme setting |
| `app:settings:ui:preferred-language` | PreferenceService | `pref:app:settings:ui:preferred-language` | UI language |
| `app:settings:ui:builtin-template-language` | PreferenceService | `pref:app:settings:ui:builtin-template-language` | Built-in template language |
| `app:selected-optimize-model` | PreferenceService | `pref:app:selected-optimize-model` | Optimization model selection |
| `app:selected-test-model` | PreferenceService | `pref:app:selected-test-model` | Test model selection |
| `app:selected-optimize-template` | PreferenceService | `pref:app:selected-optimize-template` | System optimization template |
| `app:selected-user-optimize-template` | PreferenceService | `pref:app:selected-user-optimize-template` | User optimization template |
| `app:selected-iterate-template` | PreferenceService | `pref:app:selected-iterate-template` | Iteration template |
| `models` | Direct storage | `models` | Model configuration |
| `user-templates` | Direct storage | `user-templates` | User templates |
| `prompt_history` | Direct storage | `prompt_history` | Prompt history |

## 🔄 Backward Compatibility

### Key Name Conversion
The application supports importing data from older versions, converting automatically via LEGACY_KEY_MAPPING:

```typescript
const LEGACY_KEY_MAPPING: Record<string, string> = {
  'theme-id': 'app:settings:ui:theme-id',
  'preferred-language': 'app:settings:ui:preferred-language',
  'builtin-template-language': 'app:settings:ui:builtin-template-language',
};
```

### Data Migration
When importing data from an older version, the system will:
1. Recognize the old key name format
2. Convert it to the new standard key name
3. Save it using the correct storage method
4. Show conversion information in the console

## 🚀 Best Practices

### 1. Adding a New Storage Key
- Use unified constant definitions
- Be explicit about the storage method (PreferenceService vs direct storage)
- Update DataManager's classification arrays

### 2. Changing the Storage Method
- Consider backward compatibility
- Update the import/export logic
- Add data migration logic

### 3. Testing and Verification
- Verify the completeness of data export
- Test importing data from older versions
- Check storage key consistency

## 📝 Related Files

- **Constant definitions**: `packages/ui/src/constants/storage-keys.ts`
- **Core constants**: `packages/core/src/constants/storage-keys.ts`
- **Data management**: `packages/core/src/services/data/manager.ts`
- **Preference service**: `packages/core/src/services/preference/service.ts`
- **Test documentation**: `docs/testing/ai-automation/storage-key-consistency/`
