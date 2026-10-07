# Real LLM Test Helper Utilities

This directory contains helper utilities that simplify testing against real LLM APIs.

## Overview

`real-llm.ts` provides a set of basic methods for obtaining a real LLM interface in unit tests. It automatically selects an available provider and model based on local environment variables, with no manual configuration required.

## Features

- ✅ **Automatic detection of available providers** - Automatically selects the first available LLM provider based on environment variables
- ✅ **Zero configuration** - No need to hard-code model names or API URLs
- ✅ **Multi-provider support** - Supports OpenAI, Anthropic, Gemini, DeepSeek, ModelScope, Zhipu, and more
- ✅ **Type safe** - Complete TypeScript type definitions
- ✅ **Easy to use** - Create a test context with a single line of code

## Supported Providers

| Provider | API key environment variable |
|--------|---------------|
| OpenAI | `VITE_OPENAI_API_KEY` or `OPENAI_API_KEY` |
| Anthropic | `VITE_ANTHROPIC_API_KEY` or `ANTHROPIC_API_KEY` |
| Google Gemini | `VITE_GEMINI_API_KEY` or `GEMINI_API_KEY` |
| DeepSeek | `VITE_DEEPSEEK_API_KEY` or `DEEPSEEK_API_KEY` |
| ModelScope | `VITE_MODELSCOPE_API_KEY` or `MODELSCOPE_API_KEY` |
| Zhipu AI | `VITE_ZHIPU_API_KEY` or `ZHIPU_API_KEY` |

**Notes**:
- The helper uses the built-in `getDefaultTextModels()` function to obtain the configuration
- The BaseURL is set automatically by each provider's adapter
- Only the `custom` provider supports customizing the BaseURL through the `VITE_CUSTOM_API_BASE_URL` environment variable

## Quick Start

### 1. Set environment variables

Create a `.env.local` file in the project root directory:

```bash
# Set the API key for at least one provider
VITE_OPENAI_API_KEY=your_openai_api_key
# or
VITE_GEMINI_API_KEY=your_gemini_api_key
# or others...
```

### 2. Enable real API tests

Set `RUN_REAL_API=1` when running tests:

```bash
# Run all real API tests
RUN_REAL_API=1 pnpm test

# Run a specific test file
RUN_REAL_API=1 pnpm test real-llm.example.test.ts
```

### 3. Write tests

```typescript
import { describe, it, expect } from 'vitest';
import { createRealLLMTestContext, hasAvailableProvider } from './helpers/real-llm';

const RUN_REAL_API = process.env.RUN_REAL_API === '1';

describe.skipIf(!RUN_REAL_API)('My Real API Test', () => {
  it.skipIf(!hasAvailableProvider())('should be able to call the real LLM', async () => {
    // Create the test context (automatically selects the first available provider)
    const context = await createRealLLMTestContext();
    if (!context) {
      console.log('Skipping test: no LLM provider available');
      return;
    }

    // Send a message using the LLM service
    const messages = [{ role: 'user', content: 'Hello!' }];
    const response = await context.llmService.sendMessage(messages, context.modelKey);

    // Verify the response
    expect(response.content).toBeDefined();
    expect(response.content.length).toBeGreaterThan(0);
  }, 30000);
});
```

## API Reference

### `createRealLLMTestContext(options?)`

Creates a real LLM test context and automatically selects the first available provider.

**Parameters:**
```typescript
interface Options {
  /** Parameter overrides (such as temperature) */
  paramOverrides?: Record<string, any>;
}
```

**Returns:**
```typescript
interface RealLLMTestContext {
  /** Provider information */
  provider: AvailableProvider;
  /** Model configuration (uses the first available model) */
  modelConfig: TextModelConfig;
  /** LLM service instance */
  llmService: ILLMService;
  /** Model manager instance */
  modelManager: IModelManager;
  /** Model key (already added to modelManager) */
  modelKey: string;
}
```

**Example:**
```typescript
// Use the default configuration
const context = await createRealLLMTestContext();

// Use custom parameters
const context = await createRealLLMTestContext({
  paramOverrides: {
    temperature: 0.7,
    max_tokens: 1000,
  },
});
```

### `hasAvailableProvider()`

Checks whether at least one provider is available.

**Returns:** `boolean`

**Example:**
```typescript
if (!hasAvailableProvider()) {
  console.log('No API key available');
  return;
}
```

### `getAvailableProviders()`

Gets the list of all available providers.

**Returns:** `AvailableProvider[]`

**Example:**
```typescript
const providers = getAvailableProviders();
console.log(`Found ${providers.length} available providers`);

providers.forEach(p => {
  console.log(`- ${p.config.name}: ${p.models.length} models`);
});
```

### `getFirstAvailableProvider()`

Gets the first available provider.

**Returns:** `AvailableProvider | undefined`

**Example:**
```typescript
const provider = getFirstAvailableProvider();
if (provider) {
  console.log(`Using provider: ${provider.config.name}`);
  console.log(`Model: ${provider.models[0].name}`);
}
```

### `printAvailableProviders()`

Prints information about the available providers (for debugging).

**Example:**
```typescript
beforeAll(() => {
  printAvailableProviders();
});

// Output:
// ✅ Found 2 available providers:
//
// 1. OpenAI
//    - Provider ID: openai
//    - Models: 15 available models
//    - First Model: GPT-4 Turbo (gpt-4-turbo)
//
// 2. Google Gemini
//    - Provider ID: gemini
//    - Models: 5 available models
//    - First Model: Gemini 2.0 Flash (gemini-2.0-flash)
```

### `createTestConfig(provider, paramOverrides?)`

Creates a test configuration from a provider (low-level API).

**Parameters:**
- `provider: AvailableProvider` - Provider information
- `paramOverrides?: Record<string, any>` - Parameter overrides

**Returns:** `TextModelConfig`

**Note:** This function directly uses the model configuration loaded by the system and does not require specifying a model index.

## Usage Examples

### Example 1: Basic LLM call

```typescript
it('should be able to send a message', async () => {
  const context = await createRealLLMTestContext();
  if (!context) return;

  const messages = [
    { role: 'user', content: 'Introduce yourself in one sentence' }
  ];

  const response = await context.llmService.sendMessage(
    messages,
    context.modelKey
  );

  expect(response.content).toBeDefined();
  console.log(`Response: ${response.content}`);
}, 30000);
```

### Example 2: Multi-turn conversation

```typescript
it('should be able to hold a multi-turn conversation', async () => {
  const context = await createRealLLMTestContext();
  if (!context) return;

  // Round 1
  const messages1 = [
    { role: 'user', content: 'My name is Alice' }
  ];
  const response1 = await context.llmService.sendMessage(messages1, context.modelKey);

  // Round 2 (with context)
  const messages2 = [
    { role: 'user', content: 'My name is Alice' },
    { role: 'assistant', content: response1.content },
    { role: 'user', content: 'What is my name?' }
  ];
  const response2 = await context.llmService.sendMessage(messages2, context.modelKey);

  console.log(`Round 2 response: ${response2.content}`);
}, 60000);
```

### Example 3: Custom parameters

```typescript
it('should be able to use custom parameters', async () => {
  const context = await createRealLLMTestContext({
    paramOverrides: {
      temperature: 0.1,  // Low temperature, more deterministic
      max_tokens: 50,    // Limit the length
    },
  });

  if (!context) return;

  const messages = [{ role: 'user', content: 'What is 1+1?' }];
  const response = await context.llmService.sendMessage(messages, context.modelKey);

  expect(response.content).toBeDefined();
}, 30000);
```

### Example 4: Testing a specific service

```typescript
import { createVariableExtractionService } from '../../../src/services/variable-extraction/service';

it('should be able to extract variables', async () => {
  const context = await createRealLLMTestContext();
  if (!context) return;

  // Create the variable extraction service
  const variableExtractionService = createVariableExtractionService(
    context.llmService,
    context.modelManager,
    templateManager
  );

  // Use the service
  const result = await variableExtractionService.extract({
    promptContent: 'Write an article about spring in no more than 500 words.',
    extractionModelKey: context.modelKey,
    existingVariableNames: [],
  });

  expect(result.variables).toBeDefined();
  console.log(`Extracted ${result.variables.length} variables`);
}, 60000);
```

## Best Practices

### 1. Use conditional skipping

Always use `describe.skipIf()` and `it.skipIf()` to run tests conditionally:

```typescript
const RUN_REAL_API = process.env.RUN_REAL_API === '1';

describe.skipIf(!RUN_REAL_API)('Real API Tests', () => {
  it.skipIf(!hasAvailableProvider())('test case', async () => {
    // ...
  });
});
```

### 2. Check that the context exists

Always check that `context` exists:

```typescript
const context = await createRealLLMTestContext();
if (!context) {
  console.log('Skipping test: no LLM provider available');
  return;
}
```

### 3. Set a reasonable timeout

Real API calls may take a long time, so set an appropriate timeout:

```typescript
it('test case', async () => {
  // ...
}, 30000); // 30-second timeout
```

### 4. Print debugging information

Use `printAvailableProviders()` to print the available providers at the start of a test:

```typescript
beforeAll(() => {
  printAvailableProviders();
});
```

### 5. Limit the output length

Use `max_tokens` in tests to limit the output length and speed up the tests:

```typescript
const context = await createRealLLMTestContext({
  paramOverrides: {
    max_tokens: 100,
  },
});
```

## Troubleshooting

### Problem: The test is skipped

**Cause:** `RUN_REAL_API=1` is not set or no API key is available.

**Solution:**
1. Add `RUN_REAL_API=1` when running tests
2. Make sure the `.env.local` file has an API key for at least one provider
3. Run `printAvailableProviders()` to check the available providers

### Problem: API call timeout

**Cause:** The default timeout is too short.

**Solution:**
Increase the test timeout (second argument):
```typescript
it('test case', async () => {
  // ...
}, 60000); // Increase to 60 seconds
```

### Problem: Model not found

**Cause:** The provider's model list is empty.

**Solution:**
Check the adapter's model definitions and make sure the provider has at least one available model.

## Related Files

- `real-llm.ts` - Core helper implementation
- `real-llm.example.test.ts` - Example tests
- `../integration/variable-extraction/service-real-api.test.ts` - Real API test for the variable extraction service

## Contributing

If you want to add support for a new provider, add the corresponding configuration to the `SUPPORTED_PROVIDERS` array:

```typescript
{
  id: 'new-provider',
  envKeys: ['VITE_NEW_PROVIDER_API_KEY', 'NEW_PROVIDER_API_KEY'],
  name: 'New Provider'
}
```
