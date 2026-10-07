# Test 001: Data Export Completeness Verification

## 📋 Test Information
- **Test ID:** TEST-001
- **Test type:** Functional test
- **Priority:** High
- **Estimated execution time:** 5 minutes

## 🎯 Test Goal
Verify that after fixing the storage key consistency problem, all user settings can be exported correctly into the JSON file.

## 📝 Test Prerequisites
1. The application has started and completed initialization
2. The user can access the settings and data management features
3. The browser supports file downloads

## 🧪 Test Steps

### Step 1: Set User Preferences
```javascript
// 1.1 Switch the theme setting
browser_click(element="Theme toggle button", ref="theme-toggle");
browser_wait_for(time=1);
browser_snapshot();

// 1.2 Switch the interface language
browser_click(element="Language toggle button", ref="language-toggle");
browser_wait_for(time=1);
browser_snapshot();

// 1.3 Switch the built-in template language
browser_click(element="Built-in template language toggle button", ref="builtin-lang-toggle");
browser_wait_for(time=1);
browser_snapshot();
```

### Step 2: Configure Model Selection
```javascript
// 2.1 Open model management
browser_click(element="Model Manager button", ref="model-manager");
browser_wait_for(time=2);
browser_snapshot();

// 2.2 Select the optimization model
browser_click(element="Optimization model select", ref="optimize-model-select");
browser_wait_for(time=1);
browser_click(element="Gemini model option", ref="gemini-option");
browser_wait_for(time=1);

// 2.3 Select the test model
browser_click(element="Test model select", ref="test-model-select");
browser_wait_for(time=1);
browser_click(element="SiliconFlow model option", ref="siliconflow-option");
browser_wait_for(time=1);

browser_press_key("Escape");
browser_wait_for(time=1);
```

### Step 3: Configure Template Selection
```javascript
// 3.1 Open template management
browser_click(element="Template management button", ref="template-manager");
browser_wait_for(time=2);
browser_snapshot();

// 3.2 Select the system optimization template
browser_click(element="System optimization template select", ref="system-optimize-template");
browser_wait_for(time=1);

// 3.3 Select the iteration template
browser_click(element="Iteration template select", ref="iterate-template");
browser_wait_for(time=1);

browser_press_key("Escape");
browser_wait_for(time=1);
```

### Step 4: Export Data
```javascript
// 4.1 Open data management
browser_click(element="Data management button", ref="data-manager");
browser_wait_for(time=1);
browser_snapshot();

// 4.2 Perform the data export
browser_click(element="Export data button", ref="export-button");
browser_wait_for(time=3);
browser_snapshot();
```

## ✅ Verification Points

### Main Verification Points
- [ ] **Export succeeds** - The file is downloaded successfully with no error prompts
- [ ] **JSON format is correct** - The exported file is valid JSON
- [ ] **Contains all setting items** - userSettings contains the 8 expected setting items

### Detailed Verification Points
- [ ] `app:settings:ui:theme-id` - The theme setting is exported correctly
- [ ] `app:settings:ui:preferred-language` - The language setting is exported correctly
- [ ] `app:settings:ui:builtin-template-language` - The built-in template language setting is exported correctly
- [ ] `app:selected-optimize-model` - The optimization model selection is exported correctly
- [ ] `app:selected-test-model` - The test model selection is exported correctly
- [ ] `app:selected-optimize-template` - The system optimization template selection is exported correctly
- [ ] `app:selected-user-optimize-template` - The user optimization template selection is exported correctly (if set)
- [ ] `app:selected-iterate-template` - The iteration template selection is exported correctly

### Expected JSON Structure
```json
{
  "version": 1,
  "data": {
    "userSettings": {
      "app:settings:ui:theme-id": "dark",
      "app:settings:ui:preferred-language": "zh-CN",
      "app:settings:ui:builtin-template-language": "zh-CN",
      "app:selected-optimize-model": "gemini",
      "app:selected-test-model": "siliconflow",
      "app:selected-optimize-template": "general-optimize",
      "app:selected-iterate-template": "iterate"
    },
    "models": [...],
    "userTemplates": [...],
    "history": [...]
  }
}
```

## 🚨 Failure Handling

### If the exported userSettings has fewer than 7 items:
1. Check the console for error messages
2. Verify that each setting was actually saved
3. Check whether the storage key names are correct
4. Record the specific missing setting items

### If the key name format is incorrect:
1. Check whether any components still use the old short key names
2. Verify that the constant definitions are imported correctly
3. Check for caching problems

## 📊 Test Results

### Execution Information
- **Execution time:** [To be filled in]
- **Execution environment:** [Web/Desktop]
- **Browser version:** [To be filled in]

### Result Record
- **Test status:** [Pass/Fail/Partial pass]
- **Number of exported setting items:** [Actual count]/8
- **Problems found:** [Problem description]

### Actual Exported JSON
```json
[Paste the actual exported JSON content]
```

## 🔄 Follow-Up Actions
- [ ] If the test fails, create a bug report
- [ ] If the test passes, update the test status
- [ ] Record any improvement suggestions
