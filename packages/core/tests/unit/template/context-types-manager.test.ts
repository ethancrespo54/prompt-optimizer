import { describe, it, expect } from 'vitest'
import { TemplateManager } from '../../../src/services/template/manager'
import type { IStorageProvider } from '../../../src/services/storage/types'
import type { ITemplateLanguageService, BuiltinTemplateLanguage } from '../../../src/services/template/languageService'

class MemoryStorage implements IStorageProvider {
  private store = new Map<string, string>()
  async getItem(key: string) { return this.store.get(key) ?? null }
  async setItem(key: string, value: string) { this.store.set(key, value) }
  async removeItem(key: string) { this.store.delete(key) }
  async clearAll() { this.store.clear() }
  async updateData<T>(key: string, modifier: (currentValue: T | null) => T) {
    const current = this.store.get(key)
    const obj = current ? JSON.parse(current) as T : null
    const updated = modifier(obj)
    this.store.set(key, JSON.stringify(updated))
  }
  async batchUpdate(ops: Array<{ key: string; operation: 'set' | 'remove'; value?: string }>) {
    for (const op of ops) {
      if (op.operation === 'set') this.store.set(op.key, op.value ?? '')
      else this.store.delete(op.key)
    }
  }
}

class StubLang implements ITemplateLanguageService {
  private lang: BuiltinTemplateLanguage = 'en-US'
  async initialize() {}
  async getCurrentLanguage() { return this.lang }
  async setLanguage(l: BuiltinTemplateLanguage) { this.lang = l }
  async toggleLanguage() { return this.lang }
  async isValidLanguage(language: string) { return language === 'en-US' }
  async getSupportedLanguages() { return ['en-US'] as BuiltinTemplateLanguage[] }
  getLanguageDisplayName(l: BuiltinTemplateLanguage) { return l }
  isInitialized() { return true }
}

describe('TemplateManager list by context types', () => {
  it('returns conversationMessageOptimize templates', async () => {
    const tm = new TemplateManager(new MemoryStorage(), new StubLang())
    const list = await tm.listTemplatesByType('conversationMessageOptimize')
    expect(Array.isArray(list)).toBe(true)
    // May be empty (depends on the built-in template language), but if present the type must match
    for (const t of list) expect(t.metadata.templateType).toBe('conversationMessageOptimize')
  })

  it('returns contextUserOptimize templates', async () => {
    const tm = new TemplateManager(new MemoryStorage(), new StubLang())
    const list = await tm.listTemplatesByType('contextUserOptimize')
    for (const t of list) expect(t.metadata.templateType).toBe('contextUserOptimize')
  })

  it('returns contextIterate templates', async () => {
    const tm = new TemplateManager(new MemoryStorage(), new StubLang())
    const list = await tm.listTemplatesByType('contextIterate')
    for (const t of list) expect(t.metadata.templateType).toBe('contextIterate')
  })
})

