import { describe, it, expect, beforeAll } from 'vitest'
import { GeminiAdapter } from '../../../src/services/llm/adapters/gemini-adapter'
import type { TextModelConfig, Message, ToolDefinition, ToolCall } from '../../../src/services/llm/types'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
beforeAll(() => {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
  console.log('Environment variable check:')
  console.log('- RUN_REAL_API:', process.env.RUN_REAL_API)
  console.log('- VITE_GEMINI_API_KEY:', process.env.VITE_GEMINI_API_KEY ? 'set' : 'not set')
})

const RUN_REAL_API = process.env.RUN_REAL_API === '1'
const apiKey = process.env.VITE_GEMINI_API_KEY

console.log('Test config:')
console.log('- RUN_REAL_API:', RUN_REAL_API)
console.log('- apiKey exists:', !!apiKey)

describe.skipIf(!RUN_REAL_API || !apiKey)('Gemini New SDK Integration Tests', () => {
  let adapter: GeminiAdapter

  /**
   * Helper function: create the test config
   * Get the models from the adapter automatically, avoiding hard-coding
   */
  const createConfig = (paramOverrides: Record<string, any> = {}): TextModelConfig => {
    const models = adapter.getModels()
    if (models.length === 0) {
      throw new Error('No models available from Gemini adapter')
    }

    return {
      id: 'gemini-test',
      name: 'Gemini Test',
      enabled: true,
      providerMeta: adapter.getProvider(),
      modelMeta: models[0], // Use the first available model
      connectionConfig: {
        apiKey: apiKey!
        // Do not override baseURL, use the adapter's default value
      },
      paramOverrides
    }
  }

  beforeAll(() => {
    adapter = new GeminiAdapter()
  })

  describe('Dynamic Model List (models.list API)', () => {
    it('should fetch models dynamically using new SDK', async () => {
      const config = createConfig()
      const models = await adapter.getModelsAsync(config)

      expect(Array.isArray(models)).toBe(true)
      expect(models.length).toBeGreaterThan(0)

      console.log(`✓ Got ${models.length} models`)
      console.log('First 5 models:', models.slice(0, 5).map(m => m.id))
    }, 30000)
  })

  describe('Basic Text Generation', () => {
    it('should be able to send a simple single-turn conversation', async () => {
      const config = createConfig()
      const messages: Message[] = [
        { role: 'user', content: 'Please introduce yourself in one sentence' }
      ]

      const response = await adapter.sendMessage(messages, config)

      expect(response).toBeDefined()
      expect(response.content).toBeDefined()
      expect(typeof response.content).toBe('string')
      expect(response.content.length).toBeGreaterThan(0)

      console.log('✓ Response content:', response.content.substring(0, 100) + '...')
    }, 30000)

    it('should be able to handle multi-turn conversation', async () => {
      const config = createConfig()
      const messages: Message[] = [
        { role: 'user', content: 'I have 2 dogs' },
        { role: 'assistant', content: 'Great! Dogs are very loyal pets.' },
        { role: 'user', content: 'How many paws are there in my home?' }
      ]

      const response = await adapter.sendMessage(messages, config)

      expect(response).toBeDefined()
      expect(response.content).toBeDefined()
      expect(typeof response.content).toBe('string')
      expect(response.content.length).toBeGreaterThan(0)

      console.log('✓ Multi-turn conversation response:', response.content)
    }, 30000)
  })

  describe('System Instructions', () => {
    it('should be able to handle system instructions', async () => {
      const config = createConfig()
      const messages: Message[] = [
        { role: 'system', content: 'You are a math teacher; answer concisely and professionally' },
        { role: 'user', content: 'What is 1+1?' }
      ]

      const response = await adapter.sendMessage(messages, config)

      expect(response).toBeDefined()
      expect(response.content).toBeDefined()
      expect(response.content).toContain('2')

      console.log('✓ System instruction response:', response.content)
    }, 30000)
  })

  describe('Streaming', () => {
    it('should be able to handle streaming responses', async () => {
      const config = createConfig()
      const messages: Message[] = [
        { role: 'user', content: 'Please introduce artificial intelligence in 3 sentences' }
      ]

      const tokens: string[] = []
      let completed = false
      let fullResponse = ''

      await adapter.sendMessageStream(messages, config, {
        onToken: (token) => {
          tokens.push(token)
        },
        onComplete: (response) => {
          completed = true
          if (response) {
            fullResponse = response.content
          }
        },
        onError: (error) => {
          throw error
        }
      })

      expect(tokens.length).toBeGreaterThan(0)
      expect(completed).toBe(true)
      expect(fullResponse.length).toBeGreaterThan(0)

      console.log('✓ Received', tokens.length, 'tokens')
      console.log('✓ Full response:', fullResponse.substring(0, 100) + '...')
    }, 30000)
  })

  describe('Parameters', () => {
    it('should be able to use custom parameters', async () => {
      const config = createConfig({
        temperature: 0.1,
        maxOutputTokens: 50
      })

      const messages: Message[] = [
        { role: 'user', content: 'Say a number' }
      ]

      const response = await adapter.sendMessage(messages, config)

      expect(response).toBeDefined()
      expect(response.content).toBeDefined()
      // Because of the maxOutputTokens limit, the response should be short
      expect(response.content.length).toBeLessThan(200)

      console.log('✓ Parameterized response:', response.content)
    }, 30000)
  })

  describe('Tool Calling (Function Calling)', () => {
    it('should be able to handle tool calls', async () => {
      const config = createConfig()
      const messages: Message[] = [
        { role: 'user', content: 'What is the weather like in Beijing today?' }
      ]

      const tools: ToolDefinition[] = [
        {
          type: 'function',
          function: {
            name: 'getWeather',
            description: 'Get the weather info of the given city',
            parameters: {
              type: 'object',
              properties: {
                city: {
                  type: 'string',
                  description: 'City name, such as "Beijing" or "Shanghai"'
                }
              },
              required: ['city']
            }
          }
        }
      ]

      const toolCalls: ToolCall[] = []
      const tokens: string[] = []
      let completed = false

      await adapter.sendMessageStreamWithTools(messages, config, tools, {
        onToken: (token) => {
          tokens.push(token)
        },
        onToolCall: (toolCall) => {
          toolCalls.push(toolCall)
          console.log('✓ Received a tool call:', toolCall.function.name)
          console.log('  Arguments:', toolCall.function.arguments)
        },
        onComplete: (response) => {
          completed = true
          console.log('✓ Completed the tool call response')
        },
        onError: (error) => {
          throw error
        }
      })

      expect(completed).toBe(true)

      // Verify that a tool call was received
      if (toolCalls.length > 0) {
        expect(toolCalls[0].type).toBe('function')
        expect(toolCalls[0].function.name).toBe('getWeather')

        const args = JSON.parse(toolCalls[0].function.arguments)
        expect(args.city).toBeDefined()
        console.log('✓ Tool call verified successfully:', args)
      } else {
        console.log('⚠️ The model did not return a tool call (it may have answered the question directly)')
      }
    }, 30000)
  })

  describe('Thinking/Reasoning', () => {
    it('should be able to capture the thinking process', async () => {
      const config = createConfig({
        thinkingBudget: 2048,
        includeThoughts: true,
        temperature: 1.0
      })

      const messages: Message[] = [
        {
          role: 'user',
          content: 'Please analyze this math problem: if a number sequence is 2, 4, 8, 16, what is the next number? Please explain your reasoning in detail.'
        }
      ]

      const response = await adapter.sendMessage(messages, config)

      expect(response).toBeDefined()
      expect(response.content).toBeDefined()
      expect(response.content.length).toBeGreaterThan(0)

      // Check whether it contains reasoning content
      if (response.reasoning) {
        console.log('✓ Captured the thinking process:')
        console.log(response.reasoning.substring(0, 200) + '...')
        expect(typeof response.reasoning).toBe('string')
        expect(response.reasoning.length).toBeGreaterThan(0)
      } else {
        console.log('⚠️ No thinking content captured (the model may not support it or it is not enabled)')
      }

      console.log('✓ Final answer:', response.content.substring(0, 150) + '...')
    }, 30000)

    it('should be able to handle the streaming thinking process', async () => {
      const config = createConfig({
        thinkingBudget: 2048,
        includeThoughts: true
      })

      const messages: Message[] = [
        {
          role: 'user',
          content: 'Analyze this logic problem: all cats have tails, Tom is a cat, so does Tom have a tail? Please explain the reasoning steps.'
        }
      ]

      const tokens: string[] = []
      const reasoningTokens: string[] = []
      let completed = false
      let fullResponse = ''
      let fullReasoning = ''

      await adapter.sendMessageStream(messages, config, {
        onToken: (token) => {
          tokens.push(token)
        },
        onReasoningToken: (token) => {
          reasoningTokens.push(token)
          console.log('✓ Thinking token:', token.substring(0, 50))
        },
        onComplete: (response) => {
          completed = true
          if (response) {
            fullResponse = response.content
            fullReasoning = response.reasoning || ''
          }
        },
        onError: (error) => {
          throw error
        }
      })

      expect(completed).toBe(true)
      expect(tokens.length).toBeGreaterThan(0)

      if (reasoningTokens.length > 0) {
        console.log('✓ Received', reasoningTokens.length, 'thinking tokens')
        console.log('✓ Full thinking process:', fullReasoning.substring(0, 200) + '...')
        expect(fullReasoning.length).toBeGreaterThan(0)
      } else {
        console.log('⚠️ No thinking tokens received (the model may not support it or it is not enabled)')
      }

      console.log('✓ Full answer:', fullResponse.substring(0, 150) + '...')
    }, 30000)
  })
})
