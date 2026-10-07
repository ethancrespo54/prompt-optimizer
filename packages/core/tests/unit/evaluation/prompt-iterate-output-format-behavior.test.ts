import { describe, it, expect } from 'vitest'

import { EvaluationService } from '../../../src/services/evaluation/service'
import type { PromptIterateEvaluationRequest } from '../../../src/services/evaluation/types'

import type {
  ILLMService,
  LLMResponse,
  Message,
  ModelOption,
  StreamHandlers,
  ToolDefinition,
} from '../../../src/services/llm/types'
import type { IModelManager, TextModelConfig } from '../../../src/services/model/types'

import { TemplateManager } from '../../../src/services/template/manager'
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider'
import type {
  BuiltinTemplateLanguage,
  ITemplateLanguageService,
} from '../../../src/services/template/languageService'

class StubTemplateLanguageService implements ITemplateLanguageService {
  private lang: BuiltinTemplateLanguage

  constructor(lang: BuiltinTemplateLanguage) {
    this.lang = lang
  }

  async initialize() {}
  async getCurrentLanguage() {
    return this.lang
  }
  async setLanguage(language: BuiltinTemplateLanguage) {
    this.lang = language
  }
  async toggleLanguage() {
    return this.lang
  }
  async isValidLanguage(language: string) {
    return language === 'en-US'
  }
  async getSupportedLanguages() {
    return ['en-US'] as BuiltinTemplateLanguage[]
  }
  getLanguageDisplayName(language: BuiltinTemplateLanguage) {
    return language
  }
  isInitialized() {
    return true
  }
}

class StubModelManager implements IModelManager {
  constructor(private models: Record<string, TextModelConfig>) {}

  async ensureInitialized(): Promise<void> {}
  async isInitialized(): Promise<boolean> {
    return true
  }

  async getAllModels(): Promise<TextModelConfig[]> {
    return Object.values(this.models)
  }

  async getModel(key: string): Promise<TextModelConfig | undefined> {
    return this.models[key]
  }

  async addModel(key: string, config: TextModelConfig): Promise<void> {
    this.models[key] = config
  }

  async updateModel(key: string, config: Partial<TextModelConfig>): Promise<void> {
    const current = this.models[key]
    if (!current) return
    this.models[key] = { ...current, ...config }
  }

  async deleteModel(key: string): Promise<void> {
    delete this.models[key]
  }

  async enableModel(key: string): Promise<void> {
    const current = this.models[key]
    if (!current) return
    this.models[key] = { ...current, enabled: true }
  }

  async disableModel(key: string): Promise<void> {
    const current = this.models[key]
    if (!current) return
    this.models[key] = { ...current, enabled: false }
  }

  async getEnabledModels(): Promise<TextModelConfig[]> {
    return Object.values(this.models).filter((m) => m.enabled)
  }

  // IImportExportable
  async exportData(): Promise<any> {
    return []
  }
  async importData(_data: any): Promise<void> {}
  async getDataType(): Promise<string> {
    return 'models'
  }
  async validateData(_data: any): Promise<boolean> {
    return true
  }
}

/**
 * Deterministic evaluator stub.
 *
 * The goal is NOT to test LLM reasoning. Instead, this is a regression test
 * ensuring our prompt-iterate templates carry the disambiguation rules that
 * steer ambiguous feedback like "Simplify the output structure" toward OutputFormat/Workflows
 * rather than deleting prompt sections (Profile/Skills/Rules).
 */
class RuleBasedEvaluationLLM implements ILLMService {
  public lastMessages: Message[] = []

  async sendMessage(messages: Message[], _provider: string): Promise<string> {
    this.lastMessages = messages
    const text = messages.map((m) => m.content).join('\n\n')

    const hasDisambiguationRule =
      text.includes('How to Interpret User Feedback (Important)') &&
      text.includes('FINAL OUTPUT FORMAT') &&
      text.includes('OutputFormat') &&
      text.includes('Profile/Skills/Rules')

    const improvements = hasDisambiguationRule
      ? [
          'Prioritize tightening OutputFormat: by default output only the title + body; unless the user explicitly asks, do not output commentary or explanations.',
          'State in Workflows/default output rules: when user feedback mentions "output/format/examples" but not the prompt structure, treat it as the final output format.'
        ]
      : [
          'Suggest simplifying the prompt structure: delete sections such as Profile/Skills/Rules and keep only the shortest instruction.'
        ]

    return JSON.stringify({
      score: {
        overall: 90,
        dimensions: [
          { key: 'structureClarity', label: 'Structure clarity', score: 90 },
          { key: 'intentExpression', label: 'Intent expression', score: 90 },
          { key: 'constraintCompleteness', label: 'Constraint completeness', score: 90 },
          { key: 'improvementDegree', label: 'Degree of improvement', score: 90 },
        ],
      },
      improvements,
      patchPlan: [],
      summary: hasDisambiguationRule ? 'Focus on output format' : 'Misread as deleting structure',
    })
  }

  async sendMessageStructured(messages: Message[], provider: string): Promise<LLMResponse> {
    return { content: await this.sendMessage(messages, provider) }
  }

  async sendMessageStream(_messages: Message[], _provider: string, callbacks: StreamHandlers): Promise<void> {
    callbacks.onError(new Error('RuleBasedEvaluationLLM.sendMessageStream is not used in this test'))
  }

  async sendMessageStreamWithTools(
    _messages: Message[],
    _provider: string,
    _tools: ToolDefinition[],
    callbacks: StreamHandlers
  ): Promise<void> {
    callbacks.onError(new Error('RuleBasedEvaluationLLM.sendMessageStreamWithTools is not used in this test'))
  }

  async testConnection(_provider: string): Promise<void> {
    throw new Error('RuleBasedEvaluationLLM.testConnection is not used in this test')
  }

  async fetchModelList(_provider: string, _customConfig?: any): Promise<ModelOption[]> {
    return []
  }
}

describe('Prompt-iterate ambiguous feedback behavior (contract)', () => {
  it('interprets "Simplify the output structure" as final output format and avoids deleting prompt sections', async () => {
    const templateManager = new TemplateManager(
      new MemoryStorageProvider(),
      new StubTemplateLanguageService('en-US')
    )

    const modelKey = 'test-model'
    const modelManager = new StubModelManager({
      [modelKey]: {
        id: modelKey,
        name: 'Test Model',
        enabled: true,
        providerMeta: {
          id: 'test',
          name: 'Test',
          requiresApiKey: false,
          defaultBaseURL: 'https://example.com',
          supportsDynamicModels: false,
        },
        modelMeta: {
          id: modelKey,
          name: 'Test Model',
          providerId: 'test',
          capabilities: { supportsTools: false },
          parameterDefinitions: [],
        },
        connectionConfig: {},
        paramOverrides: {},
      }
    })

    const llm = new RuleBasedEvaluationLLM()
    const service = new EvaluationService(llm, modelManager, templateManager)

    const request: PromptIterateEvaluationRequest = {
      type: 'prompt-iterate',
      evaluationModelKey: modelKey,
      mode: { functionMode: 'basic', subMode: 'system' },
      originalPrompt: 'Old version (not important)',
      optimizedPrompt: '# Profile\n...\n\n# Workflows\n...\n\n# OutputFormat\nBy default output only the title + body',
      iterateRequirement: 'Background: users mainly want to see the analysis results; the final output structure needs to be simplified (not the prompt section structure).',
      userFeedback: 'Simplify the output structure',
      testContent: '',
    }

    const result = await service.evaluate(request)

    const promptText = llm.lastMessages.map((m) => m.content).join('\n\n')
    expect(promptText).toContain('How to Interpret User Feedback (Important)')
    expect(promptText).toContain('OutputFormat')
    expect(promptText).toContain('Profile/Skills/Rules')
    expect(promptText).toContain('Simplify the output structure')
    expect(promptText).toContain('users mainly want to see the analysis results')

    const improvementsText = result.improvements.join('\n')
    expect(improvementsText).toContain('OutputFormat')
    expect(improvementsText).not.toContain('Profile/Skills/Rules')
    expect(improvementsText).not.toContain('delete')
    expect(improvementsText).not.toContain('remove')
  })
})
