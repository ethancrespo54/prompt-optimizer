# Context Variables and Preview Consistency Test (Normal Flow)

## 📖 Test Overview
Verify the "add/edit/delete" operations of variable management within a context, the protection of predefined variable names, and the consistent impact of the finalVars merge strategy on the preview and missing-variable statistics.

## 🎯 Test Goals
- Adding, editing, and deleting variable overrides works normally
- Predefined variable names cannot be saved as overrides
- finalVars = availableVariables ∪ context.variables (predefined names are automatically removed)
- The preview result is consistent with the missing-variable statistics

## 📋 Prerequisites
- [ ] The application is running normally
- [ ] The "Variable Manager" (global variables) and the "Context Editor" (context overrides) can be opened
- [ ] To verify global→context override, first create a variable with the same name globally

---

## 🔧 Test Steps

### Step 1: Prepare Messages and Open the Context Editor
**AI execution guidance:**
- Add messages in the conversation area:
  - system: `System: role={{role}}`
  - user: `Hello {{name}}, the scenario is {{scene}}, current prompt={{currentPrompt}}`
- Open the "Context Editor"

**Expected results:**
- The variable statistics include at least `role/name/scene/currentPrompt`
- The missing variable prompt includes `role/name/scene` (if not yet provided globally); `currentPrompt` depends on whether a predefined value is built in globally

**Verification points:**
- [ ] The variable statistics count matches the placeholders in the messages
- [ ] The missing variable list matches the actually unassigned variables

---

### Step 2: Add Context Variable Overrides
**AI execution guidance:**
- Switch to the "Variables" tab and add:
  - `name = Alice`
  - `scene = Normal Flow`
  - `role = System Assistant`

**Expected results:**
- The three override items are created successfully
- After returning to the "Messages" tab and switching to preview, the placeholders are replaced correctly

**Verification points:**
- [ ] The variable override count = 3
- [ ] The preview text contains no `{{name}}/{{scene}}/{{role}}` strings
- [ ] The missing variable count decreases or is 0 (depending on whether `currentPrompt` is provided globally)

---

### Step 3: Predefined Variable Name Protection Check
**AI execution guidance:**
- In the "Variables" tab, try to add or edit a variable with any of the following names:
  - `currentPrompt` / `originalPrompt` / `lastOptimizedPrompt` / `iterateInput` / `userQuestion` / `conversationContext`
- Observe the save button and the prompt text

**Expected results:**
- The save button should be disabled or the operation blocked
- A "Predefined variables cannot be overridden" prompt (or a disabled-state explanation) is shown

**Verification points:**
- [ ] Predefined variable names cannot be saved as context overrides
- [ ] The UI gives clear disabled/prompt feedback

---

### Step 4: global→context Override Priority (Optional)
**AI execution guidance:**
- Open the "Variable Manager" (global) and add: `name = Bob`
- Keep `name = Alice` in the "Context Variables"
- Return to the "Messages" tab and switch to "Preview"

**Expected results:**
- finalVars = global ∪ context overrides, where the context override with the same name takes precedence
- The preview should show `Alice` (not `Bob`)

**Verification points:**
- [ ] The value of `name` in the preview follows the context override
- [ ] The missing variable statistics are not affected by this override relationship (still computed from finalVars)

---

### Step 5: Deletion and Fallback Check
**AI execution guidance:**
- Delete the `scene` override item
- Return to the "Messages" tab and switch to preview

**Expected results:**
- If `scene` is not provided globally, the `{{scene}}` placeholder reappears in the preview and the missing count increases by 1
- If `scene` is provided globally, the preview shows the global value and the missing count is unchanged

**Verification points:**
- [ ] After deleting the override, the preview and missing statistics change in sync
- [ ] No abnormal errors or freezing

---

## 🧪 Diagnostic Suggestions (On Failure)
- Predefined names can still be saved: check whether the UI correctly references PREDEFINED_VARIABLES (consistent between core and ui)
- Inconsistent preview: check the `finalVars` merge logic in ContextEditor and the `replaceVariables` call
- Abnormal missing statistics: confirm the statistics are uniformly based on `finalVars` (the UI implements this, so they should be consistent)

---

## ✅ Success Criteria
- Adding, editing, and deleting variable overrides works stably, and predefined names are strictly controlled
- The preview and missing statistics are always consistent with finalVars
- No abnormal logs and no interaction blocking
