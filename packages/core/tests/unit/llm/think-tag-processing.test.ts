import { describe, it, expect, vi } from 'vitest';
import { OpenAIAdapter } from '../../../src/services/llm/adapters/openai-adapter';

describe('Think tag processing test', () => {

  describe('Streaming processing', () => {
    it('should correctly handle streaming think tags: start tag -> reasoning content -> end tag -> body', () => {
      const adapter = new OpenAIAdapter();

      const mockCallbacks = {
        onToken: vi.fn(),
        onReasoningToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      };

      const thinkState = { isInThinkMode: false, buffer: '' };

      // Simulate streaming: receive multiple chunks
      // Chunk 1: start tag
      (adapter as any).processStreamContentWithThinkTags('<think>', mockCallbacks, thinkState);

      // Chunk 2: first part of the reasoning content
      (adapter as any).processStreamContentWithThinkTags('I need to think', mockCallbacks, thinkState);

      // Chunk 3: second part of the reasoning content
      (adapter as any).processStreamContentWithThinkTags('about this question', mockCallbacks, thinkState);

      // Chunk 4: end tag
      (adapter as any).processStreamContentWithThinkTags('</think>', mockCallbacks, thinkState);

      // Chunk 5: body content
      (adapter as any).processStreamContentWithThinkTags('This is the final answer', mockCallbacks, thinkState);

      // Verify the reasoning content is separated correctly
      expect(mockCallbacks.onReasoningToken).toHaveBeenCalledWith('I need to think');
      expect(mockCallbacks.onReasoningToken).toHaveBeenCalledWith('about this question');

      // Verify the body content is sent correctly
      expect(mockCallbacks.onToken).toHaveBeenCalledWith('This is the final answer');

      // Verify tag content is not sent to the main stream
      expect(mockCallbacks.onToken).not.toHaveBeenCalledWith('<think>');
      expect(mockCallbacks.onToken).not.toHaveBeenCalledWith('</think>');
    });

    it('should handle a single chunk containing complete think tags', () => {
      const adapter = new OpenAIAdapter();

      const mockCallbacks = {
        onToken: vi.fn(),
        onReasoningToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      };

      const thinkState = { isInThinkMode: false, buffer: '' };

      // A single chunk containing complete think tags
      (adapter as any).processStreamContentWithThinkTags(
        'Before<think>reasoning process</think>After',
        mockCallbacks,
        thinkState
      );

      expect(mockCallbacks.onToken).toHaveBeenCalledWith('Before');
      expect(mockCallbacks.onReasoningToken).toHaveBeenCalledWith('reasoning process');
      expect(mockCallbacks.onToken).toHaveBeenCalledWith('After');
    });

    it('should handle think tags that span chunks', () => {
      const adapter = new OpenAIAdapter();

      const mockCallbacks = {
        onToken: vi.fn(),
        onReasoningToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      };

      const thinkState = { isInThinkMode: false, buffer: '' };

      // Chunk 1: contains part of the start tag
      (adapter as any).processStreamContentWithThinkTags('Before<thi', mockCallbacks, thinkState);

      // Chunk 2: completes the start tag and begins the reasoning content
      (adapter as any).processStreamContentWithThinkTags('nk>reasoning begins', mockCallbacks, thinkState);

      // Chunk 3: reasoning content and part of the end tag
      (adapter as any).processStreamContentWithThinkTags('reasoning ends</thi', mockCallbacks, thinkState);

      // Chunk 4: completes the end tag and begins the body
      (adapter as any).processStreamContentWithThinkTags('nk>Body content', mockCallbacks, thinkState);

      expect(mockCallbacks.onToken).toHaveBeenCalledWith('Before');
      expect(mockCallbacks.onReasoningToken).toHaveBeenCalledWith('reasoning begins');
      expect(mockCallbacks.onReasoningToken).toHaveBeenCalledWith('reasoning ends');
      expect(mockCallbacks.onToken).toHaveBeenCalledWith('Body content');
    });

    it('should handle streaming without a reasoning callback', () => {
      const adapter = new OpenAIAdapter();

      const mockCallbacks = {
        onToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
        // Note: no onReasoningToken
      };

      const thinkState = { isInThinkMode: false, buffer: '' };

      (adapter as any).processStreamContentWithThinkTags(
        '<think>reasoning process</think>Body content',
        mockCallbacks,
        thinkState
      );

      // Without a reasoning callback, think tag content is filtered out and only the body is returned
      expect(mockCallbacks.onToken).toHaveBeenCalledWith('Body content');
    });
  });
});
