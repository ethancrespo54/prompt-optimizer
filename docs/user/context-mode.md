# Context Mode Usage Guide

This document explains how to use Prompt Optimizer's "Context Mode", when to use it, and common pitfalls.

In the UI, Context Mode corresponds to "Context" in the top-level function mode selector, and it provides two sub-modes:

- Multi-message: "message-level optimization" for multi-turn conversations/multiple messages
- Variable: "variable- and tool-driven optimization" for a single user prompt

## 1. In One Sentence: What Problem Does Context Mode Solve?

When you find that "single prompt optimization" is not stable enough, what is usually missing is context information (upfront constraints, examples, tool availability, variable values, etc.).

The core value of Context Mode is:

- During optimization, the "conversation messages / variables / tools" you configured are handed to the model together as context
- The optimization result fits the real runtime environment better (instead of looking at an isolated piece of text only)

## 2. Pick the Right Mode First: Multi-message vs Variable

Use the table below to decide quickly:

| What you are doing | Recommended sub-mode |
| --- | --- |
| You are doing role-play/multi-turn conversation and want to optimize one system/user message so its style stays consistent with the context | Multi-message |
| You are writing "a single user prompt" that contains many reusable parameters (such as names, dates, specs, output format), and want to manage and test them with {{var}} | Variable |
| You want to configure/manage tools (Function Calling) and verify tool-calling behavior during testing | Variable (matches the UI behavior better) |

Tip: both sub-modes support running different variables/different versions side by side in multiple columns in the test area on the right.

## 3. Multi-message Quick Start

Suited for: optimizing one system/user message in a conversation (not asking the model to answer).

### Step 0: Enter Multi-message Mode

1. Select "Context" in the top function mode selector
2. Select "Multi-message" as the sub-mode

### Step 1: Prepare the Conversation Context

Add/edit messages in the conversation management area on the left:

- system/user/assistant/tool messages can all exist in the context
- But the "target that can be optimized" is usually a system or user message

### Step 2: Select the Message You Want to Optimize

Key point: you must select a system/user message, otherwise the "Optimize" button will be unavailable.

### Step 3: Choose a Model and Template

We recommend starting with the built-in templates:

- General Message Optimization (recommended): suitable for the vast majority of conversation scenarios

Its core rules are:

- Optimizing != replying (only rewrite that message itself)
- Keep the original message role unchanged (system stays system, user stays user)
- Keep all {{variable placeholders}} exactly as they are

### Step 4: Click "Optimize" and Understand V0/V1

Optimization in multi-message mode is a "message-level version chain":

- V0: the original content (saved when first created, used for rollback)
- V1: the optimized content (applied back to the conversation by default)

If you feel the result got worse after optimization, the right approach is:

- Switch the version back to V0 or another version (rather than copying and pasting to roll back manually)

### Step 5: Verify the Result in the Test Area on the Right

We recommend treating testing as an "acceptance step":

1. Fill in variables in the test area (if the conversation uses {{var}})
2. Run the test (you can compare different variable combinations/different versions side by side in multiple columns)
3. Check whether the output meets your expected format, tone, and constraints

## 4. Variable Quick Start

Suited for: optimizing "a single user prompt" and extracting its variable information into variables for easier reuse and testing.

### Step 0: Enter Variable Mode

1. Select "Context" in the top function mode selector
2. Select "Variable" as the sub-mode

### Step 1: Write the Prompt with {{var}}

You can write reusable parameters as double-curly-brace variables, for example:

```text
Based on the requirements of {{product_name}}, produce a plan in {{output_format}} format.
Constraints: budget {{budget}}, delivery time {{deadline}}.
```

Tip: typing `{{}}` usually triggers variable autocomplete.

### Step 2: Manage Variable Values (Make Testing Reproducible)

Variable mode flags missing variables and provides a preview:

- Missing variables: fill in the variable values first, then look at the optimization/test results
- Preview: confirm that the final rendered prompt matches expectations (whether placeholders were replaced correctly)

### Step 3: Optional: Configure Tools (Function Calling)

If you want the prompt to run in an environment where tools can be called:

1. Maintain tool definitions (name, description, parameters, etc.) in tool management
2. During testing, verify whether the model triggers tools as expected

### Step 4: Choose a Template and Start Optimizing

The templates for variable mode usually emphasize:

- Under context/tool constraints, rewrite the original user prompt to be clearer, more actionable, and more verifiable
- All {{var}} placeholders must be kept

We recommend starting with "Context Edition - Basic User Prompt Optimization".

## 5. FAQ (Frequent Pitfalls)

### Q1: Why does the output of "Context Mode" feel like it is answering me?

The recommended template for multi-message mode explicitly requires "output only the optimized message", not a generated reply.
If you switched to a custom template, check whether the template contains "answer the task" instructions.

### Q2: Why is the Optimize button grayed out?

In multi-message mode this is usually because:

- No system/user message to optimize is selected
- No model or no template is selected

### Q3: The optimized content directly changed the original message. Is that a bug?

No. Multi-message mode applies V1 back to the conversation by default, so you can continue testing in the "real context".
If you are not satisfied, switch the version back to V0.

### Q4: What if a variable is not replaced / the preview still shows {{var}}?

It means the variable has no value assigned. Fill in the variable value, then preview or test again.
