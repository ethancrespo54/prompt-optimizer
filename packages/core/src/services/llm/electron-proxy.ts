import { ILLMService, Message, StreamHandlers, LLMResponse, ModelOption, ToolDefinition } from './types';
import { safeSerializeForIPC } from '../../utils/ipc-serialization';
import { InitializationError } from './errors';

/**
 * LLM service proxy for the Electron environment
 * Calls the real LLMService instance in the main process over IPC
 */
export class ElectronLLMProxy implements ILLMService {
  private electronAPI: NonNullable<Window['electronAPI']>;

  constructor() {
    // Validate the Electron environment
    if (typeof window === 'undefined' || !window.electronAPI) {
      throw new InitializationError('ElectronLLMProxy can only be used in Electron renderer process');
    }
    this.electronAPI = window.electronAPI;
  }

  async testConnection(provider: string): Promise<void> {
    await this.electronAPI.llm.testConnection(provider);
  }

  async sendMessage(messages: Message[], provider: string): Promise<string> {
    // Serialize automatically to prevent errors when Vue reactive objects are passed over IPC
    const safeMessages = safeSerializeForIPC(messages);
    return this.electronAPI.llm.sendMessage(safeMessages, provider);
  }

  async sendMessageStructured(messages: Message[], provider: string): Promise<LLMResponse> {
    // Serialize automatically to prevent errors when Vue reactive objects are passed over IPC
    const safeMessages = safeSerializeForIPC(messages);
    return this.electronAPI.llm.sendMessageStructured(safeMessages, provider);
  }

  async sendMessageStream(
    messages: Message[],
    provider: string,
    callbacks: StreamHandlers
  ): Promise<void> {
    // Serialize automatically to prevent errors when Vue reactive objects are passed over IPC
    const safeMessages = safeSerializeForIPC(messages);

    // Adapt the callback interface: StreamHandlers uses onToken, whereas preload expects onContent
    const adaptedCallbacks = {
      onContent: callbacks.onToken,  // Map onToken -> onContent
      onThinking: callbacks.onReasoningToken || (() => {}),  // Map the reasoning stream
      onFinish: () => callbacks.onComplete(),  // Map the completion callback
      onError: callbacks.onError
    };

    await this.electronAPI.llm.sendMessageStream(safeMessages, provider, adaptedCallbacks);
  }

  async sendMessageStreamWithTools(
    messages: Message[],
    provider: string,
    tools: ToolDefinition[],
    callbacks: StreamHandlers
  ): Promise<void> {
    // Serialize automatically to prevent errors when Vue reactive objects are passed over IPC
    const safeMessages = safeSerializeForIPC(messages);
    const safeTools = safeSerializeForIPC(tools);

    // Adapt the callback interface: StreamHandlers uses onToken/onToolCall, whereas preload expects the corresponding callbacks
    const adaptedCallbacks = {
      onContent: callbacks.onToken,  // Map onToken -> onContent
      onThinking: callbacks.onReasoningToken || (() => {}),  // Map the reasoning stream
      onToolCall: callbacks.onToolCall || (() => {}),  // 🆕 Map the tool call callback
      onFinish: () => callbacks.onComplete(),  // Map the completion callback
      onError: callbacks.onError
    };

    // Prefer the dedicated tools-capable streaming channel when available.
    const maybe = this.electronAPI.llm.sendMessageStreamWithTools;
    if (typeof maybe === 'function') {
      await maybe(safeMessages, provider, safeTools, adaptedCallbacks);
      return;
    }

    // Back-compat fallback (older preload/main): stream without tool-call events.
    await this.electronAPI.llm.sendMessageStream(safeMessages, provider, adaptedCallbacks);
  }

  async fetchModelList(
    provider: string,
    customConfig?: Partial<any>
  ): Promise<ModelOption[]> {
    // Serialize automatically to prevent errors when Vue reactive objects are passed over IPC
    const safeCustomConfig = customConfig ? safeSerializeForIPC(customConfig) : customConfig;
    return this.electronAPI.llm.fetchModelList(provider, safeCustomConfig);
  }
} 
