/**
 * Parameter validation utilities
 * Simplified parameter validation, removing excessive abstraction
 */

export class ParameterValidator {

  /**
   * Validate the prompt input
   */
  static validatePrompt(prompt: string): void {
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Prompt must be a non-empty string');
    }
    if (prompt.length > 50000) {
      throw new Error('Prompt is too long (max 50,000 characters)');
    }
  }

  /**
   * Validate the template input
   */
  static validateTemplate(template?: string): void {
    if (template !== undefined && (typeof template !== 'string' || template.trim().length === 0)) {
      throw new Error('Template must be a non-empty string');
    }
  }

  /**
   * Validate the requirement description input
   */
  static validateRequirements(requirements: string): void {
    if (!requirements || typeof requirements !== 'string' || requirements.trim().length === 0) {
      throw new Error('Requirement description must be a non-empty string');
    }
    if (requirements.length > 10000) {
      throw new Error('Requirement description is too long (max 10,000 characters)');
    }
  }
}
