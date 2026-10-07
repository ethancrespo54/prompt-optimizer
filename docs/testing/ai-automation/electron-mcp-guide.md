# Electron MCP Automated Testing Guide

## 📖 Overview

This guide summarizes best practices and key techniques for AI automated testing of Electron desktop applications using MCP (Model Context Protocol).

## 🚀 Launching and Connecting

### Launching the Electron App
```javascript
// 1. Make sure the app is built
// Run: pnpm clean && pnpm build

// 2. Launch the Electron app
app_launch_circuit-electron({
  app: "/path/to/project/packages/desktop/dist/win-unpacked/YourApp.exe",
  mode: "packaged",  // Key: use packaged mode
  includeSnapshots: true,
  timeout: 60000
})
```

### Differences from Browser Testing
- **Browser**: `browser_navigate` to a URL
- **Electron**: `app_launch_circuit-electron` launches the executable
- **Build requirement**: Electron must be built before it can be tested

## 🎯 Element Locating Strategy

### Priority Order (Important!)
1. **click_by_text_circuit-electron** (highest priority, most stable)
2. **smart_click_circuit-electron** (automatic strategy detection)
3. **click_circuit-electron** (CSS selector)
4. **evaluate_circuit-electron** (JavaScript execution, last resort)

### Best Practice Examples
```javascript
// ✅ Preferred: text click
click_by_text_circuit-electron({
  sessionId: "session-id",
  text: "⚙️ Model Manager"
})

// ⚠️ Alternative: CSS selector
click_circuit-electron({
  sessionId: "session-id", 
  selector: "button:nth-child(4)"
})

// 🔧 Last resort: JavaScript execution
evaluate_circuit-electron({
  sessionId: "session-id",
  script: `
    const buttons = document.querySelectorAll('button');
    for (let button of buttons) {
      if (button.textContent.includes('Model Manager')) {
        button.click();
        break;
      }
    }
  `
})
```

## ⚠️ Solving Common Problems

### 1. Element Obstruction
**Symptom**: `Error: <element> intercepts pointer events`

**Solutions**:
```javascript
// Option 1: Use the Escape key to close the obstructing element
key_circuit-electron({ sessionId: "session-id", key: "Escape" })

// Option 2: Click a blank area
evaluate_circuit-electron({ script: "document.body.click();" })

// Option 3: Bypass the obstruction with JavaScript
evaluate_circuit-electron({
  script: `
    const button = document.querySelector('button[text="Target"]');
    if (button && !button.closest('.fixed')) {
      button.click();
    }
  `
})
```

### 2. Elements Stop Working After Language Switch
**Problem**: After switching the language, text selectors stop working

**Solution**:
```javascript
// ❌ Hard-coded text
click_by_text_circuit-electron({ text: "Model Manager" })

// ✅ Use contains matching
evaluate_circuit-electron({
  script: `
    const buttons = document.querySelectorAll('button');
    for (let button of buttons) {
      if (button.textContent.includes('Model') && 
          button.textContent.includes('Manager')) {
        button.click();
        break;
      }
    }
  `
})
```

### 3. Misleading Console Error Messages
**Important**: Do not rely solely on console error messages to judge feature state

**Correct approach**:
```javascript
// ✅ Focus on interface state changes
// - Check the appearance of the V1 and V2 buttons
// - Check the activation of the Continue Optimize button
// - Check disabled/pressed/focused states

// ❌ Wrong approach: relying only on console error messages
```

## 🛠️ Input and Waiting Strategies

### Text Input Best Practices
```javascript
evaluate_circuit-electron({
  script: `
    const textbox = document.querySelector('textarea[placeholder*="prompt"]');
    if (textbox && textbox.offsetParent !== null) {
      textbox.value = 'test content';
      textbox.dispatchEvent(new Event('input', { bubbles: true }));
      textbox.dispatchEvent(new Event('change', { bubbles: true }));
      textbox.focus();
      return 'success';
    }
    return 'not found';
  `
})
```

### Waiting Strategies
```javascript
// Basic wait
wait_for_load_state_circuit-electron({
  sessionId: "session-id",
  state: "load",
  timeout: 5000
})

// Waiting for AI requests (important: AI requests take longer)
wait_for_load_state_circuit-electron({
  sessionId: "session-id", 
  state: "networkidle",
  timeout: 15000
})
```

### Timeout Recommendations
- **Basic operations**: 3-5 seconds
- **AI requests**: 10-20 seconds  
- **File operations**: 5-10 seconds
- **App launch**: 60 seconds

## 🔍 State Checking and Debugging

### Interface State Checking
```javascript
// Use snapshot to check interface state
snapshot_circuit-electron({ sessionId: "session-id" })

// Key state indicators:
// - pressed state (button activated)
// - disabled state (button availability)
// - focused state (current focus)
// - value field (input content)
```

### Debugging Tips
```javascript
// Debug element visibility
evaluate_circuit-electron({
  script: `
    const elements = document.querySelectorAll('button');
    return Array.from(elements).map(el => ({
      text: el.textContent.trim(),
      visible: el.offsetParent !== null,
      disabled: el.disabled
    }));
  `
})
```

## 🚨 Session Management

### Handling Session Disconnection
```javascript
try {
  click_by_text_circuit-electron({ sessionId, text: "button" })
} catch (error) {
  if (error.message.includes('page has been closed')) {
    // Relaunch the app
    sessionId = app_launch_circuit-electron({ 
      app: appPath,
      mode: "packaged",
      includeSnapshots: true 
    })
  }
}
```

## 📊 Test Execution Flow

### 1. Preparation Phase
```bash
# Build the app
pnpm clean && pnpm build

# Make sure external services are running (if needed)
# For example: start the Ollama service
```

### 2. Test Execution
```javascript
// Launch the app
const sessionId = app_launch_circuit-electron({...})

// Get the initial state
snapshot_circuit-electron({ sessionId })

// Execute test steps
// ...

// Close the app
close_circuit-electron({ sessionId })
```

### 3. Result Verification
- Focus on interface state changes
- Verify the activation state of functional buttons
- Check data persistence effects

## 🎯 Electron-Specific Advantages

### 1. Real Application Environment
- Test the real desktop app experience
- Verify file system operations
- Test system integration features

### 2. Persistence Testing
- Configuration is retained after app restart
- Data persistence verification
- Real user workflows

### 3. Complete Feature Testing
- End-to-end user experience
- Real performance
- System-level integration tests

## 📝 Test Scenario Templates

### Basic Feature Test
```javascript
// 1. Launch the app
// 2. Check the initial state
// 3. Perform the feature operation
// 4. Verify the result
// 5. Check persistence
```

### AI Feature Test
```javascript
// 1. Configure the model
// 2. Enter test data
// 3. Perform the AI operation
// 4. Wait for the AI response
// 5. Verify result quality
```

## 🏆 Success Criteria

### Technical Metrics
- All test scenarios pass
- No crashes or exceptions
- Reasonable response times

### User Experience
- Smooth operation flow
- Proper error handling
- Safe and reliable data

---

**Last updated:** 2025-01-09  
**Scope:** AI automated testing of Electron desktop applications
