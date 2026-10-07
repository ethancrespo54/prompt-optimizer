/**
 * Error handling adapter
 * 
 * Converts errors from the Core module into an error format compatible with the MCP protocol
 */

import { McpError } from '@modelcontextprotocol/sdk/types.js';

// Define the MCP error codes
export const MCP_ERROR_CODES = {
  INTERNAL_ERROR: -32000,
  PROMPT_OPTIMIZATION_FAILED: -32001,
  INVALID_PARAMS: -32602,
  METHOD_NOT_FOUND: -32601,
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600
} as const;

export class MCPErrorHandler {
  /**
   * Convert Core module errors into MCP errors
   */
  static convertCoreError(error: Error): McpError {
    // Optimization-related errors
    if (error.name.includes('OptimizationError') || error.name.includes('IterationError') || error.name.includes('TestError')) {
      return new McpError(
        MCP_ERROR_CODES.PROMPT_OPTIMIZATION_FAILED,
        `Prompt optimization failed: ${error.message}`,
        { originalError: error.name }
      );
    }

    // Parameter validation errors
    if (error.message.includes('must be') || error.message.includes('cannot be empty') || error.message.includes('too long')) {
      return new McpError(
        MCP_ERROR_CODES.INVALID_PARAMS,
        error.message,
        { originalError: error.name }
      );
    }

    // Configuration-related errors
    if (error.message.includes('Model') || error.message.includes('API key') || error.message.includes('Template')) {
      return new McpError(
        MCP_ERROR_CODES.INTERNAL_ERROR,
        `Configuration error: ${error.message}`,
        { originalError: error.name }
      );
    }

    // Default internal error
    return new McpError(
      MCP_ERROR_CODES.INTERNAL_ERROR,
      `Internal error: ${error.message}`,
      { originalError: error.name }
    );
  }

  /**
   * Create a parameter validation error
   */
  static createValidationError(message: string): McpError {
    return new McpError(MCP_ERROR_CODES.INVALID_PARAMS, `Parameter validation failed: ${message}`);
  }

  /**
   * Create an internal error
   */
  static createInternalError(message: string): McpError {
    return new McpError(MCP_ERROR_CODES.INTERNAL_ERROR, message);
  }
}
