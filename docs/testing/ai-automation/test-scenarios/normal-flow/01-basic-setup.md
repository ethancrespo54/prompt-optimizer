# Basic Setup Normal Flow Test

## 📖 Test Overview
Verify that the basic setup features of the application work correctly, including basic configuration features such as theme switching, language switching, and interface layout adjustment.

## 🎯 Test Goals
- Verify that the theme switching feature works correctly
- Verify that the language switching feature works correctly
- Verify saving and loading of settings
- Verify the basic responsive layout features

## 📋 Prerequisites
- [ ] The application has started and finished loading
- [ ] The user interface displays correctly
- [ ] The browser supports local storage

---

## 🔧 Test Steps

### Step 1: Switch Theme Mode

**AI execution guidance:**
- Use `browser_snapshot` to get the current page state
- Find the theme toggle button (may appear as "Light Mode", "Dark Mode", or a corresponding icon)
- Use `browser_click` to click the theme toggle button
- Use `browser_snapshot` again to check the theme change

**Expected results:**
- The interface theme switches immediately after clicking
- Background color, text color, button styles, etc. change accordingly
- The button icon or text updates to the opposite of the current mode

**Verification points:**
- [ ] The theme toggle button is visible and clickable
- [ ] The interface theme changes immediately after clicking
- [ ] The button state updates correctly
- [ ] All interface elements have a consistent theme

---

### Step 2: Switch Interface Language

**AI execution guidance:**
- Find the language toggle button (may appear as "Switch to English", "Switch to Chinese", or a language icon)
- Use `browser_click` to click the language toggle button
- Use `browser_snapshot` to check the language change
- Verify that the language of the main interface elements has switched

**Expected results:**
- The interface language switches immediately after clicking
- All visible text updates to the target language
- The button text updates to the prompt for switching to the other language

**Verification points:**
- [ ] The language toggle button is visible and clickable
- [ ] The interface language changes immediately after clicking
- [ ] The main text elements are translated correctly
- [ ] Buttons and prompt text update correctly

---

### Step 3: Test Settings Persistence

**AI execution guidance:**
- First switch the theme and language
- Use `browser_navigate` to refresh the current page
- Use `browser_snapshot` to check whether the settings are retained
- Verify that the theme and language state match those before the refresh

**Expected results:**
- The theme setting remains unchanged after refresh
- The language setting remains unchanged after refresh
- All user preference settings are loaded correctly

**Verification points:**
- [ ] The theme setting is retained after refresh
- [ ] The language setting is retained after refresh
- [ ] Settings load at a normal speed
- [ ] No settings are lost or reset

---

### Step 4: Verify Responsive Layout

**AI execution guidance:**
- Use `browser_resize` to adjust the browser window size
- Use `browser_snapshot` to check the layout at different sizes
- Test the accessibility of the main feature buttons
- Verify the adaptive behavior of the content area

**Test sizes:**
```javascript
// Phone size
browser_resize(375, 667);
browser_snapshot();

// Tablet size
browser_resize(768, 1024);
browser_snapshot();

// Desktop size
browser_resize(1920, 1080);
browser_snapshot();
```

**Expected results:**
- The interface adapts to different window sizes
- Important feature buttons are always visible and usable
- Text and content areas adjust reasonably

**Verification points:**
- [ ] The interface layout adapts normally
- [ ] Feature buttons are always accessible
- [ ] Content is fully displayed without overflow
- [ ] The user experience is good at different sizes

---

### Step 5: Test Interface Interaction Feedback

**AI execution guidance:**
- Use `browser_hover` to hover over the main buttons
- Use `browser_snapshot` to check the hover effect
- Use `browser_click` to click various buttons
- Observe the click feedback and state changes

**Expected results:**
- Buttons show appropriate visual feedback on hover
- There is clear feedback effect on click
- Button state changes are clearly visible

**Verification points:**
- [ ] Hover effects display normally
- [ ] Click feedback is timely and clear
- [ ] Button state changes are correct
- [ ] The interaction experience is smooth and natural

---

## ⚠️ Common Problem Checks

### Theme Switching Problems
- Theme switching has no effect
- Some elements have an inconsistent theme
- Abnormal switching animation

### Language Switching Problems
- Language switching is incomplete
- Some text is not translated
- Abnormal layout after switching

### Settings Saving Problems
- Settings are not saved
- Settings are lost after refresh
- Local storage anomalies

### Responsive Problems
- Abnormal layout on small screens
- Elements overlap or are hidden
- Abnormal scrolling behavior

---

## 🤖 AI Verification Execution Template

```javascript
// 1. Open the application
browser_navigate("http://localhost:18181/")

// 2. Get the initial state
browser_snapshot()

// 3. Test theme switching
browser_click(element="Theme toggle button", ref="theme_toggle")
browser_snapshot()

// 4. Test language switching
browser_click(element="Language toggle button", ref="language_toggle")
browser_snapshot()

// 5. Test settings persistence
browser_navigate("http://localhost:18181/") // Refresh the page
browser_snapshot()

// 6. Test responsive layout
browser_resize(375, 667) // Phone size
browser_snapshot()
browser_resize(1920, 1080) // Desktop size
browser_snapshot()

// 7. Test interaction feedback
browser_hover(element="Main button", ref="main_button")
browser_snapshot()
```

**Success criteria:**
- All basic setup features work normally
- Settings can be saved and loaded correctly
- The responsive layout adapts to different screens
- Interaction feedback is timely and accurate
- No error messages or abnormal states
