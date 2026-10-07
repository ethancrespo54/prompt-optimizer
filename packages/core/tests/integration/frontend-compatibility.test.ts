import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ModelManager, HistoryManager } from '../../src'
import { createMockStorage } from '../mocks/mockStorage'

/**
 * Frontend compatibility test - verifies that the asynchronous APIs are compatible with how the frontend calls them
 */
describe('Frontend Compatibility Tests', () => {
  let modelManager: ModelManager
  let historyManager: HistoryManager

  beforeEach(() => {
    const mockStorage = createMockStorage()
    modelManager = new ModelManager(mockStorage)
    historyManager = new HistoryManager(mockStorage)
  })

  describe('ModelManager API compatibility', () => {
    it('getAllModels() should return a Promise instead of returning an array directly', async () => {
      // Simulate the frontend's wrong synchronous call
      const result = modelManager.getAllModels()
      
      // Verify that a Promise is returned
      expect(result).toBeInstanceOf(Promise)
      
      // Verify that calling filter synchronously fails
      try {
        // @ts-ignore - deliberately wrong call
        result.filter(m => m.enabled)
        throw new Error('Should not reach here')
      } catch (error) {
        expect(error.message).toContain('filter is not a function')
      }
      
      // The correct async call
      const models = await result
      expect(Array.isArray(models)).toBe(true)
    })

    it('getModel() should return a Promise', async () => {
      const result = modelManager.getModel('test-key')
      expect(result).toBeInstanceOf(Promise)
    })

    it('getEnabledModels() should return a Promise', async () => {
      const result = modelManager.getEnabledModels()
      expect(result).toBeInstanceOf(Promise)
    })
  })

  describe('HistoryManager API compatibility', () => {
    it('getAllChains() should return a Promise instead of returning an array directly', async () => {
      // Simulate the frontend's wrong synchronous call
      const result = historyManager.getAllChains()
      
      // Verify that a Promise is returned
      expect(result).toBeInstanceOf(Promise)
      
      // Verify that iterating synchronously fails
      try {
        // @ts-ignore - deliberately wrong call
        for (const chain of result) {
          console.log(chain)
        }
        throw new Error('Should not reach here')
      } catch (error) {
        expect(error.message).toContain('not iterable')
      }
      
      // The correct async call
      const chains = await result
      expect(Array.isArray(chains)).toBe(true)
    })

    it('getRecords() should return a Promise', async () => {
      const result = historyManager.getRecords()
      expect(result).toBeInstanceOf(Promise)
    })

    it('clearHistory() should return a Promise', async () => {
      const result = historyManager.clearHistory()
      expect(result).toBeInstanceOf(Promise)
    })

    it('deleteRecord() should return a Promise', async () => {
      const result = historyManager.deleteRecord('test-id')
      expect(result).toBeInstanceOf(Promise)
      
      // Handle the expected error correctly
      await expect(result).rejects.toThrow('Record with ID test-id not found')
    })
  })

  describe('Simulating frontend error scenarios', () => {
    it('should simulate the wrong call in useModelManager', () => {
      // Simulate the wrong call at line 52 of useModelManager.ts
      expect(() => {
        // @ts-ignore - simulating a wrong synchronous call
        const enabledModels = modelManager.getAllModels().filter(m => m.enabled)
      }).toThrow('filter is not a function')
    })

    it('should simulate the wrong call in usePromptHistory', () => {
      // Simulate the wrong call at line 109 of usePromptHistory.ts
      expect(() => {
        // @ts-ignore - simulating a wrong iteration call
        for (const chain of historyManager.getAllChains()) {
          console.log(chain)
        }
      }).toThrow('not iterable')
    })
  })

  describe('Correct async call patterns', () => {
    it('simulates the fixed useModelManager call pattern', async () => {
      // Simulate the correct call after the fix
      const allModels = await modelManager.getAllModels()
      const enabledModels = allModels.filter(m => m.enabled)
      
      expect(Array.isArray(allModels)).toBe(true)
      expect(Array.isArray(enabledModels)).toBe(true)
    })

    it('simulates the fixed usePromptHistory call pattern', async () => {
      // Simulate the correct call after the fix
      const allChains = await historyManager.getAllChains()
      
      expect(Array.isArray(allChains)).toBe(true)
      
      // Can iterate correctly
      for (const chain of allChains) {
        expect(chain).toBeDefined()
      }
    })

    it('simulates the complete history operation flow', async () => {
      // Clear the history
      await historyManager.clearHistory()
      
      // Get the chain list
      const chains = await historyManager.getAllChains()
      expect(chains).toHaveLength(0)
      
      // These operations should all return a Promise
      expect(historyManager.clearHistory()).toBeInstanceOf(Promise)
      expect(historyManager.getAllChains()).toBeInstanceOf(Promise)
    })
  })

  describe('Async callback compatibility test', () => {
    it('should detect the async call problem in the onComplete callback', async () => {
      // Simulate the frontend callback's wrong synchronous call
      let errorCaught = false
      let resultFromCallback: any = null
      
      const mockCallback = () => {
        try {
          // This simulates the wrong usage in the onComplete callback of usePromptOptimizer.ts
          const newRecord = historyManager.createNewChain({
            id: 'test-id',
            originalPrompt: 'test prompt',
            optimizedPrompt: 'optimized prompt', 
            type: 'optimize',
            modelKey: 'test-model',
            templateId: 'test-template',
            timestamp: Date.now(),
            metadata: {}
          })
          
          // Try to access the property immediately (this causes an undefined error)
          // @ts-ignore - deliberately wrong call, simulating a frontend runtime error
          resultFromCallback = newRecord.currentRecord.id  // This will error
        } catch (error) {
          errorCaught = true
          console.log('Caught the expected async call error:', error.message)
        }
      }
      
      // Execute the callback
      mockCallback()
      
      // Verify that the async call error was indeed caught
      expect(errorCaught).toBe(true)
      expect(resultFromCallback).toBe(null)
    })
    
    it('should verify the correct async callback usage', async () => {
      // Simulate the correct async callback usage
      let errorCaught = false
      let resultFromCallback: any = null
      
      const mockAsyncCallback = async () => {
        try {
          // The correct async call
          const newRecord = await historyManager.createNewChain({
            id: 'test-id',
            originalPrompt: 'test prompt',
            optimizedPrompt: 'optimized prompt',
            type: 'optimize', 
            modelKey: 'test-model',
            templateId: 'test-template',
            timestamp: Date.now(),
            metadata: {}
          })
          
          // Now the property can be accessed safely
          resultFromCallback = newRecord.currentRecord.id
        } catch (error) {
          errorCaught = true
          console.error('Async callback failed:', error)
        }
      }
      
      // Execute the async callback
      await mockAsyncCallback()
      
      // Verify there is no error and the result is obtained correctly
      expect(errorCaught).toBe(false)
      expect(resultFromCallback).toBe('test-id')
    })
  })
}) 