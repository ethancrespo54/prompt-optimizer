# Normal Flow Tests

## 📖 Overview

Normal flow tests verify that the application's basic features work correctly. These tests serve as the baseline for regression testing and ensure the stability of core features.

## 🎯 Test Goals

- Verify the correctness of the main feature paths
- Ensure basic user operation flows are usable
- Serve as the baseline for regression tests
- Quickly discover problems in core features

## 📋 Test List

### Basic Feature Tests
- **01-basic-setup.md** - Basic setup features (theme, language switching, etc.)
- **02-model-management.md** - Model management features (API configuration, testing, etc.)
- **03-template-management.md** - Template management features (create, edit, delete, etc.)

### Core Feature Tests
- **04-prompt-optimization.md** - System prompt optimization (updated - includes result display feature tests) ✅
- **04b-user-prompt-optimization.md** - User prompt optimization (updated - includes result display feature tests) ✅
- **05-history-management.md** - History management features
- **06-data-management.md** - Data management features (import/export, etc.)
- **08-context-persistence.md** - Context management and persistence (new) ⭐
- **09-context-variables-and-preview.md** - Context variables and preview consistency (new) ⭐
- **10-tools-management-and-advanced-context.md** - Tools management and advanced context (new) ⭐
- **11-context-import-export.md** - Context collection import/export (new) ⭐
 - **12-advanced-context-optimization-and-testing.md** - Full advanced optimization and testing (variables/context/tools) ⭐

### UI Interaction Feature Tests
- **07-ui-interaction-features.md** - Standalone UI interaction feature tests (new) ⭐

## 🤖 Execution Notes

### Execution Order
It is recommended to execute the tests in numbered order, because later tests may depend on earlier configuration:

1. Basic setup → 2. Model management → 3. Template management → 4. System prompt optimization → 4b. User prompt optimization → 5. History management → 6. Data management → 7. UI interaction features

### Execution Frequency
- **Daily regression** - Run the core feature tests (04-prompt-optimization.md + 04b-user-prompt-optimization.md, which now include result display features)
- **Before a release** - Run all normal flow tests
- **After feature changes** - Run the tests for the related features
- **After UI changes** - Run the UI interaction feature tests (07-ui-interaction-features.md)

### Success Criteria
- All operation steps can be executed successfully
- All verification points pass
- No error messages or abnormal states appear
- The user experience is smooth and natural

## 📊 Test Reports

A test report should be generated after each run, including:
- Execution time and environment information
- Pass/fail status of each test
- Problems found and improvement suggestions
- Performance metrics (such as response time)

## 🔄 Maintenance Notes

- Update the corresponding test documents promptly when features change
- Periodically check the validity and accuracy of the tests
- Adjust the testing focus based on discovered problems
- Keep the test documents in sync with the actual features
