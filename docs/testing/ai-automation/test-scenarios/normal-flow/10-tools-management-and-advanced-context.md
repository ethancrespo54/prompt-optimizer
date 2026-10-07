# Tools Management and Advanced Context Test (Normal Flow)

## 📖 Test Overview
Verify adding/editing/deleting tool definitions (function tools) in a context and their linkage with Advanced Mode:
tool count display, exports including tools, and tests running stably on the "with tools" path.

## 🎯 Test Goals
- The tools management page can add/edit/delete tools
- The conversation area shows a tool count badge (toolCount)
- Exported data includes a `tools` array
- In advanced mode, starting a test goes through the "with tools" call path, stable and error-free

## 📋 Prerequisites
- [ ] The application is running normally
- [ ] The "Context Editor" can be opened
- [ ] At least one available model is configured (if actual streaming tests are needed)
- [ ] The advanced mode switch is available (in navigation/settings)

---

## 🔧 Test Steps

### Step 1: Add a Tool Definition
**AI execution guidance:**
- Open the "Context Editor"
- Switch to the "Tools" management page (or enable the tool management area)
- Click "Add Tool", and create using a template or manually:
```json
{
  "type": "function",
  "function": {
    "name": "get_weather",
    "description": "Get weather for a location",
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

**Expected results:**
- `get_weather` appears in the tool list without format errors

**Verification points:**
- [ ] The tool entry renders normally (shows the function name)
- [ ] No parameter JSON parse error appears

---

### Step 2: Tool Count Display in the Conversation Area
**AI execution guidance:**
- Close the editor and return to "Conversation Management"
- Use `browser_snapshot` to check whether the top badge shows "Tools: 1" (the text follows i18n)

**Expected results:**
- A tool count label (tools.count) is shown at the conversation area title

**Verification points:**
- [ ] The tool count badge appears and its value = 1

---

### Step 3: Export Includes tools (Structure Validation)
**AI execution guidance:**
- Open the "Context Editor" again and open "Export"
- Select "Standard Format", run "Copy to Clipboard" or "Export to File"
- Parse the JSON and check `tools`

**Expected results:**
- The `tools` field exists and the array length ≥ 1
- `tools[0].function.name === "get_weather"`

**Verification points:**
- [ ] The `tools` array exists and is non-empty
- [ ] The first function name is `get_weather`

---

### Step 4: Test Path with Tools (Advanced Mode)
**AI execution guidance:**
- Turn on "Advanced Mode"
- Prepare a system/user message
- Click "Start Test / Run Test"
- Use `browser_console_messages` to observe whether the custom conversation flow is reached (logs related to "with tools" may be printed)
- If the model actually returns a tool call, observe whether a "Tool Calls" list appears in the test area (TestAreaPanel ToolCallDisplay)

**Expected results:**
- Starting the test produces no errors (even if no tool call is generated)
- If a tool call is generated, the test result area should show a tool call card

**Verification points:**
- [ ] The test starts normally in advanced mode without errors
- [ ] (Optional) A tool call list or related logs appear

---

### Step 5: Edit/Delete Tool Stability
**AI execution guidance:**
- In the "Tools" management page, edit the description or parameters of `get_weather` (for example, add a required field)
- Delete the tool and return to the conversation area

**Expected results:**
- The export structure changes accordingly after editing
- After deletion, the tool count badge in the conversation area disappears or its value decreases

**Verification points:**
- [ ] The exported `tools` content updates in sync after editing
- [ ] After deletion, the tool count badge matches reality

---

## 🧪 Diagnostic Suggestions (On Failure)
- Tool cannot be saved: check whether the JSON parameters conform to the schema (type/properties/required)
- Tool count not updated: check whether state is passed correctly between parent and child components (`@update:state/contextChange`)
- Test cannot start: confirm that advanced mode is enabled and tools exist; check the model configuration and network permissions

---

## ✅ Success Criteria
- Tool management is consistent with the UI display, and the export includes tools
- Tests can run stably with tools in advanced mode (generating a tool call is not required)
- No error popups or fatal logs throughout the flow
