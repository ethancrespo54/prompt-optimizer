# Input Validation Edge Case Tests

## 📖 Test Overview
Test the application's ability to handle various abnormal inputs, and discover input-validation-related bugs and user experience problems.

## 🎯 Test Goals
- Discover input validation vulnerabilities
- Test extreme input situations
- Verify error handling mechanisms
- Discover UI display problems

## 🔍 Bug-Hunting Focus
- Input length limit handling
- Special character handling
- Empty input handling
- Format validation problems
- Memory leak risks

---

## 🧪 Test Scenarios

### Scenario 1: Very Long Text Input Test

**Test purpose:** Discover performance problems and UI display bugs in long text handling

**AI execution guidance:**
```javascript
// Generate very long text
const longText = "This is a test text. ".repeat(1000); // About 10000 characters
browser_type(element="Original prompt input box", ref="e54", text=longText);

// Check the interface response
browser_snapshot();

// Try to optimize
browser_click(element="Start optimization button", ref="e78");
browser_wait_for(time=30); // Wait longer
```

**Expected problems to discover:**
- Abnormal input box scrolling
- UI freezes or becomes unresponsive
- Excessive memory usage
- Optimization timeouts or failures
- Abnormal result display

**Verification points:**
- [ ] Whether the input box can display long text normally
- [ ] Whether the interface stays responsive
- [ ] Whether optimization can complete normally
- [ ] Whether memory usage is reasonable
- [ ] Whether error handling is appropriate

---

### Scenario 2: Special Characters and Emoji Test

**Test purpose:** Discover bugs related to character encoding and display

**AI execution guidance:**
```javascript
// Test various special characters
const specialChars = [
    "🚀🎯💡🔥⭐️🌟✨🎉🎊🎈", // Emoji
    "CJK multi-byte test content with full-width symbols: ！＠＃￥％……＆＊（）テスト", // CJK / full-width special symbols
    "English with symbols: !@#$%^&*()_+-=[]{}|;':\",./<>?", // English special symbols
    "Math symbols: ∑∏∫∂∇∆∞±×÷≤≥≠≈∝∈∉∪∩⊂⊃", // Math symbols
    "HTML tags: <script>alert('test')</script><div>test</div>", // HTML injection test
    "SQL injection: '; DROP TABLE users; --", // SQL injection test
    "Newline test: \nLine 1\nLine 2\nLine 3", // Newline characters
    "Tab test: \tTab\tseparated\tcontent" // Tab characters
];

for (const testText of specialChars) {
    browser_type(element="Original prompt input box", ref="e54", text=testText);
    browser_snapshot();
    browser_click(element="Start optimization button", ref="e78");
    browser_wait_for(time=10);
    browser_snapshot();
}
```

**Expected problems to discover:**
- Abnormal or garbled character display
- HTML/script injection vulnerabilities
- Newline handling errors
- Emoji display problems
- Encoding conversion errors

**Verification points:**
- [ ] Special characters are displayed correctly
- [ ] There is no script injection risk
- [ ] Newlines are handled correctly
- [ ] Emoji are displayed normally
- [ ] Encoding conversion is correct

---

### Scenario 3: Empty Input and Boundary Value Test

**Test purpose:** Discover bugs in empty value handling and boundary conditions

**AI execution guidance:**
```javascript
// Test various empty input situations
const emptyInputs = [
    "", // Completely blank
    " ", // A single space
    "   ", // Multiple spaces
    "\n", // Only a newline
    "\t", // Only a tab
    "\n\t ", // Mixed whitespace characters
];

for (const emptyInput of emptyInputs) {
    // Clear the input box
    browser_click(element="Original prompt input box", ref="e54");
    browser_press_key("Ctrl+a");
    browser_press_key("Delete");
    
    // Enter the test content
    browser_type(element="Original prompt input box", ref="e54", text=emptyInput);
    
    // Try to optimize
    browser_click(element="Start optimization button", ref="e78");
    browser_snapshot();
    
    // Check error handling
    browser_wait_for(time=3);
}
```

**Expected problems to discover:**
- Wrong button state on empty input
- Missing input validation prompts
- Improper whitespace handling
- Unclear error messages
- Abnormal interface state

**Verification points:**
- [ ] There is an appropriate prompt on empty input
- [ ] The button is correctly disabled
- [ ] Whitespace characters are handled correctly
- [ ] Error messages are clear
- [ ] The interface state is consistent

---

### Scenario 4: Rapid Consecutive Input Test

**Test purpose:** Discover race conditions and performance problems in input handling

**AI execution guidance:**
```javascript
// Rapid consecutive input test
for (let i = 0; i < 20; i++) {
    browser_type(element="Original prompt input box", ref="e54", text=`Rapid input test ${i}`);
    // Do not wait, proceed to the next input immediately
}

// Rapid consecutive click test
for (let i = 0; i < 10; i++) {
    browser_click(element="Start optimization button", ref="e78");
}

// Check the final state
browser_snapshot();
```

**Expected problems to discover:**
- Lost or duplicated input
- Delayed interface updates
- Confused button state
- Multiple requests sent
- Memory leaks

**Verification points:**
- [ ] The final input content is correct
- [ ] The interface state is consistent
- [ ] There are no duplicate requests
- [ ] Performance stays normal
- [ ] Memory usage is stable

---

### Scenario 5: Copy-Paste Anomaly Test

**Test purpose:** Discover edge-case bugs in the copy-paste feature

**AI execution guidance:**
```javascript
// Test large copy-paste
const largeText = "Copy-paste test content. ".repeat(500);

// Simulate copy-paste operations
browser_click(element="Original prompt input box", ref="e54");
browser_press_key("Ctrl+a");
browser_type(element="Original prompt input box", ref="e54", text=largeText);

// Test partial selection copy
browser_press_key("Ctrl+a");
browser_press_key("Ctrl+c");
browser_press_key("Ctrl+v");
browser_press_key("Ctrl+v"); // Paste repeatedly

// Check the result
browser_snapshot();
```

**Expected problems to discover:**
- Copy-paste content is lost
- Formatting problems
- Performance degradation
- Duplicated content
- Interface freezes

**Verification points:**
- [ ] The copy-paste feature works normally
- [ ] Content formatting is preserved
- [ ] The performance impact is acceptable
- [ ] There is no duplicated content
- [ ] The interface responds normally

---

### Scenario 6: Input Box Focus Anomaly Test

**Test purpose:** Discover focus-management-related UI bugs

**AI execution guidance:**
```javascript
// Test focus switching
browser_click(element="Original prompt input box", ref="e54");
browser_type(element="Original prompt input box", ref="e54", text="Focus test");

// Rapidly switch focus
browser_click(element="Model select button", ref="e59");
browser_click(element="Original prompt input box", ref="e54");
browser_click(element="Template select button", ref="e69");
browser_click(element="Original prompt input box", ref="e54");

// Test Tab key navigation
browser_press_key("Tab");
browser_press_key("Tab");
browser_press_key("Tab");
browser_press_key("Shift+Tab");

// Check the focus state
browser_snapshot();
```

**Expected problems to discover:**
- Focus is lost or misplaced
- Wrong Tab navigation order
- Abnormal focus styles
- Keyboard operations stop working
- Accessibility problems

**Verification points:**
- [ ] Focus is managed correctly
- [ ] The Tab navigation order is reasonable
- [ ] Focus styles are clear
- [ ] Keyboard operations work normally
- [ ] Accessibility is good

---

## 🐛 Common Bug Patterns

### Input Validation Bugs
- Length limits do not take effect
- Special character handling errors
- Missing null checks
- Format validation is not strict

### Performance-Related Bugs
- Large inputs cause freezing
- Excessive memory usage
- Overly long response time
- Delayed interface updates

### UI Display Bugs
- Text overflow or truncation
- Character encoding problems
- Focus management errors
- Abnormal style display

### Security-Related Bugs
- XSS injection risk
- Improper input filtering
- Sensitive information leakage
- Missing permission validation

---

## 📊 Bug Report Template

```markdown
# Input Validation Bug Report

## Bug Information
- **Discovery time:** [Time]
- **Test scenario:** [Specific scenario]
- **Severity:** High/Medium/Low
- **Bug type:** Input validation/Performance/UI/Security

## Reproduction Steps
1. [Specific step]
2. [Specific step]
3. [Specific step]

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happened]

## Impact Assessment
[Impact on users and the system]

## Suggested Fix
[Fix suggestion and priority]
```

---

**Note:** These tests are specifically designed to discover bugs and may cause the application to behave abnormally. Run them with caution in production environments.
