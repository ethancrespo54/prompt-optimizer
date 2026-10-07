/**
 * Variable extraction service type definitions
 *
 * Type system providing LLM intelligent variable extraction
 */

// ==================== Request/response interfaces ====================

/**
 * Variable extraction request
 */
export interface VariableExtractionRequest {
  /** Prompt content to analyze */
  promptContent: string;

  /** Model key used for extraction */
  extractionModelKey: string;

  /** List of existing variable names (to avoid name collisions) */
  existingVariableNames?: string[];
}

/**
 * Extracted variable info
 */
export interface ExtractedVariable {
  /** Variable name (must follow naming rules: letters/digits/underscores, not starting with a digit) */
  name: string;

  /** Original variable value */
  value: string;

  /** Precise location info */
  position: {
    /** Original text fragment (used for find and replace) */
    originalText: string;
    /** Occurrence index (1-based, used to handle repeated text) */
    occurrence: number;
  };

  /** Extraction reason */
  reason: string;

  /** Category (decided by the LLM, e.g. "content topic" / "format constraint" / "requirement description") */
  category?: string;
}

/**
 * Variable extraction response
 */
export interface VariableExtractionResponse {
  /** List of extracted variables (at most 20) */
  variables: ExtractedVariable[];

  /** One-sentence summary */
  summary: string;
}

// ==================== Service interface ====================

/**
 * Variable extraction service interface
 */
export interface IVariableExtractionService {
  /**
   * Extract variables
   * @param request - Extraction request
   * @returns Extraction result
   */
  extract(request: VariableExtractionRequest): Promise<VariableExtractionResponse>;
}
