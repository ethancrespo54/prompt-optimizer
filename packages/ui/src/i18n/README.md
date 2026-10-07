# Internationalization (i18n) Guidelines

## Translation Key Naming Conventions

To keep translation files consistent and maintainable, please follow these key naming conventions:

### 1. Naming Structure

Use a nested object structure and organize translation keys in the following hierarchy:

```
{
  "moduleName": {
    "submoduleOrFeature": {
      "specificText": "Translated content"
    }
  }
}
```

### 2. Module Division

- `common`: Common text, such as button labels and common actions
- Feature-specific modules: such as `promptOptimizer`, `settings`, `modelManager`, etc.

### 3. Parameterized Text

For text that contains variables, use curly braces to mark parameters:

```typescript
// Definition
"version": "V{version}"

// Usage
t('common.version', { version: '1.0.0' })
```

### 4. Example Structure

```typescript
export default {
  // Common text
  common: {
    buttons: {
      save: 'Save',
      cancel: 'Cancel',
      confirm: 'Confirm',
    },
    labels: {
      createdAt: 'Created at',
      lastModified: 'Last modified',
    },
    messages: {
      loading: 'Loading...',
      noData: 'No data',
    },
  },
  
  // Feature modules
  promptOptimizer: {
    title: 'Prompt Optimizer',
    form: {
      inputPlaceholder: 'Enter the prompt to optimize...',
      templateLabel: 'Optimization prompt',
    },
    actions: {
      optimize: 'Start Optimization →',
      save: 'Save Prompt',
      share: 'Share',
    },
  },
  
  // Settings module
  settings: {
    title: 'Settings',
    sections: {
      language: 'Language Settings',
      theme: 'Theme Settings',
      api: 'API Settings',
    },
  },
}
```

## Best Practices

1. **Stay consistent**: Text of the same type should use the same key structure
2. **Avoid duplication**: Common text should live under `common` and should not be defined repeatedly in multiple modules
3. **Descriptive keys**: Key names should clearly describe the purpose of the text rather than reuse the translated content directly
4. **Modularity**: Organize translations by feature module for easier maintenance and lookup
5. **Comments**: Add comments for complex or special-purpose text

## Adding a New Language

When adding a new language, make sure to:

1. Create the corresponding locale file under the `locales` directory, such as `ja-JP.ts`
2. Copy the structure of an existing locale file and make sure the key names are exactly the same
3. In `packages/ui/src/plugins/i18n.ts`:
   - Import the new locale file
   - Add it to the `SupportedLocale` type
   - Add it to the `SUPPORTED_LOCALES` array
   - Configure the fallback rules
   - Add it to the `messages` object
4. Add a language switch component (the previous `LanguageSwitchDropdown.vue` was removed)
5. Test how all pages are displayed in the new language

## Currently Supported Languages

- **English (en-US)**: the only supported language (default)

The Chinese locales (zh-CN, zh-TW) and the language switcher were removed. To add a language again, re-create a locale file and a language switch component. 