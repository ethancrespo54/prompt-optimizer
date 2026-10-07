# CSP-Safe Template Processing

## Background

Browser extension environments have a strict Content Security Policy (CSP) that forbids `unsafe-eval`. As a result, Handlebars.compile() cannot work properly in a browser extension, because it internally uses the `Function` constructor or `eval()` to compile templates dynamically.

## Error Message

```
OptimizationError: Optimization failed: Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source of script in the following Content Security Policy directive: "script-src 'self'".
```

## Solution

We implemented a CSP-compatible template processor dedicated to the browser extension environment:

### 1. CSPSafeTemplateProcessor

Location: `packages/core/src/services/template/csp-safe-processor.ts`

**Features:**
- Supports basic `{{variable}}` variable substitution
- Does not use `eval()` or the `Function` constructor
- Automatically detects the browser extension environment
- Warns about unsupported Handlebars features

**Supported syntax:**
- ✅ `{{variableName}}` - basic variable substitution
- ✅ `{{ variableName }}` - variables with spaces
- ✅ Predefined variables: `{{originalPrompt}}`, `{{lastOptimizedPrompt}}`, `{{iterateInput}}`

**Unsupported syntax:**
- ❌ `{{#if condition}}` - conditionals
- ❌ `{{#each items}}` - loops
- ❌ `{{#unless condition}}` - negated conditionals
- ❌ `{{> partial}}` - partial templates
- ❌ `{{{unescaped}}}` - unescaped output

### 2. Automatic Environment Detection

`TemplateProcessor` automatically detects the runtime environment:

```typescript
// Detect whether we are in a browser extension environment
if (CSPSafeTemplateProcessor.isExtensionEnvironment()) {
  // Use the CSP-safe processor
  return CSPSafeTemplateProcessor.processContent(msg.content, context);
} else {
  // Use the full Handlebars features
  return Handlebars.compile(msg.content, { noEscape: true })(context);
}
```

### 3. Environment Detection Logic

```typescript
static isExtensionEnvironment(): boolean {
  try {
    return typeof chrome !== 'undefined' && 
           typeof chrome.runtime !== 'undefined' && 
           typeof chrome.runtime.getManifest === 'function';
  } catch (error) {
    return false;
  }
}
```

## Usage Examples

### Basic Variable Substitution

```typescript
const content = 'Hello {{name}}, you are {{age}} years old.';
const context = { name: 'Alice', age: '25' };
const result = CSPSafeTemplateProcessor.processContent(content, context);
// Result: "Hello Alice, you are 25 years old."
```

### Predefined Template Variables

```typescript
const content = 'Original: {{originalPrompt}}, Input: {{iterateInput}}';
const context = {
  originalPrompt: 'Write a story',
  iterateInput: 'Make it more dramatic'
};
const result = CSPSafeTemplateProcessor.processContent(content, context);
// Result: "Original: Write a story, Input: Make it more dramatic"
```

## Compatibility

| Environment | Template engine | Feature support |
|------|----------|----------|
| Browser extension | CSPSafeTemplateProcessor | Basic variable substitution |
| Web app | Handlebars | Full features |
| Desktop app | Handlebars | Full features |

## Testing

Related test files:
- `packages/core/tests/unit/template/csp-safe-processor.test.ts`
- `packages/core/tests/unit/template/extension-environment.test.ts`

Run the tests:
```bash
cd packages/core
npm test -- csp-safe-processor.test.ts
npm test -- extension-environment.test.ts
```

## Notes

1. **Feature limits**: in the browser extension environment only basic variable substitution is supported; complex Handlebars features are not
2. **Backward compatibility**: other environments still use the full Handlebars features
3. **Warnings**: when a template contains unsupported features, a warning is shown in the console
4. **Variable handling**: undefined variables are replaced with an empty string

## Related Files

- `packages/core/src/services/template/csp-safe-processor.ts` - CSP-safe processor
- `packages/core/src/services/template/processor.ts` - main template processor (modified)
- `packages/extension/public/manifest.json` - extension manifest file (CSP configuration)

## 🔄 Technical Migration Update (2025-08-29)

### Unified Handlebars → Mustache Migration

**Problem evolution**: The original environment-specific approach solved the CSP problem, but it maintained two different template processing logics, which increased system complexity.

**Final solution**: 
1. **Adopt Mustache.js everywhere**: all environments use the same template engine, and Mustache natively supports CSP environments
2. **Remove environment detection**: the `isExtensionEnvironment()` check is no longer needed
3. **Simplify the processor**: deprecate `CSPSafeTemplateProcessor` and use `Mustache.render()` uniformly

**Technical advantages**:
- ✅ **Unified architecture**: a single code path eliminates environment differences
- ✅ **Simpler maintenance**: no need to maintain two sets of template processing logic
- ✅ **Native CSP**: Mustache never uses eval, so there are no CSP compatibility issues
- ✅ **Consistent features**: all environments enjoy the same template features

**Implementation comparison**:
```typescript
// Old approach: environment check
if (CSPSafeTemplateProcessor.isExtensionEnvironment()) {
  return CSPSafeTemplateProcessor.processContent(msg.content, context);
} else {
  return Handlebars.compile(msg.content, { noEscape: true })(context);
}

// New approach: unified processing
return Mustache.render(msg.content, context);
```

**Migration results**:
- 📁 Deleted files: `csp-safe-processor.ts`, `csp-safe-processor.test.ts`
- 📝 Updated dependency: `handlebars` → `mustache`
- 🔧 Simplified handling: removed all environment detection logic
- 📖 Documentation update: user documentation updated in sync with the template technology description

This migration upgrades CSP-safe handling from a "compatibility approach" to a "native support approach", an important milestone in architecture simplification.
