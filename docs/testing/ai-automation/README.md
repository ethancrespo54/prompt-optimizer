# AI Automated Testing System

## 🎯 Goals

This testing system is specifically designed for AI to perform automated testing through MCP tools. Its main goals are:
- **Find bugs** - Discover potential problems through edge cases and abnormal scenarios
- **Regression testing** - Ensure new features do not break existing ones
- **Stress testing** - Verify system stability under extreme conditions
- **User experience verification** - Discover problems that affect user experience

## 📁 Directory Structure

```
ai-automation/
├── README.md                       # This file
├── electron-mcp-guide.md          # Electron MCP automated testing guide
├── test-scenarios/                 # Test scenarios
│   ├── normal-flow/               # Normal flow tests
│   │   ├── 01-basic-setup.md
│   │   ├── 02-model-management.md
│   │   ├── 02b-model-add-and-test.md  # Model addition and connection tests
│   │   ├── 03-template-management.md
│   │   ├── 04-prompt-optimization.md  # Updated - includes result display feature tests
│   │   ├── 04b-user-prompt-optimization.md  # Updated - includes result display feature tests
│   │   ├── 05-history-management.md
│   │   ├── 06-data-management.md
│   │   ├── 07-ui-interaction-features.md  # New - UI interaction feature tests
│   │   ├── 08-context-persistence.md      # New - Context persistence
│   │   ├── 09-context-variables-and-preview.md  # New - Context variables/preview
│   │   ├── 10-tools-management-and-advanced-context.md  # New - Tools and advanced context
│   │   ├── 11-context-import-export.md   # New - Context import/export
│   │   └── 12-advanced-context-optimization-and-testing.md  # New - Advanced optimization and testing (variables/context/tools)
│   ├── edge-cases/                # Edge case tests
│   │   ├── input-validation.md
│   │   ├── performance-limits.md
│   │   ├── concurrent-operations.md
│   │   └── browser-compatibility.md
│   ├── error-handling/            # Error handling tests
│   │   ├── network-failures.md
│   │   ├── invalid-inputs.md
│   │   ├── storage-failures.md
│   │   └── api-errors.md
│   └── stress-testing/            # Stress tests
│       ├── memory-stress.md
│       ├── rapid-operations.md
│       └── data-volume.md
├── bug-hunting/                   # Dedicated bug-hunting tests
│   ├── ui-glitches.md
│   ├── data-corruption.md
│   ├── race-conditions.md
│   └── memory-leaks.md
├── regression/                    # Regression tests
│   ├── feature-regression.md
│   └── performance-regression.md
├── tools/                         # Test tools and scripts
│   ├── mcp-helpers.md
│   └── test-data-generator.md
└── reports/                       # Test reports
    ├── latest/
    └── history/
```

## 🤖 AI Test Execution Principles

### 1. Bug-First Principle
- Focus on scenarios that are likely to go wrong
- Test boundary conditions and extreme values
- Verify the completeness of error handling
- Discover user experience problems

### 2. Realistic Scenario Simulation
- Simulate real users' usage patterns
- Include unexpected and erroneous operations
- Test different environments and conditions
- Consider concurrency and race conditions

### 3. Systematic Testing
- Cover all major feature paths
- Test interactions between features
- Verify data consistency
- Check performance and stability

## 🔍 Test Category Descriptions

### Normal Flow
- Verify the correctness of basic features
- Ensure the main user paths are usable
- Serve as the baseline for regression tests
- Quickly verify core features

### Edge Cases
- Input validation and boundary tests
- Performance limit tests
- Concurrent operation tests
- Browser compatibility tests

### Error Handling
- Network failure handling
- Invalid input handling
- Storage failure handling
- API error handling

### Stress Testing
- Memory stress tests
- Rapid operation tests
- Large data volume tests
- Long-running tests

### Bug Hunting
- UI display issues
- Data corruption issues
- Race condition issues
- Memory leak issues

## 🛠️ MCP Tool Usage Guide

### Basic Tools
```javascript
// Page operations
browser_navigate(url)
browser_snapshot()
browser_resize(width, height)

// Element interaction
browser_click(element, ref)
browser_type(element, ref, text)
browser_hover(element, ref)

// Waiting and verification
browser_wait_for(text/textGone/time)
browser_take_screenshot(filename)
```

### Advanced Techniques
```javascript
// Rapid consecutive operations (test race conditions)
for (let i = 0; i < 10; i++) {
    browser_click(element, ref);
}

// Large data input (test performance)
browser_type(element, ref, "x".repeat(10000));

// Window size changes (test responsiveness)
browser_resize(320, 568); // Phone size
browser_resize(1920, 1080); // Desktop size
```

## 📊 Test Report Format

### Bug Report Template
```markdown
# Bug Report - [Bug Title]

## Basic Information
- **Discovery time:** 2025-01-07 15:30:00
- **Test scenario:** [Specific test scenario]
- **Severity:** High/Medium/Low
- **Scope of impact:** [Affected features or users]

## Bug Description
[Detailed description of the problem found]

## Reproduction Steps
1. [Specific step 1]
2. [Specific step 2]
3. [Specific step 3]

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happened]

## Environment Information
- **Browser:** Chrome 120.0
- **Operating system:** Windows 11
- **Screen resolution:** 1920x1080
- **Network condition:** Normal/Slow/Offline

## Attachments
- **Screenshot:** bug_screenshot.png
- **Console log:** console_errors.txt
- **Network requests:** network_log.har

## Suggested Solution
[Possible solutions or improvement suggestions]
```

## 🚀 Quick Start

### 1. Choose a Test Scenario
```bash
# Normal flow verification
cd test-scenarios/normal-flow/

# Edge case tests
cd test-scenarios/edge-cases/

# Bug-hunting tests
cd bug-hunting/
```

### 2. Execute Tests
```bash
# Read the test document
# Follow the AI execution guidance to test
# Record the problems found
# Generate the test report
```

### 3. Report Problems
```bash
# Generate the report under the reports/latest/ directory
# Include detailed reproduction steps and evidence
# Provide improvement suggestions
```

## 📈 Test Metrics

### Coverage Metrics
- **Feature coverage** - Proportion of tested features out of all features
- **Scenario coverage** - Degree to which usage scenarios are covered
- **Edge case coverage** - Degree to which edge cases are covered

### Quality Metrics
- **Bug discovery rate** - Number of bugs found per test run
- **Bug severity distribution** - Distribution of high/medium/low severity bugs
- **Regression bug rate** - Proportion of bugs that reappear after being fixed

### Efficiency Metrics
- **Test execution time** - Time to complete one round of testing
- **Problem localization time** - Time from discovery to locating the problem
- **Degree of automation** - Proportion of automated tests

## 🖥️ Electron Desktop App Testing

### Dedicated Guide
See [`electron-mcp-guide.md`](./electron-mcp-guide.md) - the complete guide to Electron MCP automated testing

### Key Differences
- **Launch method**: Use `app_launch_circuit-electron` instead of `browser_navigate`
- **Element locating**: Prefer `click_by_text_circuit-electron`
- **Problem handling**: Make good use of JavaScript execution to work around UI limitations
- **State judgment**: Value interface state over console information

### Test Flow
1. **Build the app**: `pnpm clean && pnpm build`
2. **Launch the test**: Launch in packaged mode
3. **Execute scenarios**: Execute in the normal-flow order
4. **Verify results**: Watch for state changes of functional buttons

### Success Case
- **Test coverage**: 9/9 (100%)
- **Pass rate**: 100%
- **Core verification**: End-to-end AI optimization flow
- **Technical accumulation**: A complete Electron testing methodology

## 🔄 Continuous Improvement

### Test Optimization
- Adjust the testing focus based on discovered problems
- Add new edge case tests
- Optimize test execution efficiency
- Improve the accuracy of bug discovery

### Tool Improvement
- Develop better test helper tools
- Optimize the usage of MCP tools
- Automate test report generation
- Integrate with the CI/CD flow

---

**Note:** This testing system focuses on discovering problems through AI automation, rather than simple feature verification. Every test scenario should be designed to be able to discover potential bugs and user experience problems.
