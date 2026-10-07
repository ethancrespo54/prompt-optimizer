# Template Management Normal Flow Test

## 📖 Test Overview
Verify the basic flow of the template management feature, ensuring users can normally view, create, edit, and manage optimization templates.

## 🎯 Test Goals
- Verify that the template management interface opens normally
- Verify the template browsing and viewing features
- Verify the template creation and editing features
- Verify the template category and management features
- Verify the built-in template language switching feature

## 📋 Prerequisites
- [ ] The application has started and finished loading
- [ ] The user interface displays correctly
- [ ] Basic template concepts are understood

---

## 🔧 Test Steps

### Step 1: Open the Template Manager

**AI execution guidance:**
- Use `browser_snapshot` to get the current page state
- Find the button containing the "📝" icon and the "Templates" text
- Use `browser_click` to click that button

**Expected results:**
- The template management dialog pops up
- The dialog title shows "Template Management" or "Templates"
- The interface shows the existing template list and management options

**Verification points:**
- [ ] The template management popup is displayed
- [ ] The popup title is displayed correctly
- [ ] The template list or category options are visible
- [ ] The interface includes operation buttons such as add and edit

---

### Step 2: Browse Existing Templates

**AI execution guidance:**
- Use `browser_snapshot` to view the template list content
- Find the template category tabs or filter options
- Click different categories to see how the templates change
- Select a template item to view its details

**Expected results:**
- Templates are displayed correctly by category
- Each template shows basic information such as name and description
- Clicking a category tab filters the display to the corresponding templates
- Selecting a template shows its detailed content

**Verification points:**
- [ ] The template list is displayed correctly
- [ ] The category filter feature works normally
- [ ] Template information is displayed completely
- [ ] The template selection feature works normally

---

### Step 3: View Template Details

**AI execution guidance:**
- Select an existing template
- View the template's detailed information
- Check the template content, description, type, and other information
- Test the template preview feature (if available)

**Expected results:**
- The template's detailed information is fully displayed
- The template content is correctly formatted
- The template type and description are accurate
- The preview feature works normally (if supported)

**Verification points:**
- [ ] The template details are displayed correctly
- [ ] The template content format is correct
- [ ] The type and description are accurate
- [ ] The preview feature works normally (if available)

---

### Step 4: Create a New Template (Simulated)

**AI execution guidance:**
- Find buttons such as "Add", "New", or "Create"
- Use `browser_click` to click the add button
- Select the template type (if there is a selector)
- Check the layout of the template creation interface

**Expected results:**
- The template creation/editing interface opens
- Template type selection options are displayed
- Input fields such as name, description, and content are provided
- The interface layout is clear and the fields are clearly labeled

**Verification points:**
- [ ] The template creation interface opens correctly
- [ ] The template type selection feature is available
- [ ] All necessary input fields exist
- [ ] The interface responds normally

---

### Step 5: Fill In Template Information (Simulated)

**AI execution guidance:**
- Find the template name input box
- Use `browser_type` to enter a test name
- Find the description input box and enter a description
- Find the template content editing area

**Test data:**
```
Template name: Test Template
Template description: This is a template used for testing
Template type: System optimization (or user optimization)
```

**Expected results:**
- Name and description are entered normally
- Template type selection works normally
- The content editing area is available
- Input validation works normally

**Verification points:**
- [ ] The name input feature works normally
- [ ] The description input feature works normally
- [ ] The type selection feature works normally
- [ ] Input validation is correct

---

### Step 6: Write Template Content (Simulated)

**AI execution guidance:**
- Find the template content editing area (usually a large text box)
- Use `browser_type` to enter test template content
- Find the mode switching option (simple/advanced)
- Check the editor's features and responsiveness

**Test data:**
```
Template content:
You are a professional prompt optimization expert.
Please help the user optimize the following prompt:
{original prompt}

Optimization requirements:
1. Make the prompt clearer and more explicit
2. Add necessary context information
3. Improve the language expression
```

**Expected results:**
- The template content is entered correctly into the editing area
- The editor supports multi-line text input
- The mode switching feature works normally (if present)
- The editor responds smoothly

**Verification points:**
- [ ] The template content is entered successfully
- [ ] The editor features work normally
- [ ] Mode switching works normally (if available)
- [ ] The editor responds smoothly

---

### Step 7: Save the Template (Simulated)

**AI execution guidance:**
- Check the completeness of the template information
- Find buttons such as "Save", "OK", or "Submit"
- Use `browser_click` to click the save button
- Wait for the save to complete and check the result

**Expected results:**
- The save button responds normally
- A save success message is displayed
- The view returns to the template list interface
- The newly created template appears in the corresponding category

**Verification points:**
- [ ] The save button works normally
- [ ] A save success message is displayed
- [ ] The view returns to the template list interface
- [ ] The new template is displayed correctly in the list

---

### Step 8: Edit an Existing Template (Simulated)

**AI execution guidance:**
- Select an existing template in the template list
- Find the "Edit" button or try double-clicking the template
- Check whether the edit interface loads correctly
- Verify that the existing information is displayed correctly

**Expected results:**
- The template edit interface opens
- The existing template information is loaded correctly into the editor
- All editable fields can be modified
- The edit interface is fully functional

**Verification points:**
- [ ] The edit interface opens correctly
- [ ] The existing information is loaded correctly
- [ ] The modification feature works normally
- [ ] The edit interface is fully functional

---

### Step 9: Test Template Categories

**AI execution guidance:**
- Find the template category tabs or filters
- Click different category options
- Observe changes in the template list
- Verify the accuracy of the category filtering

**Expected results:**
- Category tabs are clearly visible
- Clicking a category filters the templates
- The filter results are accurate
- Category switching is smooth

**Verification points:**
- [ ] The category tab feature works normally
- [ ] Category filtering is accurate
- [ ] The filter results are correct
- [ ] Category switching is smooth

---

### Step 10: Test Built-in Template Language Switching

**AI execution guidance:**
- Find the language toggle button in the template management interface (usually shows "ZH" or "EN")
- Use `browser_click` to click the language toggle button
- Observe changes in the built-in template names
- Verify that the template content language changes accordingly

**Expected results:**
- The language toggle button responds normally
- Built-in template names switch from Chinese to English (or vice versa)
- The template content language changes accordingly
- The interface shows a switch success message

**Verification points:**
- [ ] The language toggle button works normally
- [ ] The built-in template name language switches correctly
- [ ] The template content language changes accordingly
- [ ] A switch success message is displayed

**Notes:**
- Built-in template language switching is different from interface language switching
- The built-in template language affects the display language of template names and content
- After switching, you should see the template names change language accordingly (for example, the Chinese "General Optimization" template becomes "General Optimization" in English)

---

## ⚠️ Common Problem Checks

### Interface Display Problems
- The template management popup cannot be opened
- The template list displays abnormally
- The edit interface layout is disordered
- Category tab display problems

### Feature Operation Problems
- The template creation feature is abnormal
- The edit feature is unavailable
- The save operation fails
- Category filtering is inaccurate

### Data Management Problems
- Template information is lost
- Content is abnormal after saving
- Category information is wrong
- Template loading fails

---

## 🤖 AI Verification Execution Template

```javascript
// 1. Open the application
browser_navigate("http://localhost:18181/")

// 2. Get the initial state
browser_snapshot()

// 3. Open template management
browser_click(element="Template management button", ref="template_management_button")
browser_snapshot()

// 4. Browse existing templates
browser_snapshot()

// 5. View template details
browser_click(element="Template item", ref="template_item")
browser_snapshot()

// 6. Create a new template
browser_click(element="Add template button", ref="add_template_button")
browser_snapshot()

// 7. Fill in template information
browser_type(element="Template name input box", ref="template_name_input", text="Test Template")
browser_type(element="Template description input box", ref="template_desc_input", text="Test description")
browser_snapshot()

// 8. Write template content
browser_type(element="Template content editor", ref="template_content_editor", text="Test template content")
browser_snapshot()

// 9. Save the template
browser_click(element="Save button", ref="save_button")
browser_snapshot()

// 10. Test category filtering
browser_click(element="Category tab", ref="category_tab")
browser_snapshot()

// 11. Test built-in template language switching
browser_click(element="Built-in template language toggle button", ref="builtin_language_toggle")
browser_snapshot()
```

**Success criteria:**
- The template management interface opens and operates normally
- The template browsing and viewing features work normally
- The template creation and editing features work normally
- The template category and filter features work normally
- The built-in template language switching feature works normally
- All operations respond promptly and accurately
- No error messages or abnormal states
