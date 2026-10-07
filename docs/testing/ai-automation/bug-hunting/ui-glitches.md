# UI Display Glitch Bug-Hunting Tests

## 📖 Test Overview
Specifically used to discover UI-display-related bugs, including layout problems, abnormal styles, responsive problems, and other visual and interaction defects.

## 🎯 Test Goals
- Discover UI layout and display bugs
- Test responsive design problems
- Verify theme and style consistency
- Discover interaction feedback problems

## 🔍 Bug-Hunting Focus
- Overlapping and misplaced elements
- Text overflow and truncation
- Inconsistent styles
- Responsive layout problems
- Abnormal animations and transitions

---

## 🧪 Bug-Hunting Scenarios

### Scenario 1: Extreme Window Size Test

**Test purpose:** Discover UI layout bugs under extreme window sizes

**AI execution guidance:**
```javascript
// Test an extremely small window
browser_resize(320, 240); // Extremely small size
browser_snapshot();

// Enter content to test the layout
browser_type(element="Original prompt input box", ref="e54", text="Extremely small window test content");
browser_snapshot();

// Open various popups for testing
browser_click(element="Model Manager button", ref="e21");
browser_snapshot();
browser_press_key("Escape");

// Test an extremely large window
browser_resize(3840, 2160); // 4K size
browser_snapshot();

// Test an extremely narrow window
browser_resize(200, 800); // Extremely narrow
browser_snapshot();

// Test an extremely wide window
browser_resize(2000, 400); // Extremely wide
browser_snapshot();
```

**Expected problems to discover:**
- Elements overlap or are misplaced
- Buttons are truncated or hidden
- Text overflows its container
- Abnormal scrollbars
- The layout is completely broken

**Verification points:**
- [ ] All elements are visible and accessible
- [ ] Text wraps or truncates correctly
- [ ] Buttons work normally
- [ ] Scrolling behavior is correct
- [ ] The layout stays reasonable

---

### Scenario 2: Long Text Display Test

**Test purpose:** Discover UI display problems in long text handling

**AI execution guidance:**
```javascript
// Test a very long word
const longWord = "a".repeat(100);
browser_type(element="Original prompt input box", ref="e54", text=longWord);
browser_snapshot();

// Test a very long sentence
const longSentence = "This is a very long sentence used to test text wrapping and display. ".repeat(20);
browser_type(element="Original prompt input box", ref="e54", text=longSentence);
browser_snapshot();

// Test mixed long text
const mixedText = `
Title: ${longWord}
Content: ${longSentence}
Ending: ${"test".repeat(50)}
`;
browser_type(element="Original prompt input box", ref="e54", text=mixedText);
browser_snapshot();

// Start optimization to see how the result is displayed
browser_click(element="Start optimization button", ref="e78");
browser_wait_for(time=10);
browser_snapshot();
```

**Expected problems to discover:**
- A long word does not wrap and causes overflow
- Improper text truncation position
- Abnormal scrollbar display
- Container height calculation errors
- Text selection problems

**Verification points:**
- [ ] Long text wraps correctly
- [ ] Container size adapts
- [ ] Scrolling works normally
- [ ] Text selection is normal
- [ ] Display performance is good

---

### Scenario 3: Theme Switching Consistency Test

**Test purpose:** Discover style inconsistency problems when switching themes

**AI execution guidance:**
```javascript
// Operate in Light Mode
browser_click(element="Theme toggle button", ref="e10");
browser_snapshot();

// Open various interface elements
browser_click(element="Model Manager button", ref="e21");
browser_snapshot();
browser_press_key("Escape");

browser_click(element="Template management button", ref="e15");
browser_snapshot();
browser_press_key("Escape");

// Switch to Dark Mode
browser_click(element="Theme toggle button", ref="e10");
browser_snapshot();

// Reopen interface elements to check consistency
browser_click(element="Model Manager button", ref="e21");
browser_snapshot();
browser_press_key("Escape");

browser_click(element="Template management button", ref="e15");
browser_snapshot();
browser_press_key("Escape");

// Rapidly switch themes
for (let i = 0; i < 5; i++) {
    browser_click(element="Theme toggle button", ref="e10");
    browser_wait_for(time=0.5);
}
browser_snapshot();
```

**Expected problems to discover:**
- Some elements do not switch theme
- Insufficient color contrast
- Abnormal theme switching animation
- Style residue in some components
- Text readability problems

**Verification points:**
- [ ] All elements have a consistent theme
- [ ] Color contrast is sufficient
- [ ] The switching animation is smooth
- [ ] No style residue
- [ ] Text is clear and readable

---

### Scenario 4: Dynamic Content Loading Display Test

**Test purpose:** Discover UI display problems when dynamic content loads

**AI execution guidance:**
```javascript
// Test dynamic display during optimization
browser_type(element="Original prompt input box", ref="e54", text="Dynamic content test");
browser_click(element="Start optimization button", ref="e78");

// Take quick snapshots during loading
for (let i = 0; i < 10; i++) {
    browser_wait_for(time=1);
    browser_snapshot();
}

// Test dynamic loading of history
browser_click(element="History button", ref="e18");
browser_snapshot();

// Operate quickly in history
browser_click(element="Reuse button", ref="reuse_button"); // Hypothetical reuse button
browser_snapshot();
browser_press_key("Escape");

// Test dynamic content of template management
browser_click(element="Template management button", ref="e15");
browser_snapshot();

// Add a new template to test dynamic updates
browser_click(element="Add template button", ref="add_template_button");
browser_snapshot();
```

**Expected problems to discover:**
- Inconsistent loading state display
- Content flickers or jumps
- Abnormal placeholder styles
- Dynamic height calculation errors
- Scroll position is lost

**Verification points:**
- [ ] The loading state is clear and consistent
- [ ] Content transitions smoothly
- [ ] Placeholder styles are correct
- [ ] Height calculation is accurate
- [ ] Scroll position is preserved

---

### Scenario 5: Interaction State Feedback Test

**Test purpose:** Discover UI display problems in interaction feedback

**AI execution guidance:**
```javascript
// Test hover state
const buttons = [
    "e78", // Start optimization button
    "e21", // Model Manager button
    "e15", // Template management button
    "e18", // History button
];

for (const buttonRef of buttons) {
    browser_hover(element="Button", ref=buttonRef);
    browser_snapshot();
    browser_wait_for(time=1);
}

// Test click state
for (const buttonRef of buttons) {
    browser_click(element="Button", ref=buttonRef);
    browser_snapshot();
    browser_press_key("Escape"); // Close possible popups
}

// Test focus state
browser_click(element="Original prompt input box", ref="e54");
browser_snapshot();

// Tab key navigation test
for (let i = 0; i < 10; i++) {
    browser_press_key("Tab");
    browser_snapshot();
}
```

**Expected problems to discover:**
- Hover effects are not obvious
- Click feedback is missing
- The focus indicator is unclear
- State transitions are not smooth
- Accessibility problems

**Verification points:**
- [ ] Hover effects are obvious
- [ ] Click feedback is timely
- [ ] The focus indicator is clear
- [ ] State transitions are smooth
- [ ] Accessibility is good

---

### Scenario 6: Multi-Language Display Test

**Test purpose:** Discover UI display problems when switching languages

**AI execution guidance:**
```javascript
// Operate in Chinese mode
browser_type(element="Original prompt input box", ref="e54", text="CJK test content with various punctuation: ！＠＃￥％……＆＊（）テスト");
browser_snapshot();

// Open various popups
browser_click(element="Model Manager button", ref="e21");
browser_snapshot();
browser_press_key("Escape");

// Switch to English
browser_click(element="Language toggle button", ref="e30");
browser_snapshot();

// Check the display in English mode
browser_click(element="Model Manager button", ref="e21");
browser_snapshot();
browser_press_key("Escape");

// Enter English content
browser_type(element="Original prompt input box", ref="e54", text="English test content with various symbols !@#$%^&*()");
browser_snapshot();

// Rapidly switch languages
for (let i = 0; i < 3; i++) {
    browser_click(element="Language toggle button", ref="e30");
    browser_wait_for(time=1);
    browser_snapshot();
}
```

**Expected problems to discover:**
- Text overflow or truncation
- Abnormal font display
- Improper layout adaptation
- Incomplete translation
- Delayed language switching

**Verification points:**
- [ ] Text is displayed correctly
- [ ] Font rendering is normal
- [ ] The layout adapts well
- [ ] Translation is complete and accurate
- [ ] Switching responds promptly

---

### Scenario 7: Boundary Element Display Test

**Test purpose:** Discover display problems of boundary and edge elements

**AI execution guidance:**
```javascript
// Test page edge elements
browser_resize(1200, 800);

// Scroll to each edge of the page
browser_press_key("Home"); // Top of the page
browser_snapshot();

browser_press_key("End"); // Bottom of the page
browser_snapshot();

// Test horizontal scrolling (if any)
browser_press_key("Ctrl+Home");
browser_press_key("ArrowLeft");
browser_snapshot();

browser_press_key("ArrowRight");
browser_snapshot();

// Test element boundaries
browser_click(element="Original prompt input box", ref="e54");
browser_type(element="Original prompt input box", ref="e54", text="Boundary test" + "\n".repeat(20));
browser_snapshot();

// Test popup boundaries
browser_click(element="Template management button", ref="e15");
browser_snapshot();

// Scroll within the popup
browser_press_key("PageDown");
browser_snapshot();
browser_press_key("PageUp");
browser_snapshot();
```

**Expected problems to discover:**
- Elements are truncated by the page edge
- Abnormal scrollbar display
- Popups exceed the screen range
- Missing boundary shadows or borders
- Content cannot be fully accessed

**Verification points:**
- [ ] All elements are fully visible
- [ ] Scrollbars work normally
- [ ] Popup position is reasonable
- [ ] Boundary styles are correct
- [ ] Content is fully accessible

---

## 🐛 UI Display Bug Patterns

### Layout-Related Bugs
- Overlapping or misplaced elements
- Responsive layout failure
- Container size calculation errors
- Abnormal scrolling behavior

### Style-Related Bugs
- Inconsistent themes
- Insufficient color contrast
- Font rendering problems
- Abnormal animation effects

### Interaction-Related Bugs
- Missing hover effects
- Unclear focus indicators
- Delayed click feedback
- Abnormal state transitions

### Content Display Bugs
- Text overflow or truncation
- Improper handling of long content
- Multi-language display problems
- Abnormal special characters

---

## 📊 UI Bug Report Template

```markdown
# UI Display Bug Report

## Bug Information
- **Discovery time:** [Time]
- **UI scenario:** [Specific UI scenario]
- **Severity:** High/Medium/Low
- **Bug type:** Layout/Style/Interaction/Content display

## Environment Information
- **Browser:** [Browser version]
- **Screen resolution:** [Resolution]
- **Window size:** [Window size]
- **Zoom level:** [Zoom setting]

## Bug Description
[Detailed description of the UI display problem]

## Reproduction Steps
1. [Specific operation steps]
2. [Trigger conditions]
3. [Observed result]

## Expected Display
[How the UI should be displayed correctly]

## Actual Display
[The actual display effect]

## Visual Evidence
- **Screenshot:** [Bug screenshot file]
- **Comparison image:** [Comparison with the correct display]
- **Screen recording:** [Screen recording of dynamic bugs]

## Impact Assessment
- **User experience:** [Impact on user experience]
- **Functional impact:** [Whether feature usage is affected]
- **Compatibility:** [Whether multi-platform compatibility is affected]

## Fix Suggestions
- **CSS fix:** [Style fix suggestion]
- **Layout adjustment:** [Layout improvement suggestion]
- **Responsive optimization:** [Responsive improvement]
```
