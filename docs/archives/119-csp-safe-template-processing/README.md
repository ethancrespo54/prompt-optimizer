# 119-CSP-safe Template Processing 🔒

## 📋 Overview

**Problem**: The strict Content Security Policy (CSP) in the browser extension environment causes Handlebars template compilation to fail with an "unsafe-eval" error.

**Solution**: Implement a CSP-compatible template processor that uses simple variable substitution in the browser extension environment, while other environments keep the full Handlebars features.

**Scope of impact**: 
- ✅ Fixed: template features work properly in the browser extension
- ✅ Preserved: full functionality of the Web and Desktop apps is unaffected
- ✅ Enhanced: more accurate environment detection, avoiding Electron misdetection

## 🚨 Background

### Symptoms
```
OptimizationError: Optimization failed: Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source of script in the following Content Security Policy directive: "script-src 'self'".
```

### Root Causes
1. **CSP restriction**: a strict CSP policy is set in the browser extension's manifest.json
2. **Dynamic compilation**: `Handlebars.compile()` internally uses the `Function` constructor or `eval()`
3. **Environment difference**: only the extension module is affected; the web/desktop modules work fine

### Technical Details
- **Problem location**: `packages/core/src/services/template/processor.ts:89`
- **CSP configuration**: `packages/extension/public/manifest.json`
- **Affected feature**: variable substitution in advanced templates

## 🎯 Solution

### 1. CSP-safe Processor
Create the `CSPSafeTemplateProcessor` class, providing basic variable substitution:

**Supported features**:
- ✅ `{{variableName}}` - basic variable substitution
- ✅ `{{ variableName }}` - variables with spaces
- ✅ Predefined variables: `{{originalPrompt}}`, `{{lastOptimizedPrompt}}`, `{{iterateInput}}`
- ✅ Newly added variables are supported automatically

**Unsupported features**:
- ❌ `{{#if condition}}` - conditionals
- ❌ `{{#each items}}` - loops
- ❌ `{{> partial}}` - partial templates
- ❌ Other complex Handlebars features

### 2. Smart Environment Detection
Enhance the `isExtensionEnvironment()` function to accurately distinguish between runtime environments:

**Detection logic**:
1. Exclude the Node.js environment
2. Exclude the Electron environment (multiple checks)
3. Verify the Chrome extension API
4. Verify that the manifest is valid

**Environment support**:
- 🌐 **Regular Web**: uses full Handlebars
- 🖥️ **Electron**: uses full Handlebars  
- 🧩 **Browser extension**: uses the CSP-safe processor

### 3. Automatic Switching Mechanism
`TemplateProcessor` automatically selects the appropriate processor based on the environment, with no manual configuration.

## 📁 File Structure

```
packages/core/src/services/template/
├── processor.ts                    # main template processor (modified)
├── csp-safe-processor.ts          # CSP-safe processor (new)
└── minimal.ts                     # Handlebars export

packages/core/tests/unit/template/
├── csp-safe-processor.test.ts     # CSP processor tests (new)
└── extension-environment.test.ts   # extension environment tests (new)

packages/core/docs/
└── csp-safe-template-processing.md # technical documentation (new)
```

## 🧪 Test Coverage

### Test Types
- **Unit tests**: functional tests of the CSP-safe processor
- **Environment tests**: behavior verification in different environments
- **Integration tests**: overall functional tests of the template processor

### Test Results
- ✅ All tests pass (84 tests)
- ✅ Covers all environment detection scenarios
- ✅ Verifies that the Electron environment is correctly excluded
- ✅ Verifies that the extension environment is correctly identified

## 🎉 Results

### Feature Recovery
- ✅ Browser extension can use template features normally
- ✅ System prompt optimization works properly
- ✅ User prompt optimization works properly
- ✅ Iterative optimization works properly

### Compatibility Guarantees
- ✅ Web app functionality is completely unaffected
- ✅ Desktop app functionality is completely unaffected
- ✅ Existing templates are 100% backward compatible
- ✅ Newly added variables are supported automatically

### Security Improvements
- ✅ Complies with browser extension CSP requirements
- ✅ Does not reduce security on other platforms
- ✅ More accurate and reliable environment detection

## 📚 Related Documents

- **Technical documentation**: `packages/core/docs/csp-safe-template-processing.md`
- **Test documentation**: detailed comments in the test files
- **API documentation**: JSDoc comments in the code

## 🔄 Follow-up Optimization Suggestions

### Short-term Optimization
- Consider an explicit environment flag approach to further improve detection accuracy
- Monitor the accuracy of environment detection in real use

### Long-term Planning
- If complex template features are needed, consider a precompilation approach
- Evaluate whether more template features should be provided for the extension environment

## 💡 Lessons Learned

### Technical Lessons
1. **Environment detection**: multiple detection mechanisms ensure accuracy, and exception handling ensures stability
2. **Backward compatibility**: a progressive enhancement strategy that does not affect existing features
3. **Test-driven**: complete test coverage ensures the solution is reliable

### Architecture Lessons
1. **Adapter pattern**: choose the appropriate processor based on the environment
2. **Principle of least impact**: use simplified functionality only when necessary
3. **Extensible design**: new variables are supported at zero cost

## 📝 Follow-up Update (2025-08-29)

### Unified Template Technology Migration

**Background**: To further simplify the architecture and provide a unified CSP safety guarantee, we completed a full migration from Handlebars to Mustache.

**Main changes**:
1. **Handlebars dependency completely removed**: all environments use Mustache.js as the template engine
2. **CSPSafeTemplateProcessor deprecated**: environment-specific processors are no longer needed, as Mustache natively supports CSP safety
3. **Unified template syntax**: all templates use the standard Mustache syntax `{{#variable}}...{{/variable}}`
4. **Simplified architecture**: environment detection logic removed; all environments use the same processing flow

**Technical advantages**:
- ✅ **Simpler architecture**: a single template engine with no environment checks
- ✅ **Native CSP safety**: Mustache.js natively supports CSP environments
- ✅ **Better maintainability**: unified template syntax and processing logic
- ✅ **Fully compatible**: existing variable substitution is unchanged

**File changes**:
```diff
- packages/core/src/services/template/csp-safe-processor.ts (deleted)
- packages/core/tests/unit/template/csp-safe-processor.test.ts (deleted)
+ All template processing now uses Mustache.render()
+ Dependency updated from handlebars to mustache
```

**Documentation updates**:
- "Handlebars template technology" in the syntax guide was updated to "Mustache template technology"
- All user-facing documentation was updated in sync

This migration is a natural evolution of this CSP-safe processing solution, upgrading from an "environment-specific compatibility approach" to a "unified native support approach".

---

**🏷️ Tags**: CSP safety, template processing, browser extension, environment detection, compatibility, Mustache migration
