/**
 * Variable value generation service - type definitions
 *
 * Provides the type system for intelligent variable value generation
 */

/**
 * Variables that need values generated
 */
export interface VariableToGenerate {
  /** Variable name */
  name: string;

  /** Current value (optional, for the LLM's reference) */
  currentValue?: string;

  /** Variable source identifier (helps the LLM understand the nature of the variable)
   * - global: global variable
   * - predefined: predefined variable
   * - test: temporary test variable
   * - empty: scanned empty variable (no source assigned)
   */
  source?: 'global' | 'predefined' | 'test' | 'empty';
}

/**
 * Generated variable value
 */
export interface GeneratedVariableValue {
  /** Variable name */
  name: string;

  /** Generated value */
  value: string;

  /** Generation reason */
  reason: string;

  /** Confidence (0-1, optional) */
  confidence?: number;
}

/**
 * Variable value generation request
 */
export interface VariableValueGenerationRequest {
  /** Prompt content (context used to infer variable values) */
  promptContent: string;

  /** List of variables that need values generated */
  variables: VariableToGenerate[];

  /** Model key used for generation */
  generationModelKey: string;
}

/**
 * Variable value generation response
 */
export interface VariableValueGenerationResponse {
  /** List of generated variable values */
  values: GeneratedVariableValue[];

  /** One-sentence summary */
  summary: string;
}

/**
 * Variable value generation service interface
 */
export interface IVariableValueGenerationService {
  /**
   * Generate variable values
   *
   * @param request - Generation request
   * @returns Generation result
   */
  generate(request: VariableValueGenerationRequest): Promise<VariableValueGenerationResponse>;
}
