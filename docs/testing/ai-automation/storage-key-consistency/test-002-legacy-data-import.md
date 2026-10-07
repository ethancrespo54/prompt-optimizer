# Test 002: Old Version Data Import Compatibility Verification

## 📋 Test Information
- **Test ID:** TEST-002
- **Test type:** Compatibility test
- **Priority:** Medium
- **Estimated execution time:** 3 minutes

## 🎯 Test Goal
Verify that the application can correctly import data files that use old version short key names, and automatically convert them to the new full key name format.

## 📝 Test Prerequisites
1. The application has started and completed initialization
2. The user can access the data management feature
3. A test data file containing old version key names is prepared

## 🧪 Test Data Preparation

### Create the Test Data File
Create a file named `legacy-test-data.json` with the following content:

```json
{
  "version": 1,
  "data": {
    "userSettings": {
      "theme-id": "dark",
      "preferred-language": "en-US",
      "builtin-template-language": "zh-CN",
      "app:selected-optimize-model": "gemini",
      "app:selected-test-model": "siliconflow",
      "app:selected-optimize-template": "general-optimize",
      "app:selected-iterate-template": "iterate"
    },
    "models": [
      {
        "key": "test-model",
        "id": "test-model",
        "name": "Test Model",
        "enabled": true
      }
    ],
    "userTemplates": [
      {
        "id": "test-template",
        "name": "Test Template",
        "content": "Test content",
        "isBuiltin": false,
        "metadata": {
          "templateType": "optimize",
          "version": "1.0",
          "lastModified": 1640995200000
        }
      }
    ],
    "history": [
      {
        "id": "test-history",
        "prompt": "Test prompt",
        "timestamp": 1640995200000
      }
    ]
  }
}
```

## 🧪 Test Steps

### Step 1: Clear Current Data (Optional)
```javascript
// 1.1 Open data management
browser_click(element="Data management button", ref="data-manager");
browser_wait_for(time=1);
browser_snapshot();

// 1.2 If needed, you can first clear the existing data
// This step is optional, depending on the test needs
```

### Step 2: Import Old Version Data
```javascript
// 2.1 Select the import feature
browser_click(element="Import data area", ref="import-area");
browser_wait_for(time=1);

// 2.2 Upload the test file
// Note: an actual file upload operation is needed here
// The specific implementation depends on how the UI uploads files
browser_file_upload(paths=["./legacy-test-data.json"]);
browser_wait_for(time=2);

// 2.3 Confirm the import
browser_click(element="Confirm import button", ref="confirm-import");
browser_wait_for(time=3);
browser_snapshot();
```

### Step 3: Verify the Import Result
```javascript
// 3.1 Check the import success prompt
browser_snapshot();

// 3.2 Close the data management dialog
browser_press_key("Escape");
browser_wait_for(time=1);

// 3.3 Verify that the settings take effect
// Check whether the theme changed to dark
// Check whether the language changed to en-US
browser_snapshot();
```

### Step 4: Verify the Key Name Conversion
```javascript
// 4.1 Re-export the data to verify the conversion result
browser_click(element="Data management button", ref="data-manager");
browser_wait_for(time=1);

browser_click(element="Export data button", ref="export-button");
browser_wait_for(time=3);
browser_snapshot();
```

## ✅ Verification Points

### Import Process Verification
- [ ] **Import succeeds** - An import success prompt is displayed with no error messages
- [ ] **Console logs** - Key name conversion information is shown
- [ ] **Settings take effect** - The imported settings are displayed correctly in the UI

### Key Name Conversion Verification
- [ ] `theme-id` → `app:settings:ui:theme-id`
- [ ] `preferred-language` → `app:settings:ui:preferred-language`
- [ ] `builtin-template-language` → `app:settings:ui:builtin-template-language`
- [ ] New-format key names remain unchanged

### Functional Verification
- [ ] **Theme setting** - The interface theme changes to the imported dark theme
- [ ] **Language setting** - The interface language changes to the imported en-US
- [ ] **Template language** - The built-in template language changes to the imported zh-CN
- [ ] **Model selection** - The optimization and test model selections are correct
- [ ] **Template selection** - The template selection settings are correct

### Re-Export Verification
- [ ] **New-format key names** - The re-exported data uses the full new-format key names
- [ ] **Data integrity** - All imported data is saved correctly
- [ ] **Forward compatibility** - The newly exported data format conforms to the latest standard

## 🚨 Failure Handling

### If the import fails:
1. Check whether the file format is correct
2. View the console error messages
3. Verify whether the file upload feature works normally
4. Check the data validation logic

### If the key name conversion fails:
1. Check the LEGACY_KEY_MAPPING configuration
2. Verify the normalizeSettingKey function
3. Check whether there are conversion logs in the console
4. Check the isValidSettingKey validation logic

### If the settings do not take effect:
1. Check the stored content after import
2. Verify the setting reading logic of each component
3. Check whether a page refresh is needed
4. Verify the reactive update mechanism

## 📊 Test Results

### Execution Information
- **Execution time:** [To be filled in]
- **Execution environment:** [Web/Desktop]
- **Browser version:** [To be filled in]

### Result Record
- **Test status:** [Pass/Fail/Partial pass]
- **Number of key names converted:** [Number successfully converted]/3
- **Settings effect:** [Description]

### Console Log Record
```
[Record the relevant console output, especially the key name conversion information]
```

### Re-Exported JSON
```json
[Paste the re-exported JSON content to verify the key name format]
```

## 🔄 Follow-Up Actions
- [ ] If the test fails, analyze the cause of the failure
- [ ] If the test passes, verify other old version data formats
- [ ] Update the compatibility documentation
- [ ] Consider adding more edge case tests
