# Full Optimization and Testing Flow for Variables/Context/Tools (Normal Flow)

## 📖 Test Overview
In "Advanced Mode", variables (global + context overrides), context messages (system/user), and tools (function tools) participate together in optimization and testing, verifying the end-to-end chain:
- Data preparation (variables/context/tools)
- Enable advanced mode and run optimization (system and/or user mode)
- Run tests (Compare mode, tool call display)
- Consistency of preview and missing statistics, completeness of exported data

## 🎯 Test Goals
- In advanced mode, the optimization request includes variables/messages/tools
- Compare tests can run and the result display is stable
- If a tool call occurs, it is displayed/recorded correctly in TestAreaPanel
- Variable replacement and missing statistics are consistent, and context overrides take precedence
- Exported data includes tools and variable metadata

## 📋 Prerequisites
- [ ] The application is running normally and the model configuration is done (an available test model)
- [ ] Network access is allowed (to run real optimization/tests)
- [ ] The differences between "System Prompt Optimization" and "User Prompt Optimization" are understood

---

## 🔧 Test Steps

### Step 1: Prepare Global Variables (VariableManager)
**AI execution guidance:**
- Open the global variable manager (VariableManager) and add:
  - `name = GlobalName`
  - `scene = Global Scene`
- Record the current number of global variables

**Expected results:**
- `name` and `scene` appear in the variable list

**Verification points:**
- [ ] The variable count is correct and the added variables persist

---

### Step 2: Prepare the Context (ContextEditor → Messages)
**AI execution guidance:**
- Add messages in conversation management and "Open Editor" to enter ContextEditor:
  - system: `You are a professional assistant, name={{name}}, role={{role}}`
  - user: `Please complete {{task}} under {{scene}}, and provide steps`
- Add context overrides in the variables tab:
  - `name = Alice` (so that it overrides the global value `GlobalName`)
  - `role = System Assistant`
  - `task = Advanced Flow Verification`

**Expected results:**
- The variable statistics have at least 3 items
- In the preview, `name` uses the context override (Alice) instead of the global one (GlobalName)

**Verification points:**
- [ ] Missing variables are 0 (`name/role/scene/task` all have a source: scene comes from global)
- [ ] The preview replacement leaves no `{{…}}` remnants

---

### Step 3: Prepare Tools (ContextEditor → Tools Management)
**AI execution guidance:**
- Add a tool definition in the tools page:
```json
{
  "type": "function",
  "function": {
    "name": "get_weather",
    "description": "Get current weather for a location",
    "parameters": {
      "type": "object",
      "properties": {
        "location": { "type": "string" },
        "unit": { "type": "string", "enum": ["celsius", "fahrenheit"], "default": "celsius" }
      },
      "required": ["location"]
    }
  }
}
```
- Close the editor and return to the conversation management area, and check the tool count badge (tools.count)

**Expected results:**
- `get_weather` appears in the tool list
- The top badge shows tool count = 1

**Verification points:**
- [ ] The tool JSON is saved without errors
- [ ] The tool count is displayed correctly

---

### Step 4: Enable Advanced Mode and Run "Optimize"
**AI execution guidance:**
- Turn on the "Advanced Mode" switch (Advanced Mode)
- Select an optimization template (either system or user mode works; it is recommended to use system mode first)
- Click "Optimize"
- Use `browser_console_messages` to capture log keywords:
  - `[App] Optimizing with advanced context:` or
  - `[usePromptOptimizer] Starting optimization with advanced context:`

**Expected results:**
- The console shows "advanced context" logs containing a brief summary of variables/messages/tools
- After the optimization finishes, the optimization result is displayed on the right (if Compare mode is on, it serves as the "Optimized Result" area)

**Verification points:**
- [ ] The above logs appear (indicating the advanced context is carried)
- [ ] The optimization result area renders stably without error popups

---

### Step 5: Run "Test" (Compare Mode)
**AI execution guidance:**
- Enter test content in TestAreaPanel (as user input in system mode; can be empty or custom in user mode)
- Click "Start Test", run the "Original" first, then the "Optimized"
- If there is a tool call: the console will print `test tool call received`, or a "Tool Calls" list (ToolCallDisplay) appears in the panel

**Expected results:**
- The result areas on both sides (or the single column) update without abnormalities
- If the model triggers a tool call, the panel shows the tool call item

**Verification points:**
- [ ] Test start and completion logs exist (such as `[App] original/optimized test completed`)
- [ ] (Optional) The tool call list is displayed or the `test tool call received` log appears

---

### Step 6: Consistency and Replacement Check
**AI execution guidance:**
- Check that the preview/missing statistics are consistent with the variable replacement during testing:
  - `name` should be Alice (context override takes precedence)
  - `scene` should come from global (GlobalName is not used for the scene)
  - No override items with predefined variable names (such as `currentPrompt`) should appear

**Expected results:**
- The finalVars merge strategy takes effect: `final = global ∪ contextOverrides`, with predefined names removed
- The variable replacement in the preview, missing statistics, and test results is consistent

**Verification points:**
- [ ] The ContextEditor statistics match the actual replacement
- [ ] No predefined key override items are saved

---

### Step 7: Export Validation (Standard Format)
**AI execution guidance:**
- Open "Export" in ContextEditor and select "Standard Format"
- Run "Copy to Clipboard" or "Export to File", and parse the JSON:
  - `messages` is an array
  - `metadata.variables` contains `name/role/task/scene`
  - `tools[0].function.name === 'get_weather'`

**Expected results:**
- The export structure is complete and can be used for subsequent import

**Verification points:**
- [ ] `messages.length >= 2`
- [ ] `metadata.variables` contains this configuration
- [ ] The `tools` array exists and contains `get_weather`

---

## 🧪 Diagnostic Suggestions (On Failure)
- The "advanced context" log does not appear: confirm that advanced mode is enabled and that non-empty messages/variables/tools exist
- Test has no output: check model availability, network, and console errors
- Tool calls are not displayed: triggering is not mandatory; watch for related logs
- Wrong variable priority: check whether the global and context overrides share the same name, and confirm the override takes precedence

---

## ✅ Success Criteria
- Advanced mode optimization and testing are available and stable
- The whole chain of variables/messages/tools takes effect
- The preview/missing statistics/test replacement are consistent
- The export structure is complete (including tools and variable metadata)
