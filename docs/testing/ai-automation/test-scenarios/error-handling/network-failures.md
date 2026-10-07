# Network Failure Error Handling Tests

## 📖 Test Overview
Test the application's error handling ability under various network failure situations, and discover bugs related to network anomaly handling.

## 🎯 Test Goals
- Verify the network error handling mechanism
- Test retry and recovery logic
- Discover user experience problems
- Verify the accuracy of error messages

## 🔍 Bug-Hunting Focus
- Improper network error handling
- Unclear user prompts
- Retry mechanism failure
- State management confusion
- Data loss risk

---

## 🧪 Test Scenarios

### Scenario 1: API Call Timeout Test

**Test purpose:** Discover bugs in API timeout handling

**AI execution guidance:**
```javascript
// Prepare test data
browser_type(element="Original prompt input box", ref="e54", text="Network timeout test content");

// Start optimization (may time out)
browser_click(element="Start optimization button", ref="e78");

// Wait a long time to observe timeout handling
browser_wait_for(time=60); // Wait 1 minute

// Check error handling
browser_snapshot();

// Test the retry feature
browser_click(element="Start optimization button", ref="e78");
browser_wait_for(time=30);
browser_snapshot();
```

**Expected problems to discover:**
- No error message after timeout
- Button state is not restored
- The loading state keeps showing
- The retry feature fails
- The user cannot tell what happened

**Verification points:**
- [ ] There is a clear error message after timeout
- [ ] The button state is restored correctly
- [ ] The loading state is cleared correctly
- [ ] A retry option is provided
- [ ] The error message is user-friendly

---

### Scenario 2: Network Connection Interruption Test

**Test purpose:** Discover handling problems when the network is interrupted

**AI execution guidance:**
```javascript
// Start the optimization operation
browser_type(element="Original prompt input box", ref="e54", text="Network interruption test");
browser_click(element="Start optimization button", ref="e78");

// Wait for the request to be sent, then simulate a network interruption
browser_wait_for(time=2);

// Check the state during the network interruption
browser_snapshot();

// Wait for network error handling
browser_wait_for(time=30);
browser_snapshot();

// Simulate network recovery and test reconnection
browser_click(element="Start optimization button", ref="e78");
browser_wait_for(time=10);
browser_snapshot();
```

**Expected problems to discover:**
- Delayed detection of network interruption
- Inaccurate error messages
- Automatic reconnection fails
- Inconsistent data state
- User operations are blocked

**Verification points:**
- [ ] The network interruption is detected quickly
- [ ] The error message is accurate and clear
- [ ] The automatic reconnection mechanism works
- [ ] The data state stays consistent
- [ ] The user can retry manually

---

### Scenario 3: Invalid API Key Test

**Test purpose:** Discover handling problems for API authentication errors

**AI execution guidance:**
```javascript
// First open model management
browser_click(element="Model Manager button", ref="e21");
browser_wait_for(time=2);

// Enter an invalid API key (if it can be modified)
// This needs to be adjusted according to the actual interface
browser_type(element="API key input box", ref="api_key_input", text="invalid_api_key_test");

// Save the configuration
browser_click(element="Save button", ref="save_button");
browser_wait_for(time=2);

// Close model management
browser_press_key("Escape");

// Try to perform optimization
browser_type(element="Original prompt input box", ref="e54", text="Invalid API key test");
browser_click(element="Start optimization button", ref="e78");

// Wait for error handling
browser_wait_for(time=10);
browser_snapshot();
```

**Expected problems to discover:**
- Unclear authentication error message
- Delayed error handling
- The user does not know how to resolve it
- The error state keeps showing
- The configuration entry point is not obvious

**Verification points:**
- [ ] The authentication error message is clear
- [ ] The authentication problem is detected quickly
- [ ] Guidance for resolution is provided
- [ ] The error state is cleared correctly
- [ ] The configuration entry point is easy to access

---

### Scenario 4: Server Error Response Test

**Test purpose:** Discover problems in server error handling

**AI execution guidance:**
```javascript
// Prepare test data
browser_type(element="Original prompt input box", ref="e54", text="Server error test content");

// Start optimization
browser_click(element="Start optimization button", ref="e78");

// Wait for a possible server error
browser_wait_for(time=20);
browser_snapshot();

// Check the state after error handling
browser_wait_for(time=10);
browser_snapshot();

// Test error recovery
browser_click(element="Start optimization button", ref="e78");
browser_wait_for(time=15);
browser_snapshot();
```

**Expected problems to discover:**
- Improper handling of server error codes
- Error messages that are too technical
- Unreasonable retry strategy
- Insufficient error logging
- Poor user experience

**Verification points:**
- [ ] Server errors are handled correctly
- [ ] The error message is user-friendly
- [ ] The retry strategy is reasonable
- [ ] The error log is complete
- [ ] The user experience is good

---

### Scenario 5: Partial Network Failure Test

**Test purpose:** Discover handling problems when some network features are abnormal

**AI execution guidance:**
```javascript
// Test multi-feature operations under an unstable network
browser_type(element="Original prompt input box", ref="e54", text="Partial network failure test");

// Try multiple network operations at the same time
browser_click(element="Start optimization button", ref="e78");
browser_click(element="History button", ref="e18");
browser_click(element="Template management button", ref="e15");

// Wait for the various network requests to be processed
browser_wait_for(time=15);
browser_snapshot();

// Check the state of each feature
browser_press_key("Escape"); // Close possible popups
browser_press_key("Escape");
browser_snapshot();

// Test feature recovery
browser_click(element="Start optimization button", ref="e78");
browser_wait_for(time=10);
browser_snapshot();
```

**Expected problems to discover:**
- A partial feature failure affects everything globally
- Error state propagation
- Features interfere with each other
- The recovery mechanism is incomplete
- Inconsistent state

**Verification points:**
- [ ] A partial failure does not affect other features
- [ ] Error state is well isolated
- [ ] Features run independently
- [ ] The recovery mechanism is complete
- [ ] State stays consistent

---

### Scenario 6: Slow Network Connection Test

**Test purpose:** Discover user experience problems on a slow network

**AI execution guidance:**
```javascript
// Test the user experience on a slow network
browser_type(element="Original prompt input box", ref="e54", text="Slow network test content");

// Start optimization
browser_click(element="Start optimization button", ref="e78");

// Test user interaction while waiting
browser_wait_for(time=5);

// Try to cancel the operation
browser_press_key("Escape");
browser_snapshot();

// Try other operations
browser_click(element="History button", ref="e18");
browser_snapshot();

// Wait for the original request to complete
browser_wait_for(time=30);
browser_snapshot();
```

**Expected problems to discover:**
- Missing progress indication
- Long-running operations cannot be canceled
- The user does not know the operation state
- The interface appears frozen
- Unreasonable timeout settings

**Verification points:**
- [ ] There is a clear progress indication
- [ ] Long-running operations can be canceled
- [ ] The operation state is clearly displayed
- [ ] The interface stays responsive
- [ ] The timeout settings are reasonable

---

### Scenario 7: Network Error Recovery Test

**Test purpose:** Discover problems in the network error recovery mechanism

**AI execution guidance:**
```javascript
// Simulate the recovery flow after a network error
browser_type(element="Original prompt input box", ref="e54", text="Network recovery test");

// First attempt (may fail)
browser_click(element="Start optimization button", ref="e78");
browser_wait_for(time=10);
browser_snapshot();

// Wait for error handling
browser_wait_for(time=5);

// Second attempt (test retry)
browser_click(element="Start optimization button", ref="e78");
browser_wait_for(time=10);
browser_snapshot();

// Third attempt (test continuous recovery)
browser_click(element="Start optimization button", ref="e78");
browser_wait_for(time=15);
browser_snapshot();

// Check the final state
browser_wait_for(time=5);
browser_snapshot();
```

**Expected problems to discover:**
- Unreasonable retry count limit
- The recovery strategy is not smart
- Residual error state
- Insufficient user guidance
- Data consistency problems

**Verification points:**
- [ ] The retry count is reasonable
- [ ] The recovery strategy is smart
- [ ] The error state is cleared correctly
- [ ] User guidance is sufficient
- [ ] Data stays consistent

---

## 🐛 Network Error Bug Patterns

### Error Detection Bugs
- Delayed network error detection
- Inaccurate error type identification
- Wrong error state judgment
- Unreasonable timeout settings

### Error Handling Bugs
- Unclear error messages
- Missing error recovery mechanism
- Improper retry strategy
- Insufficient user guidance

### State Management Bugs
- Residual error state
- Untimely state updates
- Inconsistent state
- Wrong state propagation

### User Experience Bugs
- Missing progress indication
- Operations cannot be canceled
- Error messages that are too technical
- Unclear recovery path

---

## 📊 Network Error Test Report Template

```markdown
# Network Error Handling Bug Report

## Bug Information
- **Discovery time:** [Time]
- **Network scenario:** [Specific type of network failure]
- **Severity:** High/Medium/Low
- **Bug type:** Error detection/Error handling/State management/User experience

## Network Failure Description
[Detailed description of the type and conditions of the network failure]

## Reproduction Steps
1. [Simulate the network failure]
2. [Perform the operation]
3. [Observe the error handling]

## Expected Behavior
[How the network error should be handled correctly]

## Actual Behavior
[The actual error handling behavior]

## User Impact
- **Operation interruption:** [Whether user operations are affected]
- **Data loss:** [Whether there is a risk of data loss]
- **Experience impact:** [Impact on user experience]

## Improvement Suggestions
- **Error detection:** [Improvement of the detection mechanism]
- **Error handling:** [Improvement of the handling logic]
- **User prompts:** [Improvement of the prompt messages]
- **Recovery mechanism:** [Improvement of the recovery strategy]
```

---

**Note:** Network failure tests need to be conducted in a controlled environment, and may require network simulation tools to create various failure scenarios.
