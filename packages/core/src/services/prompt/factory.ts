import { PromptService } from './service';
import type { IModelManager } from '../model/types';
import type { ITemplateManager } from '../template/types';
import type { IHistoryManager } from '../history/types';
import type { ILLMService } from '../llm/types';

/**
 * Create a PromptService instance
 * @param modelManager Model manager instance
 * @param llmService LLM service instance
 * @param templateManager Template manager instance
 * @param historyManager History manager instance
 * @returns PromptService instance
 */
export function createPromptService(
  modelManager: IModelManager,
  llmService: ILLMService,
  templateManager: ITemplateManager,
  historyManager: IHistoryManager
): PromptService {
  return new PromptService(modelManager, llmService, templateManager, historyManager);
}