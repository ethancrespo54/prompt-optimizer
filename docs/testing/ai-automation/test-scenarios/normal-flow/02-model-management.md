# Model Management Normal Flow Test

## 📖 Test Overview
Verify the basic flow of the model management feature, ensuring users can configure and manage AI models normally.

## 🎯 Test Goals
- Verify that the model management interface opens normally
- Verify the API key configuration feature
- Verify the model connection test feature
- Verify saving and loading of configuration

## 📋 Prerequisites
- [ ] The application has started and finished loading
- [ ] The user interface displays correctly
- [ ] The network connection is normal
- [ ] An API key for testing is ready (optional)

---

## 🔧 Test Steps

### Step 1: Open the Model Manager

**AI execution guidance:**
- Use `browser_snapshot` to get the current page state
- Find the button containing the "⚙️" icon and the "Model Manager" text
- Use `browser_click` to click that button

**Expected results:**
- The model management dialog pops up
- The dialog title shows "Model Configuration" or similar text
- The interface shows configuration options for various models

**Verification points:**
- [ ] The model management popup is displayed
- [ ] The popup title is displayed correctly
- [ ] Model options such as OpenAI, Claude, and Gemini are visible
- [ ] The interface layout is clear and the functional areas are well defined

---

### Step 2: View the Model Configuration Interface

**AI execution guidance:**
- Use `browser_snapshot` to view the current popup content
- Check the configuration area of each model
- Look at the API key input box and other configuration options
- Check the availability of buttons and controls

**Expected results:**
- Each model has an independent configuration area
- The API key input box is clearly visible
- The model selection dropdown is available
- The test connection button is visible

**Verification points:**
- [ ] The model configuration area layout is reasonable
- [ ] The API key input box is visible
- [ ] Model selection options are available
- [ ] The test connection button is visible

---

### Step 3: Configure the OpenAI Model (Simulated)

**AI execution guidance:**
- Find the configuration area labeled "OpenAI"
- Find the API key input box
- Use `browser_type` to enter a test key (if allowed)
- Find the model selection dropdown and check the options

**Test data:**
```
API key: test_api_key_for_testing
Model selection: GPT-4 or GPT-3.5-turbo
```

**Expected results:**
- The API key input box accepts input
- The model selection dropdown shows available options
- The configuration interface responds normally

**Verification points:**
- [ ] The API key input feature works normally
- [ ] The model selection feature is available
- [ ] The configuration interface responds normally
- [ ] There are no format error prompts

---

### Step 4: Test the Connection Feature (Simulated)

**AI execution guidance:**
- Find buttons such as "Test Connection", "Verify", or "Test"
- Use `browser_click` to click the test button
- Use `browser_wait_for` to wait for the test to complete
- Check the display state of the test result

**Expected results:**
- The test button responds to clicks
- A state showing the test in progress is displayed (such as a loading icon)
- The result (success or failure) is displayed after the test completes
- The result message is clear

**Verification points:**
- [ ] The test button works normally
- [ ] The test process state is clear
- [ ] The test result is clearly displayed
- [ ] The error message is useful (if the test fails)

---

### Step 5: Save the Configuration

**AI execution guidance:**
- Check all configuration information
- Find buttons such as "Save", "OK", or "Apply"
- Use `browser_click` to click the save button
- Wait for confirmation that the save operation completed

**Expected results:**
- The save button responds normally
- A save success message is displayed
- The popup state updates or closes
- The configuration is saved

**Verification points:**
- [ ] The save button works normally
- [ ] A save success message is displayed
- [ ] The popup state updates correctly
- [ ] The configuration is saved successfully

---

### Step 6: Verify the Configuration Takes Effect

**AI execution guidance:**
- Close the model management popup (if still open)
- Use `browser_snapshot` to check the main interface state
- Find the model selection dropdown
- Verify that the newly configured model appears in the options

**Expected results:**
- The model selector on the main interface contains the configured model
- The model name is displayed correctly
- The status indicator shows it as available
- Models can be selected and switched normally

**Verification points:**
- [ ] The configured model appears in the selector
- [ ] The model name is displayed correctly
- [ ] The status indicator displays normally
- [ ] The model selection feature works normally

---

### Step 7: Reopen to Verify Persistence

**AI execution guidance:**
- Reopen the model management interface
- Check whether the previous configuration is retained
- Verify whether the API key and model selection were saved
- Test the integrity of the configuration

**Expected results:**
- The previous configuration is loaded correctly
- The API key status is displayed correctly
- The model selection remains unchanged
- All settings are saved persistently

**Verification points:**
- [ ] The configuration is loaded correctly
- [ ] The API key status is correct
- [ ] The model selection is retained
- [ ] The settings are saved persistently

---

## ⚠️ Common Problem Checks

### Interface Display Problems
- The popup cannot be opened
- The configuration area displays abnormally
- Incorrect button states
- Layout disorder

### Configuration Feature Problems
- The API key cannot be entered
- Model selection is unavailable
- Test connection fails
- The save feature is abnormal

### Data Persistence Problems
- The configuration cannot be saved
- The configuration is lost after refresh
- Settings fail to load
- Local storage anomalies

---

## 🤖 AI Verification Execution Template

```javascript
// 1. Open the application
browser_navigate("http://localhost:18181/")

// 2. Get the initial state
browser_snapshot()

// 3. Open model management
browser_click(element="Model Manager button", ref="model_management_button")
browser_snapshot()

// 4. Check the configuration interface
browser_snapshot()

// 5. Configure the OpenAI model (if allowed)
browser_type(element="API key input box", ref="api_key_input", text="test_api_key")
browser_snapshot()

// 6. Test the connection (if possible)
browser_click(element="Test Connection button", ref="test_connection_button")
browser_wait_for(time=5)
browser_snapshot()

// 7. Save the configuration
browser_click(element="Save button", ref="save_button")
browser_snapshot()

// 8. Close the popup
browser_press_key("Escape")

// 9. Verify the configuration takes effect
browser_snapshot()

// 10. Reopen to verify persistence
browser_click(element="Model Manager button", ref="model_management_button")
browser_snapshot()
```

**Success criteria:**
- The model management interface opens and closes normally
- The configuration features work normally
- The test connection feature responds normally
- The configuration can be saved and loaded correctly
- The main interface correctly reflects configuration changes
- No error messages or abnormal states
