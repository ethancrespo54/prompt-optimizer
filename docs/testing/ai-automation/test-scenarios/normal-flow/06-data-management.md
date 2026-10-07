# Data Management Normal Flow Test

## 📖 Test Overview
Verify the basic flow of the data management feature, ensuring users can normally import, export, back up, and restore application data.

## 🎯 Test Goals
- Verify that the data management interface opens normally
- Verify the data export feature
- Verify the data import feature

## 📋 Prerequisites
- [ ] The application has started and finished loading
- [ ] The user interface displays correctly
- [ ] The browser supports file download and upload
- [ ] There is some data (templates, history records, etc.)

---

## 🔧 Test Steps

### Step 1: Prepare Test Data

**AI execution guidance:**
- If there is not enough test data, create some first
- Perform several prompt optimizations to create history records
- Make sure there are template and configuration data
- Prepare for the import/export tests

**Test data preparation:**
```
1. Create 2-3 optimization history records
2. Make sure there is model configuration
3. Make sure there is template data
4. Verify the integrity of the data
```

**Expected results:**
- The application has enough test data
- The data types are diverse
- The data state is normal

**Verification points:**
- [ ] There is history record data
- [ ] There is model configuration data
- [ ] There is template data
- [ ] The data state is normal

---

### Step 2: Open the Data Manager

**AI execution guidance:**
- Use `browser_snapshot` to get the current page state
- Find the button containing the "💾" icon and the "Data Management" text
- Use `browser_click` to click that button

**Expected results:**
- The data management dialog pops up
- The dialog title shows "Data Management" or similar text
- The interface shows function options such as import, export, and backup

**Verification points:**
- [ ] The data management popup is displayed
- [ ] The popup title is displayed correctly
- [ ] Function buttons such as import and export are visible
- [ ] The interface layout is clear and the function sections are well defined

---

### Step 3: View the Data Management Interface

**AI execution guidance:**
- Use `browser_snapshot` to view the data management interface content
- Check each function button and option
- View the data statistics (if any)
- Check the interface layout and usability

**Expected results:**
- The data management interface layout is clear
- Function buttons are clearly visible
- Data statistics are accurate (if any)
- All function options are available

**Verification points:**
- [ ] The interface layout is clear and reasonable
- [ ] Function buttons are clearly visible
- [ ] Data statistics are accurate (if any)
- [ ] Function options are available

---

### Step 4: Export Application Data

**AI execution guidance:**
- Find buttons such as "Export", "Backup", or "Download"
- Use `browser_click` to click the export button
- Handle any selection dialog that may appear
- Wait for the export process to complete

**Expected results:**
- Export options are displayed or the export starts directly
- The browser starts downloading the exported file
- The file name contains a timestamp or version information
- An export success message is displayed

**Verification points:**
- [ ] The export process starts successfully
- [ ] The file download starts normally
- [ ] The file name format is correct
- [ ] An export success prompt is displayed

---

### Step 5: Verify the Exported File

**AI execution guidance:**
- Check the browser download status
- Verify the file was downloaded successfully
- If possible, check the basic properties of the file
- Confirm the integrity of the export operation

**Expected results:**
- The file is successfully downloaded locally
- The file size is reasonable (not empty)
- The file format is correct (usually JSON)
- The file contains the application data

**Verification points:**
- [ ] The file was downloaded successfully
- [ ] The file size is reasonable
- [ ] The file format is correct
- [ ] The file content is complete

---

### Step 6: Test the Data Import Interface

**AI execution guidance:**
- Find buttons such as "Import", "Restore", or "Upload"
- Use `browser_click` to click the import button
- Check whether the file selection dialog appears
- Verify the usability of the import interface

**Expected results:**
- The file selection dialog opens
- The import interface responds normally
- The file selection feature is available
- The interface prompt messages are clear

**Verification points:**
- [ ] The file selection dialog opens normally
- [ ] The import interface responds normally
- [ ] The file selection feature is available
- [ ] The interface prompts are clear

---

### Step 7: Verify the Completeness of Data Management Features

**AI execution guidance:**
- Test the response of each function button
- Check the interaction between features
- Verify the error handling mechanism
- Test the stability of the interface

**Expected results:**
- All function buttons respond normally
- The interaction between features is good
- The error handling mechanism is sound
- The interface is stable and reliable

**Verification points:**
- [ ] All function buttons are normal
- [ ] The interaction between features is good
- [ ] Error handling is sound
- [ ] The interface is stable and reliable

---

### Step 8: Close the Data Management Interface

**AI execution guidance:**
- Find the close button (usually an X icon)
- Use `browser_click` to click the close button
- Or click the area outside the interface to close it
- Verify the interface has closed

**Expected results:**
- The data management interface closes
- The view returns to the main interface
- The main interface features are normally available

**Verification points:**
- [ ] The data management interface closes successfully
- [ ] The view returns to the main interface
- [ ] The main interface state is normal
- [ ] Other features are not affected

---

## ⚠️ Common Problem Checks

### Interface Display Problems
- The data management interface cannot be opened
- Function buttons display abnormally
- Layout disorder
- Unclear prompt messages

### Export Feature Problems
- The export operation fails
- Abnormal file download
- The exported file is empty
- File format errors

### Import Feature Problems
- Abnormal file selection
- The import operation fails
- Unsupported file format
- Abnormal data after import

---

## 🤖 AI Verification Execution Template

```javascript
// 1. Open the application
browser_navigate("http://localhost:18181/")

// 2. Prepare test data (if needed)
browser_type(element="Original prompt input box", ref="e54", text="Data management test")
browser_click(element="Start optimization button", ref="e78")
browser_wait_for(time=10)

// 3. Open data management
browser_click(element="Data management button", ref="data_management_button")
browser_snapshot()

// 4. View the data management interface
browser_snapshot()

// 5. Test the export feature
browser_click(element="Export button", ref="export_button")
browser_wait_for(time=5)
browser_snapshot()

// 6. Test the import interface
browser_click(element="Import button", ref="import_button")
browser_snapshot()
browser_press_key("Escape") // Close the file selection dialog

// 7. Close the data management interface
browser_press_key("Escape")
browser_snapshot()
```

**Success criteria:**
- The data management interface opens and closes normally
- The export feature can start normally
- The import interface can open normally
- All function buttons respond normally
- Interface interaction is smooth and stable
- No error messages or abnormal states

**Notes:**
- The export test mainly verifies that the feature starts; the actual file download may require manual verification
- The import test mainly verifies that the interface opens; the actual file upload requires preparing a test file
- The data clearing feature is tested in history management, not in the data management interface
