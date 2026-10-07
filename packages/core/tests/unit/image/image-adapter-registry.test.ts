import { describe, it, expect } from 'vitest'
import { ImageAdapterRegistry } from '../../../src/services/image/adapters/registry'

describe('ImageAdapterRegistry', () => {
  const registry = new ImageAdapterRegistry()

  it('should return available providers', () => {
    const providers = registry.getAllProviders()

    expect(providers).toBeInstanceOf(Array)
    expect(providers.length).toBeGreaterThan(0)

    // Check the required providers
    const providerIds = providers.map(p => p.id)
    expect(providerIds).toContain('gemini')
    expect(providerIds).toContain('openai')
    expect(providerIds).toContain('seedream')
    expect(providerIds).toContain('siliconflow')
    expect(providerIds).toContain('ollama')
  })

  it('should return providers with correct structure', () => {
    const providers = registry.getAllProviders()

    providers.forEach(provider => {
      expect(provider).toHaveProperty('id')
      expect(provider).toHaveProperty('name')
      expect(provider).toHaveProperty('description')
      expect(provider).toHaveProperty('requiresApiKey')
      expect(provider).toHaveProperty('defaultBaseURL')
      expect(provider).toHaveProperty('supportsDynamicModels')
      expect(provider).toHaveProperty('connectionSchema')

      expect(typeof provider.id).toBe('string')
      expect(typeof provider.name).toBe('string')
      expect(typeof provider.description).toBe('string')
      expect(typeof provider.requiresApiKey).toBe('boolean')
      expect(typeof provider.supportsDynamicModels).toBe('boolean')
    })
  })

  it('should get adapters for all available providers', () => {
    const providers = registry.getAllProviders()

    providers.forEach(provider => {
      expect(() => registry.getAdapter(provider.id)).not.toThrow()
    })
  })

  it('should get static models for providers', () => {
    const providers = registry.getAllProviders()

    providers.forEach(provider => {
      const models = registry.getStaticModels(provider.id)
      expect(Array.isArray(models)).toBe(true)

      // Verify the model structure
      models.forEach(model => {
        expect(model).toHaveProperty('id')
        expect(model).toHaveProperty('name')
        expect(model).toHaveProperty('providerId')
        expect(model).toHaveProperty('capabilities')
        expect(model.providerId).toBe(provider.id)
      })
    })
  })

  // Aliases are no longer supported

  // Connection validation has been removed

  it('should check dynamic model support', () => {
    const providers = registry.getAllProviders()

    providers.forEach(provider => {
      const supportsDynamic = registry.supportsDynamicModels(provider.id)
      expect(typeof supportsDynamic).toBe('boolean')
      expect(supportsDynamic).toBe(provider.supportsDynamicModels)
    })
  })

  it('should get all static models combined view', () => {
    const allModels = registry.getAllStaticModels()

    expect(Array.isArray(allModels)).toBe(true)
    expect(allModels.length).toBeGreaterThan(0)

    allModels.forEach(item => {
      expect(item).toHaveProperty('provider')
      expect(item).toHaveProperty('model')
      expect(item.model.providerId).toBe(item.provider.id)
    })
  })

  // Removed alias-mapping related tests

  it('should clear cache and reload models', () => {
    // Get the models before clearing
    const modelsBefore = registry.getStaticModels('openai')

    // Clear the cache
    registry.clearCache()

    // Get the models after clearing
    const modelsAfter = registry.getStaticModels('openai')

    // Should still have the same models
    expect(modelsAfter).toEqual(modelsBefore)
  })

  it('should throw error for unknown provider', () => {
    expect(() => registry.getAdapter('unknown')).toThrow()
  })
})
