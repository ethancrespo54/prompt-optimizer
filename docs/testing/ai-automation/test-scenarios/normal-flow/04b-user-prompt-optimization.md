# User Prompt Optimization Normal Flow Test

## 📖 Test Overview
Verify the basic flow of the user prompt optimization feature, ensuring users can perform user prompt optimization normally. User prompt optimization differs from system prompt optimization; it is mainly used to optimize the user's instructions so that they become more specific and more actionable.

## 🎯 Test Goals
- Verify the optimization mode switching feature (System Prompt ↔ User Prompt)
- Confirm the user prompt input and optimization flow
- Verify the quality and characteristics of the user prompt optimization result
- Check the automatic template adaptation feature
- Verify the version management and iteration features

## 📋 Prerequisites
- [ ] The application has started and finished loading
- [ ] At least one AI model is configured (OpenAI/Claude/Gemini, etc.)
- [ ] Available user prompt optimization templates exist
- [ ] The network connection is normal

---

## 🔧 Test Steps

### Step 1: Switch to User Prompt Optimization Mode

**AI execution guidance:**
- Use `browser_snapshot` to get the current page state
- Find the optimization mode toggle buttons: "System Prompt Optimization" and "User Prompt Optimization"
- Use `browser_click` to click the "User Prompt Optimization" button

**Expected results:**
- The "User Prompt Optimization" button becomes selected (pressed)
- The "System Prompt Optimization" button becomes unselected
- The interface title changes from "Original Prompt" to "User Prompt"
- The input box placeholder text updates to user-prompt-related content
- The optimization template may automatically switch to one suited for user prompts

**Verification points:**
- [ ] The mode toggle button states are correct
- [ ] The interface title and prompt text update correctly
- [ ] The optimization template adapts automatically (for example, switching to "Professional Optimization")
- [ ] The test area title updates to "User Prompt Test"

---

### Step 2: Enter the User Prompt

**AI execution guidance:**
- Use `browser_type` to enter test content in the user prompt input box
- Observe the interface state changes

**Test data:**
```
Typical user prompt: Help me write a work summary
Short instruction: Translate this text
Task request: Make a study plan
```

**Expected results:**
- The text box shows the entered user prompt
- The "Optimize →" button becomes clickable
- A "Compare" button may appear

**Verification points:**
- [ ] The user prompt was entered successfully
- [ ] The input content is fully displayed
- [ ] The optimize button becomes available
- [ ] There is no input error prompt

---

### Step 3: Execute User Prompt Optimization

**AI execution guidance:**
- Use `browser_click` to click the "Optimize →" button
- Wait for the optimization process to complete (may take a few seconds)
- Use `browser_wait_for` to wait for the optimization result to be displayed

**Expected results:**
- The optimize button shows a "Loading..." state
- A success prompt is displayed after optimization completes
- The right area displays the optimized user prompt
- The version management button (V1) appears
- The "Continue Optimize" button appears

**Verification points:**
- [ ] The optimization process starts normally
- [ ] The optimization completes successfully without error prompts
- [ ] The optimization result is displayed correctly
- [ ] The version management feature is available

---

### Step 4: Verify the User Prompt Optimization Effect

**AI execution guidance:**
- Use `browser_snapshot` to view the optimization result content
- Compare the original user prompt with the optimized result

**Expected results:**
- The optimized prompt is more specific and detailed than the original prompt
- It contains clear requirements and guidance
- It is more structured
- It is more actionable

**Verification points:**
- [ ] The optimization effect is significant (from a simple instruction to detailed requirements)
- [ ] The optimized content structure is clear
- [ ] It contains specific execution guidance
- [ ] The content quality matches the characteristics of user prompt optimization

**Example comparison:**
```
Original: Help me write a work summary
After optimization: Should contain a list of specific requirements, such as:
- Summary period
- Job responsibilities
- Main work content
- Work achievements
- Highlights and innovations
- Shortcomings
- Lessons learned
- Future outlook
- Format requirements
- Submission deadline
```

---

### Step 5: Test Mode Switching Retention

**AI execution guidance:**
- Use `browser_click` to switch back to "System Prompt Optimization" mode
- Switch back to "User Prompt Optimization" mode again
- Observe whether the content is retained

**Expected results:**
- Mode switching is smooth without delay
- The entered content and optimization results remain unchanged
- Interface elements update correctly
- The template adapts automatically

**Verification points:**
- [ ] The mode switching feature works normally
- [ ] Content is not lost due to switching
- [ ] The interface state updates correctly
- [ ] The template switches automatically and correctly

---

### Step 6: Test the Iterative Optimization Feature

**AI execution guidance:**
- Use `browser_click` to click the "Continue Optimize" button
- Enter the optimization direction in the iterative optimization interface
- Execute the iterative optimization

**Test data:**
```
Iteration requirement: Please add more requirements about time management and specific formats
```

**Expected results:**
- The iterative optimization interface opens correctly
- The optimization direction can be entered
- The iterative optimization executes successfully
- A V2 version is generated
- The version switching feature works normally

**Verification points:**
- [ ] The iterative optimization interface opens normally
- [ ] The optimization direction is entered successfully
- [ ] The iterative optimization executes successfully
- [ ] The V2 version is generated correctly
- [ ] The version switching feature works normally

---

### Step 7: Test Result Display Features ⭐ New

**AI execution guidance:**
- After user prompt optimization completes, continue testing the result display features
- Verify the various operation experiences available to the user after obtaining the optimization result

#### 7.1 View Switching Test

**AI execution guidance:**
- Use `browser_click` to click the "Source" button
- Use `browser_snapshot` to verify the content changes to Markdown source format
- Use `browser_click` to click the "Render" button
- Use `browser_snapshot` to verify the content changes to HTML rendered format

**Expected results:**
- Render view: shows the formatted user prompt optimization result
- Source view: shows the original Markdown text format
- Button states update correctly (the button of the current view is disabled)

**Verification points:**
- [ ] View switching responds normally
- [ ] The content format converts correctly
- [ ] Button states update correctly
- [ ] Content integrity is maintained

#### 7.2 Copy Feature Test

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

#### 7.3 Fullscreen View Test

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

#### 7.4 Smart Compare Feature Test

**AI execution guidance:**
- Use `browser_click` to click the "Compare" button
- Use `browser_snapshot` to observe the comparison display

**Expected results:**
- Differences between the original user prompt and the optimized result are intelligently identified
- Different parts are displayed in segments (original, common, optimized extension)
- The Compare button state updates to disabled

**Verification points:**
- [ ] Compare mode is activated correctly
- [ ] Text differences are identified correctly
- [ ] Segmented display is clear
- [ ] Button states update correctly

#### 7.5 Expand Editing Feature Test

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

## 🎯 Testing Focus

### Core Feature Verification
1. **Mode switching feature**: System Prompt Optimization ↔ User Prompt Optimization
2. **Automatic template adaptation**: Different modes automatically select suitable optimization templates
3. **Difference in optimization effect**: User prompt optimization should produce instruction optimization results, not content generation

### User Experience Verification
1. **Interface consistency**: The operation flow of the two modes should be consistent
2. **Content retention**: Mode switching should not lose existing work
3. **Timely feedback**: The optimization process should have clear status feedback

### Quality Verification
1. **Optimization quality**: User prompt optimization should make instructions more specific and more actionable
2. **Version management**: Supports multi-version management and switching
3. **Iteration feature**: Supports feedback-based iterative optimization

---

## 📊 Success Criteria

### Level A Criteria (Must Pass)
- [ ] The mode switching feature is 100% normal
- [ ] The user prompt optimization feature is 100% normal
- [ ] The optimization result quality meets expectations
- [ ] The version management feature is 100% normal

### Level B Criteria (Should Pass)
- [ ] The automatic template adaptation feature is normal
- [ ] The iterative optimization feature is normal
- [ ] Interface interaction is smooth
- [ ] The content retention feature is normal

### Level C Criteria (Acceptable Issues)
- [ ] Optimization is slightly slow (completing within 10 seconds is acceptable)
- [ ] Interface elements update with slight delay
- [ ] Minor issues in non-critical features

---

## 🐛 Common Problem Troubleshooting

### Mode Switching Problems
- Check whether the button states update correctly
- Confirm whether interface elements switch correctly
- Verify whether the template adapts automatically

### Optimization Feature Problems
- Confirm whether the model configuration is correct
- Check whether the network connection is normal
- Verify whether the input content meets the requirements

### Result Display Problems
- Check whether the optimization result is fully displayed
- Confirm whether the version management feature is normal
- Verify whether the content format is correct

---

## 📝 Test Record Template

```
Test execution time: ____
Tester: ____
Test environment: ____

Step 1 - Mode switching: □ Pass □ Fail
Step 2 - User prompt input: □ Pass □ Fail  
Step 3 - Optimization execution: □ Pass □ Fail
Step 4 - Optimization effect verification: □ Pass □ Fail
Step 5 - Mode switching retention: □ Pass □ Fail
Step 6 - Iterative optimization: □ Pass □ Fail

Overall score: ____/100
Problems found: ____
Improvement suggestions: ____
```
