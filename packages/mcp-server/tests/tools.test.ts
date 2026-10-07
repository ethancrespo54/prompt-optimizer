/**
 * MCP Tools basic tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CoreServicesManager } from '../src/adapters/core-services.js';
import { ParameterValidator } from '../src/adapters/parameter-adapter.js';
import { MCPErrorHandler, MCP_ERROR_CODES } from '../src/adapters/error-handler.js';

describe('MCP Server Tools', () => {
  let coreServices: CoreServicesManager;

  beforeAll(async () => {
    // Set the test environment variables
    process.env.MCP_DEFAULT_MODEL_API_KEY = 'test-key';
    process.env.MCP_DEFAULT_MODEL_PROVIDER = 'openai';
    process.env.MCP_DEFAULT_MODEL_NAME = 'gpt-4';

    coreServices = CoreServicesManager.getInstance();
    
    // Note: only initialization is tested here, not actual LLM calls
    // Actual LLM calls need a real API key
  });

  describe('ParameterValidator', () => {
    it('should validate prompt input correctly', () => {
      expect(() => ParameterValidator.validatePrompt('A valid prompt')).not.toThrow();
      expect(() => ParameterValidator.validatePrompt('')).toThrow('Prompt must be a non-empty string');
      expect(() => ParameterValidator.validatePrompt('   ')).toThrow('Prompt must be a non-empty string');
      expect(() => ParameterValidator.validatePrompt('a'.repeat(60000))).toThrow('Prompt is too long');
    });

    it('should validate requirements input correctly', () => {
      expect(() => ParameterValidator.validateRequirements('A valid requirement description')).not.toThrow();
      expect(() => ParameterValidator.validateRequirements('')).toThrow('Requirement description must be a non-empty string');
      expect(() => ParameterValidator.validateRequirements('   ')).toThrow('Requirement description must be a non-empty string');
      expect(() => ParameterValidator.validateRequirements('a'.repeat(15000))).toThrow('Requirement description is too long');
    });

    it('should validate template input correctly', () => {
      expect(() => ParameterValidator.validateTemplate('valid-template')).not.toThrow();
      expect(() => ParameterValidator.validateTemplate(undefined)).not.toThrow();
      expect(() => ParameterValidator.validateTemplate('')).toThrow('Template must be a non-empty string');
      expect(() => ParameterValidator.validateTemplate('   ')).toThrow('Template must be a non-empty string');
    });
  });

  describe('MCPErrorHandler', () => {
    it('should convert validation errors correctly', () => {
      const error = new Error('Prompt must be a non-empty string');
      const mcpError = MCPErrorHandler.convertCoreError(error);

      expect(mcpError.code).toBe(MCP_ERROR_CODES.INVALID_PARAMS); // -32602
      expect(mcpError.message).toContain('Prompt must be a non-empty string');
    });

    it('should convert optimization errors correctly', () => {
      const error = new Error('Optimization failed');
      error.name = 'OptimizationError';
      const mcpError = MCPErrorHandler.convertCoreError(error);

      expect(mcpError.code).toBe(MCP_ERROR_CODES.PROMPT_OPTIMIZATION_FAILED); // -32001
      expect(mcpError.message).toContain('Prompt optimization failed');
    });

    it('should handle unknown errors as internal errors', () => {
      const error = new Error('Unknown error');
      const mcpError = MCPErrorHandler.convertCoreError(error);

      expect(mcpError.code).toBe(MCP_ERROR_CODES.INTERNAL_ERROR); // -32000
      expect(mcpError.message).toContain('Internal error');
    });

    it('should create validation errors correctly', () => {
      const mcpError = MCPErrorHandler.createValidationError('Test validation error');

      expect(mcpError.code).toBe(MCP_ERROR_CODES.INVALID_PARAMS);
      expect(mcpError.message).toContain('Parameter validation failed: Test validation error');
    });

    it('should create internal errors correctly', () => {
      const mcpError = MCPErrorHandler.createInternalError('Test internal error');

      expect(mcpError.code).toBe(MCP_ERROR_CODES.INTERNAL_ERROR);
      expect(mcpError.message).toContain('Test internal error');
    });
  });
});
