# History Management Normal Flow Test

## 📖 Test Overview
Verify the basic flow of the history management feature, ensuring users can normally view, manage, and reuse prompt optimization history records.

## 🎯 Test Goals
- Verify that the history interface opens normally
- Verify the history display and browsing features
- Verify the history reuse feature
- Verify the history deletion and management features
- Verify the clear-all-history feature

## 📋 Prerequisites
- [ ] The application has started and finished loading
- [ ] The user interface displays correctly
- [ ] There are some prompt optimization history records (or create some first)

---

## 🔧 Test Steps

### Step 1: Create History Records (If None Exist)

**AI execution guidance:**
- If there are no history records, create some first
- Use `browser_type` to enter test prompts
- Use `browser_click` to execute optimization
- Wait for the optimization to complete and create a history record

**Test data:**
```
Test prompt 1: Please help me write a product introduction
Test prompt 2: How to learn programming
Test prompt 3: Make a fitness plan
```

**Expected results:**
- The optimization operation completes successfully
- The history record is saved automatically
- Subsequent history tests can proceed

**Verification points:**
- [ ] The optimization operation succeeds
- [ ] The history record is saved automatically
- [ ] The record contains complete information

---

### Step 2: Open the History Manager

**AI execution guidance:**
- Use `browser_snapshot` to get the current page state
- Find the button containing the "📜" icon and the "History" text
- Use `browser_click` to click that button

**Expected results:**
- The history sidebar or popup opens
- The history list is displayed
- The interface includes function buttons such as search, filter, and clear

**Verification points:**
- [ ] The history interface is displayed
- [ ] The history list loads correctly
- [ ] Function buttons are visible and available
- [ ] The interface layout is clear and reasonable

---

### Step 3: Browse History Records

**AI execution guidance:**
- Use `browser_snapshot` to view the history list content
- Scroll the list to see more records (if needed)
- Click a history record to view details
- Check the display of detailed information

**Expected results:**
- History records are arranged in chronological order (usually newest first)
- Each record shows a timestamp and a prompt summary
- Clicking a record expands it or shows detailed information
- The detailed information includes the original prompt, the optimization result, etc.

**Verification points:**
- [ ] History records are displayed correctly
- [ ] The record ordering is reasonable (by time)
- [ ] The record summary information is accurate
- [ ] The detailed information is fully displayed

---

### Step 4: View Record Details

**AI execution guidance:**
- Select a history record
- View the full detailed information of the record
- Check the original prompt, the optimization result, the template used, etc.
- Verify the completeness and accuracy of the information

**Expected results:**
- The record details are fully displayed
- It includes the original prompt and the optimization result
- The template and model information used are displayed
- The timestamp and other metadata are accurate

**Verification points:**
- [ ] The record details are fully displayed
- [ ] The original prompt is correct
- [ ] The optimization result is complete
- [ ] The metadata information is accurate

---

### Step 5: Reuse a History Record

**AI execution guidance:**
- Select a history record to reuse
- Find buttons such as "Reuse", "Apply", or "Load"
- Use `browser_click` to click the reuse button
- Check whether the main interface has loaded the history record content

**Expected results:**
- The content of the history record is loaded into the main interface
- The original prompt is filled into the input box
- The optimization result is displayed in the result area
- The related template and model settings are also applied

**Verification points:**
- [ ] The reuse operation is executed successfully
- [ ] The original prompt is loaded correctly
- [ ] The optimization result is displayed correctly
- [ ] The template and model settings are applied correctly

---

### Step 6: Search History Records (If Supported)

**AI execution guidance:**
- Find the search input box
- Use `browser_type` to enter search keywords
- Check the changes in the search results
- Clear the search box to verify the list is restored

**Test data:**
```
Search keywords: product, programming, fitness, etc.
```

**Expected results:**
- The search feature can filter records by keyword
- Search results accurately match the keywords
- The complete list is displayed after clearing the search
- The search response speed is reasonable

**Verification points:**
- [ ] The search feature works normally
- [ ] Search results are accurate
- [ ] The search clear feature works normally
- [ ] Search performance is good

---

### Step 7: Delete a Single History Record

**AI execution guidance:**
- Select a history record
- Find the delete button (trash icon or "Delete" text)
- Use `browser_click` to click the delete button
- Handle the confirmation dialog (if any)
- Verify the record has been deleted

**Expected results:**
- A delete confirmation dialog is displayed
- After confirmation, the record is removed from the list
- A delete success prompt is displayed
- The list updates correctly

**Verification points:**
- [ ] The delete confirmation dialog appears
- [ ] The delete operation is executed successfully
- [ ] The record is removed from the list
- [ ] The interface updates correctly

---

### Step 8: Test Clearing All History Records

**AI execution guidance:**
- Find buttons such as "Clear", "Clear All", or "Delete All Data"
- Use `browser_click` to click the clear button
- Handle the confirmation dialog
- Verify the clear result (but it is recommended to cancel the operation to keep the test data)

**Expected results:**
- A clear confirmation dialog with a warning message is displayed
- The confirmation dialog message is clear and states that the operation cannot be undone
- The clear operation responds normally
- A clear-related prompt is displayed

**Verification points:**
- [ ] The clear confirmation dialog appears
- [ ] The confirmation dialog contains an appropriate warning
- [ ] The clear operation responds normally
- [ ] The prompt message is clear

---

### Step 9: Test History Sorting

**AI execution guidance:**
- Check how the history records are sorted
- Find the sort options (if any)
- Test different sort methods
- Verify the correctness of the sort results

**Expected results:**
- Sorted by time in descending order by default
- The sort options work normally (if any)
- The sort results are accurate
- Sort switching is smooth

**Verification points:**
- [ ] The default sort is correct
- [ ] The sort options work normally (if any)
- [ ] The sort results are accurate
- [ ] The sort operation is smooth

---

### Step 10: Close the History Interface

**AI execution guidance:**
- Find the close button (usually an X icon)
- Use `browser_click` to click the close button
- Or click the area outside the interface to close it
- Verify the interface has closed

**Expected results:**
- The history interface closes
- The view returns to the main interface
- The main interface features are normally available

**Verification points:**
- [ ] The history interface closes successfully
- [ ] The view returns to the main interface
- [ ] The main interface state is normal
- [ ] Other features are not affected

---

## ⚠️ Common Problem Checks

### Interface Display Problems
- The history interface cannot be opened
- The record list displays abnormally
- The detailed information is displayed incompletely
- Layout disorder

### Feature Operation Problems
- The reuse feature is abnormal
- The search feature is inaccurate
- The delete operation fails
- The sort feature is abnormal

### Data Management Problems
- History records are lost
- Record information is incomplete
- Wrong timestamps
- Data loading fails

---

## 🤖 AI Verification Execution Template

```javascript
// 1. Open the application
browser_navigate("http://localhost:18181/")

// 2. Create history records (if needed)
browser_type(element="Original prompt input box", ref="e54", text="Test history")
browser_click(element="Start optimization button", ref="e78")
browser_wait_for(time=10)

// 3. Open history
browser_click(element="History button", ref="history_button")
browser_snapshot()

// 4. Browse history records
browser_snapshot()

// 5. View record details
browser_click(element="History record item", ref="history_item")
browser_snapshot()

// 6. Reuse a history record
browser_click(element="Reuse button", ref="reuse_button")
browser_snapshot()

// 7. Search history records (if supported)
browser_type(element="Search box", ref="search_input", text="test")
browser_snapshot()

// 8. Clear the search
browser_type(element="Search box", ref="search_input", text="")
browser_snapshot()

// 9. Delete a record
browser_click(element="Delete button", ref="delete_button")
browser_snapshot()

// 10. Test the clear feature
browser_click(element="Clear button", ref="clear_button")
browser_snapshot()
browser_press_key("Escape") // Cancel the clear operation

// 11. Close the history interface
browser_press_key("Escape")
browser_snapshot()
```

**Success criteria:**
- The history interface opens and closes normally
- History records are displayed and loaded correctly
- The reuse feature works normally
- Search and filter features work normally (if supported)
- The delete feature works normally
- The clear feature has an appropriate confirmation mechanism
- All interactive features work as expected
- No error messages or abnormal states
