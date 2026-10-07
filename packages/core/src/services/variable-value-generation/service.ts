/**
 * Variable value generation service - core implementation
 *
 * Uses an LLM to intelligently infer variable values from the prompt context
 */

import type { ILLMService } from '../llm/types';
import type { IModelManager } from '../model/types';
import type { ITemplateManager, Template } from '../template/types';
import { TemplateProcessor, type TemplateContext } from '../template/processor';
import {
  type IVariableValueGenerationService,
  type VariableValueGenerationRequest,
  type VariableValueGenerationResponse,
  type GeneratedVariableValue,
  type VariableToGenerate,
} from './types';
import {
  VariableValueGenerationError,
  VariableValueGenerationValidationError,
  VariableValueGenerationModelError,
  VariableValueGenerationParseError,
  VariableValueGenerationExecutionError,
} from './errors';
import { jsonrepair } from 'jsonrepair';
import { toErrorWithCode } from '../../utils/error';

/**
 * Variable value generation service implementation class
 */
export class VariableValueGenerationService implements IVariableValueGenerationService {
  constructor(
    private llmService: ILLMService,
    private modelManager: IModelManager,
    private templateManager: ITemplateManager
  ) {}

  /**
   * Generate variable values
   */
  async generate(request: VariableValueGenerationRequest): Promise<VariableValueGenerationResponse> {
    // 1. Validate the request
    this.validateRequest(request);

    // 2. Validate the model
    await this.validateModel(request.generationModelKey);

    // 3. Get the prompt template
    const template = await this.getGenerationTemplate();

    // 4. Build the template context
    const context = this.buildTemplateContext(request);

    // 5. Render the template with TemplateProcessor
    const messages = TemplateProcessor.processTemplate(template, context);

    // 6. Call the LLM to send the request
    try {
      const result = await this.llmService.sendMessage(messages, request.generationModelKey);

      // 7. Parse the JSON result returned by the LLM (pass the requested variable list for alignment validation)
      return this.parseGenerationResult(result, request.variables);
    } catch (error) {
      // 🔧 Fix: preserve the original error type; do not over-wrap
      if (error instanceof VariableValueGenerationError) {
        throw error;
      }
      throw new VariableValueGenerationExecutionError(error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * Validate the request parameters
   */
  private validateRequest(request: VariableValueGenerationRequest): void {
    if (!request.promptContent?.trim()) {
      throw new VariableValueGenerationValidationError('Prompt content must not be empty.');
    }

    if (!request.generationModelKey?.trim()) {
      throw new VariableValueGenerationValidationError('Generation model key must not be empty.');
    }

    if (!request.variables || request.variables.length === 0) {
      throw new VariableValueGenerationValidationError('Variables list must not be empty.');
    }

    // Validate each variable
    for (let i = 0; i < request.variables.length; i++) {
      const variable = request.variables[i];
      if (!variable.name?.trim()) {
        throw new VariableValueGenerationValidationError(`Variable at index ${i} has empty name.`);
      }
    }
  }

  /**
   * Validate that the model exists
   */
  private async validateModel(modelKey: string): Promise<void> {
    const model = await this.modelManager.getModel(modelKey);
    if (!model) {
      throw new VariableValueGenerationModelError(modelKey);
    }
  }

  /**
   * Get the variable value generation template
   */
  private async getGenerationTemplate(): Promise<Template> {
    const templateId = 'variable-value-generation';

    try {
      const template = await this.templateManager.getTemplate(templateId);
      if (!template?.content) {
        throw new VariableValueGenerationExecutionError(`Template "${templateId}" not found or empty.`);
      }
      return template;
    } catch (error) {
      if (error instanceof VariableValueGenerationError) {
        throw error
      }
      if (typeof (error as any)?.code === 'string') {
        throw toErrorWithCode(error)
      }
      throw new VariableValueGenerationExecutionError(
        `Failed to get template "${templateId}": ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Build the template context
   */
  private buildTemplateContext(request: VariableValueGenerationRequest): TemplateContext {
    // Build the variable list text (for template injection)
    const variablesText = request.variables
      .map((v, idx) => {
        const parts = [`${idx + 1}. ${v.name}`];
        if (v.currentValue) parts.push(`(current value: ${v.currentValue})`);
        if (v.source) parts.push(`[${v.source}]`);
        return parts.join(' ');
      })
      .join('\n');

    return {
      promptContent: request.promptContent,
      variablesText,
      variableCount: request.variables.length,
    };
  }

  /**
   * Parse the LLM generation result
   */
  private parseGenerationResult(
    content: string | { content: string },
    requestedVariables: VariableToGenerate[]
  ): VariableValueGenerationResponse {
    // Handle content uniformly (may be a string or an object)
    const textContent = typeof content === 'string' ? content : content.content;

    // 1. Try to extract a JSON code block
    const jsonMatch = textContent.match(/```json\s*([\s\S]*?)\s*```/i);
    const jsonText = jsonMatch ? jsonMatch[1] : textContent;

    try {
      // 2. Use jsonrepair to fix possible format problems
      const repaired = jsonrepair(jsonText);
      const parsed = JSON.parse(repaired);

      // 3. Normalize the response (pass the requested variable list for alignment)
      return this.normalizeGenerationResponse(parsed, requestedVariables);
    } catch (error) {
      // Fallback: try parsing directly
      try {
        const parsed = JSON.parse(jsonText);
        return this.normalizeGenerationResponse(parsed, requestedVariables);
      } catch (fallbackError) {
        throw new VariableValueGenerationParseError(
          `Failed to parse LLM response: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Normalize and validate the generation response
   * 🔧 Fix: add variable alignment validation to ensure the returned variables match the request
   */
  private normalizeGenerationResponse(
    data: any,
    requestedVariables: VariableToGenerate[]
  ): VariableValueGenerationResponse {
    if (!data || typeof data !== 'object') {
      throw new VariableValueGenerationParseError('Generation result is not a valid object.');
    }

    if (!Array.isArray(data.values)) {
      throw new VariableValueGenerationParseError('Generation result must have a "values" array.');
    }

    if (typeof data.summary !== 'string') {
      throw new VariableValueGenerationParseError('Generation result must have a "summary" string.');
    }

    // Build the set of requested variable names (for fast lookup)
    // 🔧 Also trim the requested variable names to avoid matching failures caused by leading/trailing spaces
    const requestedNames = new Set(requestedVariables.map(v => v.name.trim()));

    // Normalize each generated value
    const rawValues: GeneratedVariableValue[] = data.values.map((item: any, index: number) => {
      if (!item || typeof item !== 'object') {
        throw new VariableValueGenerationParseError(`values[${index}] is not a valid object.`);
      }

      if (typeof item.name !== 'string' || !item.name.trim()) {
        throw new VariableValueGenerationParseError(`values[${index}] is missing a valid "name" field.`);
      }

      if (typeof item.value !== 'string') {
        throw new VariableValueGenerationParseError(`values[${index}] is missing a valid "value" field.`);
      }

      if (typeof item.reason !== 'string') {
        throw new VariableValueGenerationParseError(`values[${index}] is missing a valid "reason" field.`);
      }

      return {
        name: item.name.trim(),
        value: item.value,
        reason: item.reason,
        confidence: typeof item.confidence === 'number' ? item.confidence : undefined,
      };
    });

    // 🔧 Alignment: filter out variables not in the requested list + build a Map for fast lookup
    const valueMap = new Map<string, GeneratedVariableValue>();
    for (const val of rawValues) {
      if (requestedNames.has(val.name)) {
        // 🔧 Detect same-name duplicates returned by the LLM
        if (valueMap.has(val.name)) {
          console.warn(`[VariableValueGeneration] The LLM returned a duplicate variable name: ${val.name}; the latter will overwrite the former`);
        }
        valueMap.set(val.name, val);
      } else {
        console.warn(`[VariableValueGeneration] The LLM returned a variable that was not requested: ${val.name}`);
      }
    }

    // 🔧 Detect duplicate variable names in the requested list
    const seenRequestNames = new Set<string>();
    for (const req of requestedVariables) {
      const trimmedName = req.name.trim();
      if (seenRequestNames.has(trimmedName)) {
        console.warn(`[VariableValueGeneration] The requested list contains a duplicate variable name: ${trimmedName}; the same generated result will be returned`);
      }
      seenRequestNames.add(trimmedName);
    }

    // 🔧 Fill in missing variables (those the LLM failed to return)
    const alignedValues: GeneratedVariableValue[] = requestedVariables.map(req => {
      // 🔧 Trim the requested variable names to stay consistent with the Set
      const trimmedName = req.name.trim();
      const generated = valueMap.get(trimmedName);
      if (generated) {
        return generated;
      }
      // Fill missing variables with empty values
      console.warn(`[VariableValueGeneration] The LLM did not return variable "${trimmedName}"; filled with an empty value`);
      return {
        name: trimmedName,
        value: '',
        reason: '(The LLM did not generate a value for this variable)',
        confidence: 0,
      };
    });

    return {
      values: alignedValues,
      summary: data.summary.trim(),
    };
  }
}

/**
 * Factory function for creating the variable value generation service
 *
 * @param llmService - LLM service instance
 * @param modelManager - Model manager instance
 * @param templateManager - Template manager instance
 * @returns Variable value generation service instance
 */
export function createVariableValueGenerationService(
  llmService: ILLMService,
  modelManager: IModelManager,
  templateManager: ITemplateManager
): IVariableValueGenerationService {
  return new VariableValueGenerationService(llmService, modelManager, templateManager);
}
