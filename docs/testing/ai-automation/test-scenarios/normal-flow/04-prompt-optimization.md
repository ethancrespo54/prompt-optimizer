# Prompt Optimization Normal Flow Test

## 📖 Test Overview
Verify the basic flow of the prompt optimization feature, ensuring users can perform prompt optimization normally.

## 🎯 Test Goals
- Verify the prompt input and optimization flow
- Confirm the template and model selection features
- Verify the optimization result display and iteration features
- Check the version management and switching features

## 📋 Prerequisites
- [ ] The application has started and finished loading
- [ ] At least one AI model is configured (OpenAI/Claude/Gemini, etc.)
- [ ] Available optimization templates exist
- [ ] The network connection is normal

---

## 🔧 Test Steps

### Step 1: Enter the Original Prompt

**AI execution guidance:**
- Use `browser_snapshot` to get the current page state
- Find the text box labeled "Enter prompt", "Original Prompt", or a similar label
- Use `browser_type` to enter the test prompt content

**Test data:**
```
Normal test: Please help me write an article about the history of artificial intelligence
```

**Expected results:**
- The text box shows the entered prompt content
- A character count may be displayed below the input box
- The optimize button becomes clickable

**Verification points:**
- [ ] The prompt was successfully entered into the text box
- [ ] The text box shows the complete content
- [ ] Optimization-related buttons are available
- [ ] There is no input error prompt

---

### Step 2: Select the Optimization Mode and Template

**AI execution guidance:**
- Use `browser_snapshot` to view the state of the selectors on the current page
- Find the optimization mode selector (usually radio buttons or a dropdown)
- Use `browser_click` to select the optimization mode
- Find the template selection dropdown and select an appropriate template

**Test data:**
```
Optimization mode: System Prompt Optimization
Template selection: General Optimization
```

**Expected results:**
- The optimization mode is selected (shows the selected state)
- The template selection box shows the selected template name
- The template description area shows the corresponding template description

**Verification points:**
- [ ] The optimization mode is selected correctly
- [ ] The template is selected successfully
- [ ] The template description is displayed correctly
- [ ] The selector state updates normally

---

### Step 3: Select the Optimization Model

**AI execution guidance:**
- Find the model selection dropdown (usually in the upper-right area of the page)
- Use `browser_click` to open the model selection dropdown
- Select an available model (one whose status shows as normal)
- Confirm the model was selected successfully

**Expected results:**
- The model selection box shows the selected model name
- The model status indicator shows an available state
- The optimize button is fully activated

**Verification points:**
- [ ] The model is selected successfully
- [ ] The model status is displayed normally
- [ ] The optimize button is clickable
- [ ] There is no model configuration error prompt

---

### Step 4: Execute Prompt Optimization

**AI execution guidance:**
- Find and click the main action button such as "Optimize Prompt", "Start Optimization", or similar
- Use `browser_wait_for` to wait for the optimization process to start (the button turns to a loading state)
- Wait for the optimization to complete (the loading state disappears and the result is displayed)
- Use `browser_snapshot` to check the optimization result

**Expected results:**
- The optimize button shows a loading state (such as a spinning icon)
- The right panel starts displaying the optimized prompt
- The reasoning process is displayed progressively (if enabled)
- The button returns to its normal state after optimization completes

**Verification points:**
- [ ] The optimization process starts successfully
- [ ] The optimized prompt is displayed on the right
- [ ] The reasoning process content is reasonable
- [ ] The optimization process completes normally
- [ ] There is no error message

---

### Step 5: View and Evaluate the Optimization Result

**AI execution guidance:**
- Use `browser_snapshot` to get the full content of the optimization result panel
- Check whether the optimized prompt is fully displayed
- Verify that the reasoning process exists and its content is reasonable
- Confirm that the function buttons of the result panel are available

**Expected results:**
- The optimized prompt is fully displayed in the right panel
- The reasoning process explains in detail the reasons for the optimization and the improvements
- Operation buttons such as copy, edit, and fullscreen are visible
- Version information is displayed correctly

**Verification points:**
- [ ] The optimized prompt is fully displayed
- [ ] The reasoning process content is detailed and reasonable
- [ ] Operation buttons (copy, edit, etc.) are available
- [ ] Version information is displayed correctly
- [ ] The content format is displayed normally

---

### Step 6: Perform Iterative Optimization

**AI execution guidance:**
- Find the iteration input box (usually below the optimization result)
- Use `browser_type` to enter the iteration improvement requirements
- Select the iteration template (if there is a selector)
- Click the iterative optimization button

**Test data:**
```
Iteration requirement: Please add more specific technical details about the development of deep learning and neural networks, and add a timeline structure
```

**Expected results:**
- The iteration input box shows the improvement requirements
- A new optimization process starts
- A new version of the optimization result is generated
- A new version is added to the version history

**Verification points:**
- [ ] The iteration requirements are entered successfully
- [ ] The iterative optimization process starts normally
- [ ] A new optimized version is generated
- [ ] The version switching feature works normally
- [ ] The quality of the iteration result is improved

---

### Step 7: Test Version Switching

**AI execution guidance:**
- Find the version switch buttons (V1, V2, etc.)
- Use `browser_click` to switch between versions
- Verify that the content switches correctly
- Test the copy feature

**Expected results:**
- Versions can be freely switched
- The content of each version is displayed correctly
- The copy feature works normally

**Verification points:**
- [ ] The version switching feature works normally
- [ ] The version content is displayed correctly
- [ ] The copy feature works normally
- [ ] The interface state updates correctly

---

### Step 8: Test Result Display Features ⭐ New

**AI execution guidance:**
- After optimization completes, continue testing the result display features
- Verify the various operation experiences available to the user after obtaining the optimization result

#### 8.1 View Switching Test

**AI execution guidance:**
- Use `browser_click` to click the "Source" button
- Use `browser_snapshot` to verify the content changes to Markdown source format
- Use `browser_click` to click the "Render" button
- Use `browser_snapshot` to verify the content changes to HTML rendered format

**Expected results:**
- Render view: shows formatted HTML (headings, paragraphs, lists, etc.)
- Source view: shows the original Markdown text (** markers, * lists, etc.)
- Button states update correctly (the button of the current view is disabled)

**Verification points:**
- [ ] View switching responds normally
- [ ] The content format converts correctly
- [ ] Button states update correctly
- [ ] Content integrity is maintained

#### 8.2 Copy Feature Test

**AI execution guidance:**
- Use `browser_click` to click the "Copy" button
- Observe whether a success prompt appears

**Expected results:**
- A "Copied to clipboard" prompt appears
- The prompt disappears automatically or can be closed manually

**Verification points:**
- [ ] The copy button responds normally
- [ ] The success prompt is displayed correctly
- [ ] User feedback is timely and clear

#### 8.3 Fullscreen View Test

**AI execution guidance:**
- Use `browser_click` to click the "Fullscreen" button
- Use `browser_snapshot` to verify the fullscreen interface
- Test view switching in fullscreen mode
- Use `browser_click` to close fullscreen

**Expected results:**
- A standalone fullscreen content viewer opens
- Fullscreen mode has complete function controls
- It can be closed normally to return to the original interface

**Verification points:**
- [ ] The fullscreen interface opens correctly
- [ ] Fullscreen mode features are complete
- [ ] View controls work normally
- [ ] The close feature works normally

#### 8.4 Smart Compare Feature Test

**AI execution guidance:**
- Use `browser_click` to click the "Compare" button
- Use `browser_snapshot` to observe the comparison display

**Expected results:**
- Differences between the original prompt and the optimized result are intelligently identified
- Different parts are displayed in segments (original, common, optimized extension)
- The Compare button state updates to disabled

**Verification points:**
- [ ] Compare mode is activated correctly
- [ ] Text differences are identified correctly
- [ ] Segmented display is clear
- [ ] Button states update correctly

#### 8.5 Expand Editing Feature Test

**AI execution guidance:**
- Use `browser_click` to click the "Expand" button
- Use `browser_snapshot` to verify the fullscreen editing interface
- Test the input feature
- Use `browser_click` to close the editing interface

**Expected results:**
- Fullscreen editing mode opens
- There is an independent editing window and a close button
- The input feature works normally

**Verification points:**
- [ ] The fullscreen editing interface opens correctly
- [ ] The input feature works normally
- [ ] The close feature works normally
- [ ] The content stays consistent

---

## ⚠️ Common Problem Checks

### Network-Related Problems
- The optimization process is interrupted or times out
- API calls fail
- Abnormal model connection

### Interface Interaction Problems
- Buttons do not respond
- Abnormal content display
- Version switching fails

### Data Processing Problems
- Input validation fails
- Result format errors
- Abnormal version management

---

## 🤖 AI Verification Execution Template

```javascript
// 1. Open the application
browser_navigate("http://localhost:18181/")

// 2. Get the initial state
browser_snapshot()

// 3. Enter the prompt
browser_type(element="Original prompt input box", ref="e54", text="Please help me write an article about the history of artificial intelligence")

// 4. Execute optimization
browser_click(element="Start optimization button", ref="e78")

// 5. Wait for completion
browser_wait_for(text="Optimization successful")

// 6. Verify the result
browser_snapshot()

// 7. Test iteration
browser_click(element="Continue optimize button", ref="e178")
browser_type(element="Iteration input box", ref="e284", text="Please add more technical details")
browser_click(element="Confirm optimization button", ref="e287")

// 8. Verify version switching
browser_click(element="V1 button", ref="e177")
browser_click(element="V2 button", ref="e288")

// 9. Test the copy feature
browser_click(element="Copy button", ref="e93")
```

**Success criteria:**
- All steps execute successfully
- All verification points pass
- Features work as expected
- No error messages or exceptions
