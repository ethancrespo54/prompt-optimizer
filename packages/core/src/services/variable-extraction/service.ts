/**
 * Variable extraction service implementation
 *
 * Uses an LLM to intelligently extract variables from a prompt
 */

import type { ILLMService } from '../llm/types';
import type { IModelManager } from '../model/types';
import type { ITemplateManager, Template } from '../template/types';
import { TemplateProcessor, type TemplateContext } from '../template/processor';
import {
  type IVariableExtractionService,
  type VariableExtractionRequest,
  type VariableExtractionResponse,
  type ExtractedVariable,
} from './types';
import {
  VariableExtractionValidationError,
  VariableExtractionModelError,
  VariableExtractionParseError,
  VariableExtractionExecutionError,
  VariableExtractionError,
} from './errors';
import { jsonrepair } from 'jsonrepair';
import { toErrorWithCode } from '../../utils/error';

/**
 * Variable extraction service implementation class
 */
export class VariableExtractionService implements IVariableExtractionService {
  constructor(
    private llmService: ILLMService,
    private modelManager: IModelManager,
    private templateManager: ITemplateManager
  ) {}

  /**
   * Extract variables
   */
  async extract(request: VariableExtractionRequest): Promise<VariableExtractionResponse> {
    // 1. Validate the request
    this.validateRequest(request);

    // 2. Validate the model
    await this.validateModel(request.extractionModelKey);

    // 3. Get the prompt template
    const template = await this.getExtractionTemplate();

    // 4. Build the template context
    const context = this.buildTemplateContext(request);

    // 5. Render the template with TemplateProcessor
    const messages = TemplateProcessor.processTemplate(template, context);

    // 6. Call the LLM to send the request
    try {
      const result = await this.llmService.sendMessage(messages, request.extractionModelKey);

      // 7. Parse the JSON result returned by the LLM
      const parsed = this.parseExtractionResult(result);
      return this.filterResponse(parsed, request.existingVariableNames);
    } catch (error) {
      if (error instanceof VariableExtractionError) {
        throw error
      }
      throw new VariableExtractionExecutionError(error instanceof Error ? error.message : String(error))
    }
  }

  private filterResponse(
    response: VariableExtractionResponse,
    existingVariableNames?: string[]
  ): VariableExtractionResponse {
    const normalize = (name: string) => name.trim().toLowerCase();

    const existing = new Set(
      (existingVariableNames ?? []).map(normalize).filter(Boolean)
    );

    const seen = new Set<string>();
    const variables = response.variables.filter((v) => {
      const key = normalize(v.name);
      if (!key) return false;
      if (existing.has(key)) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return { ...response, variables };
  }

  /**
   * Validate the request parameters
   */
  private validateRequest(request: VariableExtractionRequest): void {
    if (!request.promptContent?.trim()) {
      throw new VariableExtractionValidationError('Prompt content must not be empty.');
    }

    if (!request.extractionModelKey?.trim()) {
      throw new VariableExtractionValidationError('Extraction model key must not be empty.');
    }
  }

  /**
   * Validate that the model exists
   */
  private async validateModel(modelKey: string): Promise<void> {
    const model = await this.modelManager.getModel(modelKey);
    if (!model) {
      throw new VariableExtractionModelError(modelKey);
    }
  }

  /**
   * Get the prompt template (unified template)
   */
  private async getExtractionTemplate(): Promise<Template> {
    const templateId = 'variable-extraction';

    try {
      const template = await this.templateManager.getTemplate(templateId);
      if (!template?.content) {
        throw new VariableExtractionExecutionError(`Template "${templateId}" not found or empty.`);
      }
      return template;
    } catch (error) {
      if (error instanceof VariableExtractionError) {
        throw error
      }
      // Preserve structured template errors if possible (code/params).
      if (typeof (error as any)?.code === 'string') {
        throw toErrorWithCode(error)
      }
      throw new VariableExtractionExecutionError(
        `Failed to get template "${templateId}": ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Build the template context
   */
  private buildTemplateContext(request: VariableExtractionRequest): TemplateContext {
    const context: TemplateContext = {
      promptContent: request.promptContent,
      existingVariableNames: request.existingVariableNames?.join(', ') || 'None',
      hasExistingVariables: !!request.existingVariableNames?.length,
    };

    return context;
  }

  /**
   * Parse the JSON result returned by the LLM
   */
  private parseExtractionResult(content: string): VariableExtractionResponse {
    // 1. Try to extract a JSON code block
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/i);
    const jsonText = jsonMatch ? jsonMatch[1] : content;

    try {
      // 2. Use jsonrepair to fix possible format problems
      const repaired = jsonrepair(jsonText);
      const parsed = JSON.parse(repaired);

      // 3. Normalize the response
      return this.normalizeExtractionResponse(parsed);
    } catch (error) {
      console.warn(
        '[VariableExtractionService] Failed to parse JSON:',
        error instanceof Error ? error.message : String(error)
      );

      // Try parsing directly (without jsonrepair)
      try {
        const parsed = JSON.parse(jsonText);
        return this.normalizeExtractionResponse(parsed);
      } catch (fallbackError) {
        throw new VariableExtractionParseError(
          `Failed to parse LLM response: ${error instanceof Error ? error.message : String(error)}. Raw content length: ${content.length} characters.`
        );
      }
    }
  }

  /**
   * Normalize the extraction response (unified structure)
   */
  private normalizeExtractionResponse(data: any): VariableExtractionResponse {
    if (!data || typeof data !== 'object') {
      throw new VariableExtractionParseError('Extraction result is not a valid object.');
    }

    // Validate the variables field
    if (!Array.isArray(data.variables)) {
      throw new VariableExtractionParseError('Extraction result must have a "variables" array.');
    }

    // Validate the summary field
    if (typeof data.summary !== 'string') {
      throw new VariableExtractionParseError('Extraction result must have a "summary" string.');
    }

    // Normalize each variable
    const variables: ExtractedVariable[] = data.variables.map((variable: any, index: number) => {
      // Validate required fields
      if (!variable || typeof variable !== 'object') {
        throw new VariableExtractionParseError(`variables[${index}] is not a valid object.`);
      }

      if (typeof variable.name !== 'string' || !variable.name.trim()) {
        throw new VariableExtractionParseError(`variables[${index}] is missing a valid "name" field.`);
      }

      if (typeof variable.value !== 'string') {
        throw new VariableExtractionParseError(`variables[${index}] is missing a valid "value" field.`);
      }

      if (!variable.position || typeof variable.position !== 'object') {
        throw new VariableExtractionParseError(`variables[${index}] is missing a valid "position" object.`);
      }

      if (typeof variable.position.originalText !== 'string') {
        throw new VariableExtractionParseError(
          `variables[${index}].position is missing a valid "originalText" field.`
        );
      }

      if (typeof variable.position.occurrence !== 'number') {
        throw new VariableExtractionParseError(
          `variables[${index}].position is missing a valid "occurrence" number.`
        );
      }

      if (typeof variable.reason !== 'string') {
        throw new VariableExtractionParseError(`variables[${index}] is missing a valid "reason" field.`);
      }

      return {
        name: variable.name.trim(),
        value: variable.value,
        position: {
          originalText: variable.position.originalText,
          occurrence: variable.position.occurrence,
        },
        reason: variable.reason,
        category: variable.category ? String(variable.category) : undefined,
      };
    });

    return {
      variables,
      summary: data.summary.trim(),
    };
  }
}

/**
 * Factory function for creating the variable extraction service
 */
export function createVariableExtractionService(
  llmService: ILLMService,
  modelManager: IModelManager,
  templateManager: ITemplateManager
): IVariableExtractionService {
  return new VariableExtractionService(llmService, modelManager, templateManager);
}
