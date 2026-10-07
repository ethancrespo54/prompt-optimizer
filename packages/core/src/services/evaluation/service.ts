/**
 * Evaluation service implementation
 *
 * Uses an LLM to intelligently evaluate and score test results
 */

import type { ILLMService, StreamHandlers } from '../llm/types';
import type { IModelManager } from '../model/types';
import type { ITemplateManager, Template } from '../template/types';
import { TemplateProcessor, type TemplateContext } from '../template/processor';
import {
  type IEvaluationService,
  type EvaluationRequest,
  type EvaluationResponse,
  type EvaluationStreamHandlers,
  type EvaluationScore,
  type EvaluationType,
  type EvaluationDimension,
  type EvaluationModeConfig,
  type PatchOperation,
  type PatchOperationType,
} from './types';
import {
  EvaluationValidationError,
  EvaluationModelError,
  EvaluationTemplateError,
  EvaluationExecutionError,
  EvaluationParseError,
} from './errors';
import { jsonrepair } from 'jsonrepair';

/**
 * Evaluation service implementation class
 */
export class EvaluationService implements IEvaluationService {
  constructor(
    private llmService: ILLMService,
    private modelManager: IModelManager,
    private templateManager: ITemplateManager
  ) {}

  /**
   * Run an evaluation (non-streaming)
   */
  async evaluate(request: EvaluationRequest): Promise<EvaluationResponse> {
    this.validateRequest(request);
    await this.validateModel(request.evaluationModelKey);

    const template = await this.getEvaluationTemplate(request.type, request.mode);
    const context = this.buildTemplateContext(request);
    const messages = TemplateProcessor.processTemplate(template, context);

    const startTime = Date.now();
    try {
      const result = await this.llmService.sendMessage(messages, request.evaluationModelKey);
      const duration = Date.now() - startTime;

      return this.parseEvaluationResult(result, request.type, {
        model: request.evaluationModelKey,
        timestamp: Date.now(),
        duration,
      });
    } catch (error) {
      throw new EvaluationExecutionError(
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Streaming evaluation
   */
  async evaluateStream(
    request: EvaluationRequest,
    callbacks: EvaluationStreamHandlers
  ): Promise<void> {
    try {
      this.validateRequest(request);
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    try {
      await this.validateModel(request.evaluationModelKey);
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    let template: Template;
    try {
      template = await this.getEvaluationTemplate(request.type, request.mode);
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    const context = this.buildTemplateContext(request);
    const messages = TemplateProcessor.processTemplate(template, context);

    let fullContent = '';
    const startTime = Date.now();

    const streamHandlers: StreamHandlers = {
      onToken: (token) => {
        fullContent += token;
        callbacks.onToken(token);
      },
      onComplete: () => {
        const duration = Date.now() - startTime;
        try {
          const response = this.parseEvaluationResult(fullContent, request.type, {
            model: request.evaluationModelKey,
            timestamp: Date.now(),
            duration,
          });
          callbacks.onComplete(response);
        } catch (error) {
          callbacks.onError(error instanceof Error ? error : new Error(String(error)));
        }
      },
      onError: (error) => {
        callbacks.onError(new EvaluationExecutionError(error.message, error));
      },
    };

    try {
      await this.llmService.sendMessageStream(messages, request.evaluationModelKey, streamHandlers);
    } catch (error) {
      callbacks.onError(
        new EvaluationExecutionError(
          error instanceof Error ? error.message : String(error),
          error instanceof Error ? error : undefined
        )
      );
    }
  }

  /**
   * Validate the evaluation request
   */
  private validateRequest(request: EvaluationRequest): void {
    if (!request.evaluationModelKey?.trim()) {
      throw new EvaluationValidationError('Evaluation model key must not be empty.');
    }

    if (!request.mode) {
      throw new EvaluationValidationError('Evaluation mode configuration must not be empty.');
    }
    if (!request.mode.functionMode) {
      throw new EvaluationValidationError('Function mode must not be empty.');
    }
    if (!request.mode.subMode) {
      throw new EvaluationValidationError('Sub mode must not be empty.');
    }

    switch (request.type) {
      case 'original':
        if (!request.testResult?.trim()) {
          throw new EvaluationValidationError('Test result must not be empty.');
        }
        break;

      case 'optimized':
        if (!request.optimizedPrompt?.trim()) {
          throw new EvaluationValidationError('Optimized prompt must not be empty.');
        }
        if (!request.testResult?.trim()) {
          throw new EvaluationValidationError('Test result must not be empty.');
        }
        break;

      case 'compare':
        if (!request.optimizedPrompt?.trim()) {
          throw new EvaluationValidationError('Optimized prompt must not be empty.');
        }
        if (!request.originalTestResult?.trim()) {
          throw new EvaluationValidationError('Original test result must not be empty.');
        }
        if (!request.optimizedTestResult?.trim()) {
          throw new EvaluationValidationError('Optimized test result must not be empty.');
        }
        break;

      case 'prompt-only':
        if (!request.optimizedPrompt?.trim()) {
          throw new EvaluationValidationError('Optimized prompt must not be empty.');
        }
        break;

      case 'prompt-iterate':
        if (!request.optimizedPrompt?.trim()) {
          throw new EvaluationValidationError('Optimized prompt must not be empty.');
        }
        if (!request.iterateRequirement?.trim()) {
          throw new EvaluationValidationError('Iteration requirement must not be empty.');
        }
        break;

      default:
        throw new EvaluationValidationError(`Unknown evaluation type: ${(request as any).type}`);
    }
  }

  /**
   * Validate the evaluation model
   */
  private async validateModel(modelKey: string): Promise<void> {
    const model = await this.modelManager.getModel(modelKey);
    if (!model) {
      throw new EvaluationModelError(modelKey);
    }
  }

  /**
   * Get the evaluation template
   */
  private async getEvaluationTemplate(type: EvaluationType, mode: EvaluationModeConfig): Promise<Template> {
    const templateId = this.getTemplateId(type, mode);

    try {
      const template = await this.templateManager.getTemplate(templateId);
      if (!template?.content) {
        throw new EvaluationTemplateError(templateId);
      }
      return template;
    } catch (error) {
      if (error instanceof EvaluationTemplateError) {
        throw error;
      }
      throw new EvaluationTemplateError(templateId);
    }
  }

  /**
   * Get the template ID based on the evaluation type and mode
   */
  private getTemplateId(type: EvaluationType, mode: EvaluationModeConfig): string {
    return `evaluation-${mode.functionMode}-${mode.subMode}-${type}`;
  }

  /**
   * Build the template context
   */
  private buildTemplateContext(request: EvaluationRequest): TemplateContext {
    const baseContext: TemplateContext = {
      testContent: request.testContent || '',
      ...(request.variables || {}),
    };

    const feedback = request.userFeedback?.trim();
    baseContext.hasUserFeedback = !!feedback;
    if (feedback) {
      baseContext.userFeedback = feedback;
    }

    // Original prompt (optional)
    if (request.originalPrompt) {
      baseContext.originalPrompt = request.originalPrompt;
      baseContext.hasOriginalPrompt = true;
    } else {
      baseContext.hasOriginalPrompt = false;
    }

    // Pro mode context
    if (request.proContext) {
      baseContext.proContext = JSON.stringify(request.proContext, null, 2);
    }

    switch (request.type) {
      case 'original':
        return {
          ...baseContext,
          testResult: request.testResult,
        };

      case 'optimized':
        return {
          ...baseContext,
          optimizedPrompt: request.optimizedPrompt,
          testResult: request.testResult,
        };

      case 'compare':
        return {
          ...baseContext,
          optimizedPrompt: request.optimizedPrompt,
          originalTestResult: request.originalTestResult,
          optimizedTestResult: request.optimizedTestResult,
        };

      case 'prompt-only':
        return {
          ...baseContext,
          optimizedPrompt: request.optimizedPrompt,
        };

      case 'prompt-iterate':
        return {
          ...baseContext,
          optimizedPrompt: request.optimizedPrompt,
          iterateRequirement: request.iterateRequirement,
        };

      default:
        return baseContext;
    }
  }

  /**
   * Parse the evaluation result
   */
  private parseEvaluationResult(
    content: string,
    type: EvaluationType,
    metadata?: { model?: string; timestamp?: number; duration?: number }
  ): EvaluationResponse {
    const findEvaluationPayload = (value: unknown): unknown | null => {
      // Allow the model to return wrapper structures like "{ evaluation: {...} }" / "{ data: {...} }".
      // To avoid performance problems, this does a breadth-first traversal with a limited number of steps.
      const visited = new Set<unknown>();
      const queue: unknown[] = [value];
      let steps = 0;

      while (queue.length > 0 && steps < 1000) {
        steps += 1;
        const current = queue.shift();
        if (!current || typeof current !== 'object') continue;

        if (visited.has(current)) continue;
        visited.add(current);

        if ((current as any).score !== undefined) {
          const score = (current as any).score;

          // Filter out false hits like dimension items "{ key, label, score }".
          const isDimensionLike =
            typeof (current as any).key === 'string' &&
            typeof (current as any).label === 'string' &&
            (typeof score === 'number' || typeof score === 'string');

          const looksLikeEvaluation =
            (!isDimensionLike && (typeof score === 'number' || typeof score === 'string')) ||
            (score && typeof score === 'object' && ('overall' in score || 'dimensions' in score)) ||
            typeof (current as any).summary === 'string' ||
            Array.isArray((current as any).improvements) ||
            Array.isArray((current as any).patchPlan);

          if (looksLikeEvaluation) {
            return current;
          }
        }

        if (Array.isArray(current)) {
          for (const item of current) queue.push(item);
        } else {
          for (const v of Object.values(current as Record<string, unknown>)) {
            queue.push(v);
          }
        }
      }

      return null;
    };

    const jsonCandidates = this.extractJsonCandidates(content);
    for (const candidate of jsonCandidates) {
      try {
        const repairedJson = jsonrepair(candidate);
        const parsed = JSON.parse(repairedJson);
        const payload = findEvaluationPayload(parsed);
        if (!payload) continue;

        const normalized = this.normalizeEvaluationResponse(payload as any, type, metadata);
        return normalized;
      } catch (e) {
        console.warn(
          '[EvaluationService] Failed to parse evaluation JSON candidate:',
          e instanceof Error ? e.message : String(e)
        );
      }
    }

    // Fallback parsing
    const textResult = this.parseTextEvaluation(content, type, metadata);
    if (textResult) {
      console.warn('[EvaluationService] Using text fallback parsing');
      return textResult;
    }

    throw new EvaluationParseError(
      `Failed to parse evaluation result: no valid score JSON or recognizable overall score found. Raw content length: ${content.length} characters.`
    );
  }

  /**
   * Extract possible JSON fragments from the model output.
   *
   * In practice the model may:
   * - output ```json ... ```
   * - output ``` ... ``` (no language tag)
   * - embed a piece of JSON within explanatory text
   */
  private extractJsonCandidates(content: string): string[] {
    const candidates: string[] = [];

    // 1) Prefer extracting all fenced code blocks (any language), keeping only those that look like JSON.
    const fencedRegex = /```[a-zA-Z0-9_-]*\s*([\s\S]*?)\s*```/g;
    for (const match of content.matchAll(fencedRegex)) {
      const block = (match[1] ?? '').trim();
      if (!block) continue;
      const head = block.slice(0, 200);
      if (block.startsWith('{') || block.startsWith('[') || /["']score["']\s*:/.test(head)) {
        candidates.push(block);
      }
    }

    // 2) Try to cut a balanced JSON substring from the body (search backwards for the start from near "score").
    const scoreIndex = content.search(/["']score["']\s*:/);
    if (scoreIndex >= 0) {
      const objCandidate = this.extractBalancedJsonSubstring(content, scoreIndex, '{', '}');
      if (objCandidate) candidates.push(objCandidate);

      const arrCandidate = this.extractBalancedJsonSubstring(content, scoreIndex, '[', ']');
      if (arrCandidate) candidates.push(arrCandidate);
    }

    // 3) Fallback: starting from the first '{' or '[', try to extract a balanced block.
    const firstObj = content.indexOf('{');
    if (firstObj >= 0) {
      const objCandidate = this.extractBalancedFrom(content, firstObj, '{', '}');
      if (objCandidate) candidates.push(objCandidate);
    }
    const firstArr = content.indexOf('[');
    if (firstArr >= 0) {
      const arrCandidate = this.extractBalancedFrom(content, firstArr, '[', ']');
      if (arrCandidate) candidates.push(arrCandidate);
    }

    // Finally add the raw content as a candidate (in some cases jsonrepair can recover it).
    candidates.push(content);

    // Deduplicate + filter out obviously impossible candidates
    const uniq: string[] = [];
    const seen = new Set<string>();
    for (const c of candidates) {
      const trimmed = c.trim();
      if (!trimmed) continue;
      if (trimmed.length > 200_000) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      uniq.push(trimmed);
    }
    return uniq;
  }

  private extractBalancedJsonSubstring(
    content: string,
    aroundIndex: number,
    openChar: '{' | '[',
    closeChar: '}' | ']'
  ): string | null {
    // Search left from aroundIndex for a possible start, then do bracket matching.
    const start = content.lastIndexOf(openChar, aroundIndex);
    if (start < 0) return null;
    return this.extractBalancedFrom(content, start, openChar, closeChar);
  }

  private extractBalancedFrom(
    content: string,
    start: number,
    openChar: '{' | '[',
    closeChar: '}' | ']'
  ): string | null {
    let depth = 0;
    let inString = false;
    let stringQuote: '"' | "'" | null = null;
    let escaped = false;

    for (let i = start; i < content.length; i += 1) {
      const ch = content[i];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (ch === stringQuote) {
          inString = false;
          stringQuote = null;
        }
        continue;
      }

      if (ch === '"' || ch === "'") {
        inString = true;
        stringQuote = ch as '"' | "'";
        continue;
      }

      if (ch === openChar) {
        depth += 1;
        continue;
      }
      if (ch === closeChar) {
        depth -= 1;
        if (depth === 0) {
          return content.slice(start, i + 1);
        }
      }
    }

    return null;
  }

  /**
   * Normalize the evaluation response (unified structure)
   */
  private normalizeEvaluationResponse(
    data: any,
    type: EvaluationType,
    metadata?: { model?: string; timestamp?: number; duration?: number }
  ): EvaluationResponse {
    if (!data || typeof data !== 'object') {
      throw new EvaluationParseError('Evaluation result is not a valid object.');
    }

    if (data.score === undefined || data.score === null) {
      throw new EvaluationParseError('Evaluation result is missing the "score" field.');
    }

    // Extract the score (0-100, integer)
    const extractScore = (value: any, fieldName: string): number => {
      if (value === undefined || value === null) {
        throw new EvaluationParseError(`Evaluation result is missing score for "${fieldName}".`);
      }
      const num = typeof value === 'number' ? value : parseInt(String(value));
      if (isNaN(num)) {
        throw new EvaluationParseError(`Invalid numeric score for "${fieldName}": ${value}`);
      }
      return Math.max(0, Math.min(100, num));
    };

    const tryExtractScore = (value: any, fieldName: string): number | null => {
      try {
        return extractScore(value, fieldName);
      } catch {
        return null;
      }
    };

    const toDimension = (key: string, label: string, scoreValue: any): EvaluationDimension | null => {
      const score = tryExtractScore(scoreValue, `dimension.${key}`);
      if (score === null) return null;
      return { key, label: label || key, score };
    };

    const normalizeDimensionsFromArray = (dims: any[]): EvaluationDimension[] => {
      const out: EvaluationDimension[] = [];
      dims.forEach((dim: any, index: number) => {
        if (dim === null || dim === undefined) return;

        // Common structure: { key, label, score }
        if (typeof dim === 'object' && !Array.isArray(dim)) {
          const key = typeof dim.key === 'string' ? dim.key : typeof dim.name === 'string' ? dim.name : '';
          const label = typeof dim.label === 'string' ? dim.label : typeof dim.title === 'string' ? dim.title : key;
          const scoreValue = (dim as any).score ?? (dim as any).value;
          if (key) {
            const d = toDimension(key, label, scoreValue);
            if (d) out.push(d);
          }
          return;
        }

        // Fallback: if a dimension is something like "85", still keep a placeholder dimension.
        if (typeof dim === 'number' || typeof dim === 'string') {
          const d = toDimension(`dim${index + 1}`, `dim${index + 1}`, dim);
          if (d) out.push(d);
        }
      });
      return out;
    };

    const normalizeDimensionsFromObject = (dims: Record<string, any>): EvaluationDimension[] => {
      const out: EvaluationDimension[] = [];
      for (const [key, value] of Object.entries(dims)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const label = typeof (value as any).label === 'string' ? (value as any).label : key;
          const scoreValue = (value as any).score ?? (value as any).value;
          const d = toDimension(key, label, scoreValue);
          if (d) out.push(d);
        } else {
          const d = toDimension(key, key, value);
          if (d) out.push(d);
        }
      }
      return out;
    };

    const scoreRaw = data.score;
    let overall: number | null = null;
    let dimensions: EvaluationDimension[] = [];

    // score may be a number directly (a few models output it this way)
    if (typeof scoreRaw === 'number' || typeof scoreRaw === 'string') {
      overall = tryExtractScore(scoreRaw, 'overall');
    } else if (scoreRaw && typeof scoreRaw === 'object') {
      overall = tryExtractScore((scoreRaw as any).overall, 'overall');

      const dimensionsRaw = (scoreRaw as any).dimensions;
      if (Array.isArray(dimensionsRaw)) {
        dimensions = normalizeDimensionsFromArray(dimensionsRaw);
      } else if (dimensionsRaw && typeof dimensionsRaw === 'object') {
        dimensions = normalizeDimensionsFromObject(dimensionsRaw as Record<string, any>);
      } else {
        // Some models flatten the dimensions directly into the score object: { overall, goalAchievement, ... }
        const knownKeys = ['goalAchievement', 'outputQuality', 'formatCompliance', 'relevance'];
        const flattened: Record<string, any> = {};
        for (const k of knownKeys) {
          if ((scoreRaw as any)[k] !== undefined) {
            flattened[k] = (scoreRaw as any)[k];
          }
        }
        if (Object.keys(flattened).length > 0) {
          dimensions = normalizeDimensionsFromObject(flattened);
        }
      }
    }

    // If overall is missing but dimensions exist, compute it as the average.
    if (overall === null && dimensions.length > 0) {
      const avg = Math.round(
        dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length
      );
      overall = Math.max(0, Math.min(100, avg));
    }

    // If dimensions are missing but overall exists, return a minimal dimension array.
    if (dimensions.length === 0 && overall !== null) {
      dimensions = [{ key: 'overall', label: 'Overall Score', score: overall }];
    }

    if (overall === null) {
      throw new EvaluationParseError('Evaluation result is missing a valid overall score.');
    }

    const score: EvaluationScore = {
      overall,
      dimensions,
    };

    // Parse improvements (at most 3)
    const improvements = Array.isArray(data.improvements)
      ? data.improvements.map((x: any) => String(x)).filter(Boolean).slice(0, 3)
      : typeof data.improvements === 'string' && data.improvements.trim()
        ? [data.improvements.trim()].slice(0, 3)
        : [];

    // Parse patchPlan (at most 3)
    const patchPlan = this.normalizePatchPlan(data.patchPlan || []).slice(0, 3);

    const summary = typeof data.summary === 'string' ? data.summary : '';

    return {
      type,
      score,
      improvements,
      summary,
      patchPlan,
      metadata,
    };
  }

  /**
   * Text-parse the evaluation result (fallback)
   */
  private parseTextEvaluation(
    content: string,
    type: EvaluationType,
    metadata?: { model?: string; timestamp?: number; duration?: number }
  ): EvaluationResponse | null {
    const scorePatterns = [
      // Common overall fields in JSON fragments
      /["']overall["']\s*[:=]\s*(\d{1,3})/i,

      // Common Chinese phrasings (kept so model output in Chinese is still parsed)
      /综合评分\s*[:：]?\s*(\d{1,3})(?:\s*\/\s*100)?/,
      /总[分评]\s*[:：]?\s*(\d{1,3})(?:\s*\/\s*100)?/,
      /评分\s*[:：]?\s*(\d{1,3})(?:\s*\/\s*100)?/,

      // Common English phrasings
      /overall(?:\s+score)?\s*[:：]?\s*(\d{1,3})(?:\s*\/\s*100)?/i,
      /score\s*[:：]?\s*(\d{1,3})(?:\s*\/\s*100)?/i,

      // Plain number + /100
      /(\d{1,3})\s*\/\s*100/,
      /(\d{1,3})\s*[分点](?:\s*[（(]满分100[)）])?/,
    ];

    let overall: number | null = null;
    for (const pattern of scorePatterns) {
      const match = content.match(pattern);
      if (match) {
        const num = parseInt(match[1]);
        if (num >= 0 && num <= 100) {
          overall = num;
          break;
        }
      }
    }

    if (overall === null) {
      return null;
    }

    return {
      type,
      score: {
        overall,
        dimensions: [
          { key: 'overall', label: 'Overall Score', score: overall },
        ],
      },
      improvements: [],
      summary: 'Evaluation complete (parse fallback)',
      patchPlan: [],
      metadata,
    };
  }

  /**
   * Normalize the patch plan array (simplified)
   */
  private normalizePatchPlan(patchPlan: any[]): PatchOperation[] {
    if (!Array.isArray(patchPlan)) {
      return [];
    }

    const validOps: PatchOperationType[] = ['insert', 'replace', 'delete'];

    return patchPlan
      .map((op: any) => {
        if (!op || typeof op !== 'object') {
          return null;
        }

        let opType: PatchOperationType = 'replace';
        if (op.op && validOps.includes(op.op)) {
          opType = op.op;
        }

        // Unescape HTML entities (the LLM may return escaped XML tags)
        const oldText = this.unescapeHtmlEntities(String(op.oldText || ''));
        if (!oldText) {
          return null;
        }

        const newText = this.unescapeHtmlEntities(
          op.newText !== undefined ? String(op.newText) : ''
        );

        const operation: PatchOperation = {
          op: opType,
          oldText,
          newText,
          instruction: String(op.instruction || ''),
        };

        if (typeof op.occurrence === 'number' && Number.isFinite(op.occurrence)) {
          const occ = Math.trunc(op.occurrence);
          if (occ > 0) {
            operation.occurrence = occ;
          }
        }

        return operation;
      })
      .filter((op): op is PatchOperation => op !== null);
  }

  /**
   * Unescape HTML entities
   * When generating JSON, the LLM may HTML-escape XML tags
   * Supports: named entities, decimal entities (&#123;), hexadecimal entities (&#x2F;)
   */
  private unescapeHtmlEntities(text: string): string {
    if (!text) return text;
    return text
      // Named entities
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&sol;/g, '/')
      // Hexadecimal entities &#xHH; or &#xHHHH;
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      // Decimal entities &#DDD;
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  }
}

/**
 * Factory function for creating the evaluation service
 */
export function createEvaluationService(
  llmService: ILLMService,
  modelManager: IModelManager,
  templateManager: ITemplateManager
): IEvaluationService {
  return new EvaluationService(llmService, modelManager, templateManager);
}
