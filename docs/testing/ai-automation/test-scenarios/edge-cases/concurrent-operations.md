# Concurrent Operations Edge Case Tests

## 📖 Test Overview
Test the application's stability under concurrent operations and race conditions, and discover bugs related to multithreading and asynchronous operations.

## 🎯 Test Goals
- Discover race condition bugs
- Test concurrent operation handling
- Verify state management consistency
- Discover resource contention problems

## 🔍 Bug-Hunting Focus
- Data races and inconsistent state
- Duplicate request handling
- Resource locking problems
- Memory leaks and resource release
- UI state confusion

---

## 🧪 Test Scenarios

### Scenario 1: Rapid Consecutive Click Test

**Test purpose:** Discover bugs in button debouncing and duplicate request handling

**AI execution guidance:**
```javascript
// Rapidly and consecutively click the optimize button
browser_type(element="Original prompt input box", ref="e54", text="Concurrency test content");

// Rapidly click 10 times in a row
for (let i = 0; i < 10; i++) {
    browser_click(element="Start optimization button", ref="e78");
    // Do not wait, click again immediately
}

// Check the state
browser_snapshot();
browser_wait_for(time=5);
browser_snapshot();
```

**Expected problems to discover:**
- Multiple optimization requests are sent at the same time
- Button state management is confused
- Results are displayed duplicated or garbled
- Duplicate network requests
- The interface freezes or becomes unresponsive

**Verification points:**
- [ ] Only one request is processed
- [ ] Button state is managed correctly
- [ ] Results are displayed normally
- [ ] There are no duplicate network requests
- [ ] The interface stays responsive

---

### Scenario 2: Operating Multiple Features Simultaneously Test

**Test purpose:** Discover conflicts in concurrent operation of multiple features

**AI execution guidance:**
```javascript
// Enter content
browser_type(element="Original prompt input box", ref="e54", text="Multi-feature concurrency test");

// Trigger multiple operations at the same time
browser_click(element="Start optimization button", ref="e78"); // Start optimization
browser_click(element="Model Manager button", ref="e21"); // Open model management
browser_click(element="Template management button", ref="e15"); // Open template management
browser_click(element="History button", ref="e18"); // Open history

// Check the state
browser_snapshot();

// Try to continue operating while the popups are open
browser_click(element="Start optimization button", ref="e78");
browser_snapshot();
```

**Expected problems to discover:**
- Popup layering confusion
- The optimization process is interrupted
- Inconsistent data state
- Interface elements overlap
- Focus management errors

**Verification points:**
- [ ] Popups are managed correctly
- [ ] The optimization process is not affected
- [ ] Data state is consistent
- [ ] The interface displays normally
- [ ] Focus management is correct

---

### Scenario 3: Interfering Operations During Optimization Test

**Test purpose:** Discover handling bugs when the optimization process is interfered with

**AI execution guidance:**
```javascript
// Start optimization
browser_type(element="Original prompt input box", ref="e54", text="Optimization interference test");
browser_click(element="Start optimization button", ref="e78");

// Perform various interfering operations during optimization
browser_wait_for(time=1); // Wait for the optimization to start

// Try modifying the input
browser_type(element="Original prompt input box", ref="e54", text="Modified content");

// Try switching the model
browser_click(element="Model select button", ref="e59");

// Try switching the template
browser_click(element="Template select button", ref="e69");

// Try clicking optimize again
browser_click(element="Start optimization button", ref="e78");

// Check the final state
browser_wait_for(time=10);
browser_snapshot();
```

**Expected problems to discover:**
- The optimization result does not match the input
- The optimization process is abnormally interrupted
- Wrong state display
- Inconsistent data
- Interface state confusion

**Verification points:**
- [ ] The optimization result correctly corresponds to the input
- [ ] The optimization process is stable
- [ ] The state display is accurate
- [ ] Data stays consistent
- [ ] The interface state is normal

---

### Scenario 4: Multi-Window/Tab Concurrency Test

**Test purpose:** Discover data synchronization problems when running multiple instances

**AI execution guidance:**
```javascript
// Start operating in the current window
browser_type(element="Original prompt input box", ref="e54", text="Window 1 test content");
browser_click(element="Start optimization button", ref="e78");

// Open a new tab
browser_tab_new("http://localhost:18181/");

// Operate in the new tab
browser_type(element="Original prompt input box", ref="e54", text="Window 2 test content");
browser_click(element="Start optimization button", ref="e78");

// Switch back to the first tab
browser_tab_select(0);
browser_snapshot();

// Switch to the second tab
browser_tab_select(1);
browser_snapshot();

// Check whether the data is synchronized
browser_click(element="History button", ref="e18");
browser_snapshot();
```

**Expected problems to discover:**
- Data is not synchronized
- History records are confused
- Configuration conflicts
- Storage contention
- Inconsistent state

**Verification points:**
- [ ] Data is synchronized correctly
- [ ] History records are accurate
- [ ] Configuration stays consistent
- [ ] Storage operations are normal
- [ ] State management is correct

---

### Scenario 5: Network Interruption Recovery Test

**Test purpose:** Discover concurrent handling problems under network anomalies

**AI execution guidance:**
```javascript
// Start multiple optimization operations
const testPrompts = [
    "Network test 1: AI development",
    "Network test 2: Machine learning applications", 
    "Network test 3: Deep learning principles"
];

// Rapidly start multiple optimizations
for (const prompt of testPrompts) {
    browser_type(element="Original prompt input box", ref="e54", text=prompt);
    browser_click(element="Start optimization button", ref="e78");
    browser_wait_for(time=1);
}

// Simulate retry after the network recovers
browser_wait_for(time=5);

// Check the state of each request
browser_snapshot();

// Try optimizing again
browser_click(element="Start optimization button", ref="e78");
browser_snapshot();
```

**Expected problems to discover:**
- Request queue confusion
- The retry mechanism fails
- Wrong state display
- Data loss
- The interface appears frozen

**Verification points:**
- [ ] The request queue is managed correctly
- [ ] The retry mechanism is normal
- [ ] The state display is accurate
- [ ] Data is saved completely
- [ ] The interface stays responsive

---

### Scenario 6: Concurrency Test Under Memory Pressure

**Test purpose:** Discover concurrency handling problems when memory is low

**AI execution guidance:**
```javascript
// Create a large amount of data
const largePrompt = "Large data test content. ".repeat(1000);

// Perform multiple large-data optimizations in a row
for (let i = 0; i < 5; i++) {
    browser_type(element="Original prompt input box", ref="e54", text=`${largePrompt} Test #${i+1}`);
    browser_click(element="Start optimization button", ref="e78");
    
    // Open other features during optimization
    browser_click(element="History button", ref="e18");
    browser_click(element="Template management button", ref="e15");
    
    // Close the popups
    browser_press_key("Escape");
    browser_press_key("Escape");
    
    browser_wait_for(time=2);
}

// Check the final state
browser_snapshot();
```

**Expected problems to discover:**
- Memory leaks
- Sharp performance degradation
- Interface freezes or crashes
- Data processing errors
- Resource release failures

**Verification points:**
- [ ] Memory usage is reasonable
- [ ] Performance stays stable
- [ ] The interface responds normally
- [ ] Data is processed correctly
- [ ] Resources are released correctly

---

### Scenario 7: Rapid Feature Module Switching Test

**Test purpose:** Discover state management problems when switching feature modules

**AI execution guidance:**
```javascript
// Rapidly switch between feature modules
const actions = [
    () => browser_click(element="Model Manager button", ref="e21"),
    () => browser_click(element="Template management button", ref="e15"),
    () => browser_click(element="History button", ref="e18"),
    () => browser_click(element="Data management button", ref="e24"),
    () => browser_press_key("Escape"), // Close the popup
];

// Execute rapidly in a loop
for (let round = 0; round < 3; round++) {
    for (const action of actions) {
        action();
        browser_wait_for(time=0.5); // Very short wait time
    }
}

// Check the final state
browser_snapshot();

// Test whether basic features still work normally
browser_type(element="Original prompt input box", ref="e54", text="Test after feature switching");
browser_click(element="Start optimization button", ref="e78");
browser_wait_for(time=5);
browser_snapshot();
```

**Expected problems to discover:**
- Module state confusion
- Event listener leaks
- Interface rendering errors
- Inconsistent data state
- Features stop working

**Verification points:**
- [ ] Module state is correct
- [ ] Event handling is normal
- [ ] Interface rendering is correct
- [ ] Data state is consistent
- [ ] Features work normally

---

## 🐛 Concurrency Bug Patterns

### Race Condition Bugs
- Multiple requests modify state at the same time
- Asynchronous operations execute out of order
- Resource access conflicts
- Lost state updates

### Resource Management Bugs
- Memory leaks
- Event listeners not cleaned up
- Network connections not closed
- Timers not cleared

### State Synchronization Bugs
- Inconsistent interface state
- Confused data state
- Unsynchronized caches
- Storage conflicts

### Performance-Related Bugs
- Concurrent operations cause freezing
- Resource contention affects performance
- Queue buildup
- Increased response time

---

## 📊 Concurrency Test Report Template

```markdown
# Concurrent Operation Bug Report

## Bug Information
- **Discovery time:** [Time]
- **Concurrency scenario:** [Specific concurrent operations]
- **Severity:** High/Medium/Low
- **Bug type:** Race condition/Resource management/State synchronization/Performance

## Concurrent Operation Description
[Detailed description of the steps and timing of the concurrent operations]

## Reproduction Steps
1. [Specific step]
2. [Concurrent operation]
3. [Observed result]

## Expected Behavior
[How the concurrent operations should be handled correctly]

## Actual Behavior
[The problem that actually occurred]

## Impact Assessment
- **Data integrity:** [Whether data is affected]
- **User experience:** [Impact on users]
- **System stability:** [Impact on the system]

## Technical Analysis
- **Possible cause:** [Technical analysis]
- **Components involved:** [Related code components]
- **Fix suggestion:** [Technical fix proposal]
```

---

**Note:** Concurrency tests may cause the application state to become abnormal. It is recommended to run them in a test environment and to have a way ready to reset the application state.
