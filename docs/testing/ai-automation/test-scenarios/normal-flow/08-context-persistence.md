# Context Management and Persistence Test (Normal Flow)

## 📖 Test Overview
Verify the complete chain of ContextRepo-based context from editing → persistence → refresh recovery, covering normal flows such as saving messages and variables, default context initialization, and basic export checks.

## 🎯 Test Goals
- Confirm that the default context exists and is editable
- Verify that ContextEditor changes are persisted immediately
- Verify that context data can be restored after refreshing the page
- Basic export content structure is correct (context-bundle)

## 📋 Prerequisites
- [ ] The application starts normally (either Web or Electron desktop)
- [ ] Basic features are available (the optimization page and the context editor can be opened)
- [ ] If running the export flow, the browser must allow download/clipboard permissions

---

## 🔧 Test Steps

### Step 1: Prepare and Open the Context Editor
**AI execution guidance:**
- Use `browser_snapshot` to locate the "Conversation Management / Session Management" area
- If there are no messages, click "Add Message" to create at least 1
- Click the "Open Editor" button and wait for the fullscreen ContextEditor to appear

**Expected results:**
- The conversation area shows a message count and variable statistics badge
- After clicking "Open Editor", a popup titled "Context Editor" appears

**Verification points:**
- [ ] The "message count" label is shown at the top
- [ ] The "Open Editor" button exists and is clickable
- [ ] The popup renders normally without layout disorder

---

### Step 2: Edit Messages and Trigger Persistence
**AI execution guidance:**
- In the "Messages" tab:
  - Set the content of the first message to: `System: You are a helpful assistant, your task is {{task}}` (system)
  - Add a user message: `Please help me complete {{task}}, scenario: {{scene}}`
- Use `browser_wait_for` to wait for the interface to stabilize

**Expected results:**
- ContextEditor triggers the `update:state/contextChange` event, and the parent layer should write to ContextRepo immediately
- The variable statistics show the two variables task and scene

**Verification points:**
- [ ] The variable statistics count is 2 (position is not enforced, only existence is checked)
- [ ] No error prompts or abnormal interactions

---

### Step 3: Add Overrides in the Variables Tab and Save Again
**AI execution guidance:**
- Switch to the "Variables / Context Variables" tab
- Click "Add Variable" and create:
  - `task = Integration Test`
  - `scene = Normal Flow`
- Close the editor (or keep it open)

**Expected results:**
- The context variable overrides are written to the persistence layer
- After returning to the conversation area, the missing variable count should be 0

**Verification points:**
- [ ] The variables tab shows 2 override items
- [ ] The missing variable label in the conversation area disappears

---

### Step 4: Refresh Recovery Verification
**AI execution guidance:**
- Refresh the page (`browser_navigate` to the same route, or use `browser_press_key` to run the refresh shortcut)
- After returning to the optimization page, repeat the operation of "Step 1" to open the ContextEditor

**Expected results:**
- After the refresh, the two previous messages and two variable overrides are still visible
- The variable statistics and missing count are consistent with those before the refresh

**Verification points:**
- [ ] The message count and content are consistent with those before the refresh
- [ ] The variable overrides are consistent with those before the refresh
- [ ] Nothing is lost or reverted to the initial state

---

### Step 5: Basic Export Check (Structure Validation)
**AI execution guidance:**
- Open the "Export" dialog in the ContextEditor and select "Standard Format"
- Run "Copy to Clipboard" or "Export to File"
- Read the exported content (clipboard or file) and parse the JSON

**Expected results:**
- The exported data's metadata.variables and messages fields are complete
- If a tools field is included, it should be an array (can be empty)

**Verification points:**
- [ ] `messages` is an array with length ≥ 2
- [ ] `metadata.variables.task === "Integration Test"`
- [ ] `metadata.variables.scene === "Normal Flow"`
- [ ] The `tools` field exists (an array, can be empty)

---

## 🧪 Diagnostic Suggestions (On Failure)
- If data is lost after refresh: check whether `ContextRepo.update/ save` is called (via console logs or IPC calls)
- If the export is empty: confirm that `setData` was called before exporting, or check whether the export format selection is correct
- If the missing variable statistics are abnormal: confirm that variable names and placeholder casing match exactly

---

## ✅ Success Criteria
- Edit → persist → restore after refresh is complete and consistent
- The export structure is correct and can be imported again (replace mode)
- No frontend errors and no blocking warnings throughout the flow
