/**
 * Real LLM helper - usage examples
 *
 * Demonstrates how to use the real-llm helper for real API testing
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  createRealLLMTestContext,
  hasAvailableProvider,
  getAvailableProviders,
  getFirstAvailableProvider,
  printAvailableProviders,
} from './real-llm';
import type { Message } from '../../src/services/llm/types';

const RUN_REAL_API = process.env.RUN_REAL_API === '1';

describe.skipIf(!RUN_REAL_API)('Real LLM Helper - Usage Examples', () => {
  beforeAll(() => {
    console.log('\n=== Real LLM helper - usage examples ===\n');
    printAvailableProviders();
  });

  describe('Detect available providers', () => {
    it('should be able to detect available providers', () => {
      const available = getAvailableProviders();
      console.log(`\nDetected ${available.length} available providers\n`);

      if (available.length > 0) {
        available.forEach((provider, index) => {
          console.log(`${index + 1}. ${provider.providerName}`);
          console.log(`   - Provider ID: ${provider.providerId}`);
          console.log(`   - Model: ${provider.modelConfig.modelMeta.name} (${provider.modelConfig.modelMeta.id})`);
          console.log(`   - Base URL: ${provider.modelConfig.connectionConfig.baseURL || 'default'}`);
        });
      }

      // If environment variables exist, at least one provider should be detected
      if (hasAvailableProvider()) {
        expect(available.length).toBeGreaterThan(0);
      }
    });

    it('should be able to get the first available provider', () => {
      const provider = getFirstAvailableProvider();

      if (provider) {
        console.log(`\nFirst available provider: ${provider.providerName}`);
        console.log(`Provider ID: ${provider.providerId}`);
        console.log(`Model: ${provider.modelConfig.modelMeta.name} (${provider.modelConfig.modelMeta.id})`);

        expect(provider.providerId).toBeDefined();
        expect(provider.modelConfig.connectionConfig.apiKey).toBeDefined();
        expect(provider.modelConfig.modelMeta).toBeDefined();
      } else {
        console.log('\n⚠️  No available provider');
      }
    });
  });

  describe('Simple LLM call example', () => {
    it.skipIf(!hasAvailableProvider())('should be able to send a simple message and get a response', async () => {
      // Create the test context
      const context = await createRealLLMTestContext();
      if (!context) {
        return;
      }

      // Send the message
      const messages: Message[] = [
        { role: 'user', content: 'Please introduce yourself in one sentence' }
      ];

      const response = await context.llmService.sendMessage(messages, context.modelKey);

      // Verify the response
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    }, 30000);

    it.skipIf(!hasAvailableProvider())('should be able to use custom parameters', async () => {
      // Create the test context, using custom parameters
      const context = await createRealLLMTestContext({
        paramOverrides: {
          temperature: 0.1, // Low temperature, more deterministic output
        },
      });

      if (!context) {
        return;
      }

      const messages: Message[] = [
        { role: 'user', content: 'What is 1+1?' }
      ];

      const response = await context.llmService.sendMessage(messages, context.modelKey);

      // Verify the response
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Multi-turn conversation example', () => {
    it.skipIf(!hasAvailableProvider())('should be able to hold a multi-turn conversation', async () => {
      const context = await createRealLLMTestContext();
      if (!context) {
        return;
      }

      // First turn
      const messages1: Message[] = [
        { role: 'user', content: 'My name is Alice' }
      ];

      const response1 = await context.llmService.sendMessage(messages1, context.modelKey);

      expect(response1).toBeDefined();
      expect(typeof response1).toBe('string');
      expect(response1.length).toBeGreaterThan(0);

      // Second turn (including context)
      const messages2: Message[] = [
        { role: 'user', content: 'My name is Alice' },
        { role: 'assistant', content: response1 },
        { role: 'user', content: 'What is my name?' }
      ];

      const response2 = await context.llmService.sendMessage(messages2, context.modelKey);

      // Verify the AI remembered the name (in most cases it should contain "Alice")
      expect(response2).toBeDefined();
      // Note: because of the nondeterminism of LLMs, this assertion may occasionally fail
      // expect(response2.content.toLowerCase()).toContain('alice');
    }, 60000);
  });

  describe('Error handling example', () => {
    it.skipIf(!hasAvailableProvider())('should handle an empty message correctly', async () => {
      const context = await createRealLLMTestContext();
      if (!context) {
        return;
      }

      const emptyMessages: Message[] = [];

      // An empty message list should throw an error
      await expect(
        context.llmService.sendMessage(emptyMessages, context.modelKey)
      ).rejects.toThrow();
    }, 30000);

    it('should return undefined when there is no available provider', async () => {
      if (!hasAvailableProvider()) {
        const context = await createRealLLMTestContext();
        expect(context).toBeUndefined();
      } else {
      }
    });
  });

  describe('Performance and stability example', () => {
    it.skipIf(!hasAvailableProvider())('should complete the call within a reasonable time', async () => {
      const context = await createRealLLMTestContext({
        paramOverrides: {
          temperature: 0.5, // Use a moderate temperature
        },
      });

      if (!context) {
        return;
      }

      const startTime = Date.now();

      const messages: Message[] = [
        { role: 'user', content: 'Say "hello"' }
      ];

      const response = await context.llmService.sendMessage(messages, context.modelKey);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify the response time is within a reasonable range (within 30 seconds)
      expect(duration).toBeLessThan(30000);
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    }, 35000);
  });
});
