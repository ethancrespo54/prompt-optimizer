# Context Collection Import/Export Test (Normal Flow)

## 📖 Test Overview
Verify the availability and consistency of ContextRepo "context collection" import/export under normal flows. The focus covers DataManager export to file/clipboard, import from file/clipboard (replace mode), import statistics (including the count of removed predefined variables), and recovery after refreshing following import.

## 🎯 Test Goals
- Confirm that the context collection can be successfully exported to a file and the clipboard
- Confirm that the context collection can be imported from a file and the clipboard (replace mode)
- Validate the import statistics fields: imported/skipped/predefinedVariablesRemoved
- After importing and refreshing the page, the data and currentId are restored to the state specified by the import bundle

## 📋 Prerequisites
- [ ] The application can start normally
- [ ] The "Data Manager / DataManager" popup can be opened
- [ ] There is basic context data, or it can be quickly created through ContextEditor

---

## 🔧 Test Steps

### Step 1: Prepare Recognizable Context Data
**AI execution guidance:**
- Create a recognizable context through "Conversation Management + Context Editor" (2 messages + 2 variables + 1 optional tool)
- Example (messages):
  - system: `You are an assistant, task={{task}}`
  - user: `Please handle {{task}}, scenario={{scene}}`
- Example (variables): `task=Export Test`, `scene=Normal Flow`
- Optional: tool `get_weather`

**Expected results:**
- The conversation area shows the variable and (optional) tool count badges

**Verification points:**
- [ ] The variable statistics count is correct
- [ ] (Optional) The tool count badge is displayed

---

### Step 2: Export the Context Collection to a File
**AI execution guidance:**
- Open the "Data Management" popup (icon "💾" / "Data Management")
- Click "Export Contexts to File" (Context Export → File)
- Wait for the download to complete

**Expected results:**
- A download of `contexts-backup-YYYY-MM-DD.json` is triggered
- A toast shows "Exported X context collections to file"

**Verification points:**
- [ ] The downloaded file exists and is non-empty
- [ ] The JSON parses successfully and contains `type/context-bundle`, `version`, `currentId`, `contexts`

---

### Step 3: Export the Context Collection to the Clipboard
**AI execution guidance:**
- In Data Management, click "Export to Clipboard" (Context Export → Clipboard)
- Read the clipboard content as text and parse it

**Expected results:**
- The copy succeeds and a toast shows "Exported X context collections to clipboard"
- The JSON structure is consistent with the file export

**Verification points:**
- [ ] The clipboard content is non-empty and can be parsed as JSON
- [ ] The structure fields are complete: `type/version/currentId/contexts`

---

### Step 4: Construct an Import Bundle with Predefined Variable Overrides (for Verifying Removal)
**AI execution guidance:**
- Using the exported JSON from "Step 2/3" as a template, pick one `contexts[i]` and inject any one or more of the following key-value pairs into its `variables` (examples):
  - `currentPrompt: "Should not be saved"`
  - `originalPrompt: "Should not be saved"`
  - `userQuestion: "Should not be saved"`
- Make sure the JSON is still valid, and save it as a temporary file or copy it to the clipboard

**Expected results:**
- An import bundle "containing predefined variable name overrides" is prepared

**Verification points:**
- [ ] The context JSON in the file or clipboard can be parsed
- [ ] It contains at least 1 predefined variable key

---

### Step 5: Import the Context Collection from a File (Replace Mode)
**AI execution guidance:**
- In the Data Management popup, use the "Import Contexts (File)" button to select the temporary file from "Step 4"
- Wait for the import to complete and the toast statistics prompt

**Expected results:**
- The import succeeds, and the toast text contains:
  - The imported count (imported)
  - The skipped count (skipped, can be 0 if there are no errors)
  - The count of removed predefined variable overrides (predefinedVariablesRemoved ≥ 1)
- If the app runs on the Web, a page refresh may be triggered after a successful import (or by the parent layer upon "import all data"); this context import scenario does not require a forced refresh.

**Verification points:**
- [ ] A prompt like "Success: imported X contexts, ... removed Y predefined variable overrides" appears
- [ ] After import, the corresponding variables in the "Context Editor" do not contain the injected predefined keys (such as `currentPrompt`)

---

### Step 6: Import the Context Collection from the Clipboard (Replace Mode)
**AI execution guidance:**
- Click "Import Contexts (Clipboard)", put the JSON from "Step 4" into the clipboard, and run it
- Repeat the checks of the "Expected results / Verification points"

**Expected results:**
- Same as "Step 5": the statistics are correct and the predefined variables are removed

**Verification points:**
- [ ] `predefinedVariablesRemoved` in the statistics is greater than 0
- [ ] The variables tab and preview do not contain the forbidden key names

---

### Step 7: Recovery After Refresh Following Import (Optional)
**AI execution guidance:**
- Refresh the page manually (or press F5)
- Open the "Context Editor" and check whether the messages and variables match the import bundle
- If the import bundle's `currentId` points to a specific context, verify that the current context content matches it

**Expected results:**
- After the refresh, the imported context collection and current selection are still retained

**Verification points:**
- [ ] The messages/variables match the import bundle
- [ ] The current content matches what `currentId` points to

---

## 🧪 Diagnostic Suggestions (On Failure)
- Import fails: check whether the JSON structure satisfies `type/context-bundle`, `version`, `currentId`, `contexts[]`
- Removal count is 0: confirm that predefined variable keys were actually injected (`currentPrompt/originalPrompt/userQuestion/iterateInput/lastOptimizedPrompt/conversationContext`)
- Not effective after refresh: confirm whether you need to wait for the UI's import completion prompt; if using the "import all data" flow, the parent layer may trigger a refresh

---

## ✅ Success Criteria
- Both file and clipboard exports work, with correct structure
- Both file and clipboard imports (replace) succeed, with correct statistics and predefined variable overrides removed
- State is retained after refresh, with data and currentId consistent
