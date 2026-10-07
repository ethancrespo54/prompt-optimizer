# Model Addition and Connection Test

## 📖 Test Overview
Verify the complete flow of adding a new model and testing the model connection, ensuring users can successfully add a local or remote AI model and verify its availability.

## 🎯 Test Goals
- Verify the complete flow of adding a new model
- Verify that the model connection test is genuinely effective
- Verify integration of the local Ollama model
- Verify the model list fetching feature
- Verify the model enable and disable features

## 📋 Prerequisites
- [ ] The application has started and finished loading
- [ ] The local Ollama service is running (http://localhost:11434)
- [ ] Ollama has the qwen3:0.6b model installed
- [ ] The network connection is normal

---

## 🔧 Test Steps

### Step 1: Open the Model Manager and Add a New Model

**AI execution guidance:**
- Use `browser_snapshot` to get the current page state
- Click the "⚙️ Model Manager" button to open model management
- Click the "Add" button to start adding a new model

**Expected results:**
- The model management interface opens correctly
- The add model dialog is displayed
- All input fields are visible and editable

**Verification points:**
- [ ] The model management interface opens correctly
- [ ] The Add button works normally
- [ ] The add model dialog is displayed correctly

---

### Step 2: Configure the Local Ollama Model

**AI execution guidance:**
- Enter "Local Ollama" in the Display Name field
- Enter "http://localhost:11434/v1" in the API URL field
- Click the "Click arrow to fetch model list" button to fetch the available models
- Select the "qwen3:0.6b" model from the dropdown list
- No API Key is needed (local model)

**Test data:**
```
Display Name: Local Ollama
API URL: http://localhost:11434/v1
Model Name: your-model-name (select from the list, e.g. qwen2.5:0.5b)
API Key: (leave empty)
```

**Expected results:**
- All fields accept input correctly
- The model list is fetched successfully and shows the available models
- The target model appears in the selection list
- The configuration interface responds normally

**Verification points:**
- [ ] Display Name input works normally
- [ ] API URL input works normally
- [ ] The model list fetching feature works normally
- [ ] The model selection feature works normally
- [ ] Configuration without an API Key is handled correctly

---

### Step 3: Save the Model Configuration

**AI execution guidance:**
- Check that all configuration information is correct
- Click the "Save" button to save the configuration
- Wait for the save operation to complete
- Confirm that the view returns to the main model management interface

**Expected results:**
- The save operation completes successfully
- The newly added model appears in the model list
- The model status is shown as configurable
- The interface updates correctly

**Verification points:**
- [ ] The save operation succeeds
- [ ] The new model appears in the list
- [ ] The model information is displayed correctly
- [ ] The interface state updates correctly

---

### Step 4: Test the Model Connection

**AI execution guidance:**
- Find the newly added "Local Ollama" model
- Click the corresponding "Test Connection" button
- Wait for the connection test to complete
- Observe the display of the test result

**Expected results:**
- The Test Connection button responds normally
- A state showing the connection test in progress is displayed
- The connection test completes successfully
- A successful connection result is displayed

**Verification points:**
- [ ] The Test Connection button works normally
- [ ] The connection test process state is clear
- [ ] The connection test completes successfully
- [ ] The success result is clearly displayed

---

### Step 5: Enable the Model

**AI execution guidance:**
- Click the "Enable" button to enable the model
- Wait for the enable operation to complete
- Check the change in model state
- Confirm the model is available

**Expected results:**
- The enable operation completes successfully
- The model state updates to enabled
- The Enable button changes to a Disable button
- The model can be selected on the main interface

**Verification points:**
- [ ] The enable operation succeeds
- [ ] The model state updates correctly
- [ ] The button state changes correctly
- [ ] The model is selectable on the main interface

---

### Step 6: Verify the Model Is Available on the Main Interface

**AI execution guidance:**
- Close the model management dialog
- Check the model selector on the main interface
- Confirm the newly added model appears in the options
- Try selecting that model

**Expected results:**
- The model selector on the main interface contains the new model
- The model name is displayed correctly
- The model can be selected successfully
- The model status is shown as available

**Verification points:**
- [ ] The new model appears in the selector on the main interface
- [ ] The model name is displayed correctly
- [ ] The model selection feature works normally
- [ ] The model status is displayed correctly

---

### Step 7: Test the Model's Actual Functionality

**AI execution guidance:**
- Select the newly added local model
- Enter simple test content in the prompt input box
- Click the optimize button to perform an actual test
- Observe whether a real AI response is obtained

**Test data:**
```
Test prompt: "Please help me write a simple greeting"
```

**Expected results:**
- The model is selected successfully
- The optimize button becomes available
- A request can be sent to the local model
- A real AI response is obtained

**Verification points:**
- [ ] The model is selected successfully
- [ ] The optimization feature is available
- [ ] The request is sent successfully
- [ ] A real AI response is obtained

---

## ⚠️ Common Problem Checks

### Ollama Service Problems
- The Ollama service is not running
- The model is not installed or downloaded
- Port conflicts or access permission issues
- Incompatible API interface

### Model Addition Problems
- Fetching the model list fails
- Network connection issues
- Incorrect API URL format
- Incorrect model name

### Connection Test Problems
- Connection timeout
- Authentication failure
- Model unavailable
- Abnormal service response

### Feature Integration Problems
- The model does not appear on the main interface
- Features are unavailable after selecting the model
- Optimization request fails
- Response format error

---

## 🤖 AI Verification Execution Template

```javascript
// 1. Open model management
browser_click(element="Model Manager button", ref="model_management_button")
browser_snapshot()

// 2. Add a new model
browser_click(element="Add button", ref="add_model_button")
browser_snapshot()

// 3. Configure the Ollama model
browser_type(element="Display Name", ref="display_name", text="Local Ollama")
browser_type(element="API URL", ref="api_url", text="http://localhost:11434/v1")
browser_click(element="Fetch model list button", ref="fetch_models_button")
browser_wait_for(time=3)
browser_select(element="Model select", ref="model_select", value="qwen3:0.6b")
browser_snapshot()

// 4. Save the configuration
browser_click(element="Save button", ref="save_button")
browser_wait_for(time=2)
browser_snapshot()

// 5. Test the connection
browser_click(element="Test Connection button", ref="test_connection_button")
browser_wait_for(time=5)
browser_snapshot()

// 6. Enable the model
browser_click(element="Enable button", ref="enable_button")
browser_wait_for(time=2)
browser_snapshot()

// 7. Verify the main interface
browser_click(element="Close button", ref="close_button")
browser_snapshot()

// 8. Test actual functionality
browser_click(element="Model selector", ref="model_selector")
browser_click(element="Local Ollama", ref="local_ollama_option")
browser_type(element="Prompt input box", ref="prompt_input", text="Please help me write a simple greeting")
browser_click(element="Optimize button", ref="optimize_button")
browser_wait_for(time=10)
browser_snapshot()
```

**Success criteria:**
- The local Ollama model can be added successfully
- The model connection test is genuinely effective
- The model is displayed and selectable correctly on the main interface
- A real AI response can be obtained
- The entire flow has no errors or exceptions
- The model configuration is saved persistently

---

## 📝 Important Notes

### Why Real Model Testing Is Needed
1. **Feature verification**: Ensure the application can communicate normally with real AI services
2. **Integration testing**: Verify the complete flow from configuration to use
3. **Performance testing**: Check actual response time and stability
4. **Error handling**: Test the ability to handle various abnormal situations

### Advantages of Local Ollama
1. **No API Key needed**: Avoids the security risk of using real API keys
2. **Stable and controllable**: The local service is not affected by network fluctuations
3. **Cost-effective**: No need to consume paid API quota
4. **Privacy protection**: Test data is not sent to external services

### Test Data Security
- Using local models avoids leaking sensitive data
- Test prompts should be harmless, generic content
- Do not use real business data in tests
