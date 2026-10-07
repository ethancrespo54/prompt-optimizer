/**
 * Environment variable config management
 *
 * Note: the environment variables are already loaded before the app starts via preload-env.js
 * The config() call here is a fallback loading mechanism
 */

import { config } from 'dotenv';

// Fallback environment variable loading (preload-env.js already handles the main loading)
config();

// Import the shared constants
const CUSTOM_API_PATTERN = /^VITE_CUSTOM_API_(KEY|BASE_URL|MODEL)_(.+)$/;
const SUFFIX_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MAX_SUFFIX_LENGTH = 50;

/**
 * Scan dynamic custom model environment variables
 * Finds environment variables matching the VITE_CUSTOM_API_*_suffix pattern
 */
function scanDynamicCustomEnvVars(): Record<string, string> {
  const dynamicMappings: Record<string, string> = {};

  // Use the shared regular expression pattern
  const customApiPattern = CUSTOM_API_PATTERN;

  Object.keys(process.env).forEach(key => {
    const match = key.match(customApiPattern);
    if (match) {
      const [, configType, suffix] = match;

      // Validate the suffix name (cannot be empty, cannot contain special characters, cannot exceed the length limit)
      if (!suffix || suffix.length > MAX_SUFFIX_LENGTH || !SUFFIX_PATTERN.test(suffix)) {
        console.warn(`[MCP Environment] Invalid suffix in ${key}: ${suffix}`);
        return;
      }

      // Generate the corresponding MCP environment variable name (keeping the original case of the suffix)
      const mcpKey = `CUSTOM_API_${configType}_${suffix}`;
      dynamicMappings[key] = mcpKey;
    }
  });

  console.log(`[MCP Environment] Found ${Object.keys(dynamicMappings).length} dynamic custom environment variables`);

  return dynamicMappings;
}

// Static environment variable mapping
const staticEnvMappings = {
  'VITE_OPENAI_API_KEY': 'OPENAI_API_KEY',
  'VITE_GEMINI_API_KEY': 'GEMINI_API_KEY',
  'VITE_DEEPSEEK_API_KEY': 'DEEPSEEK_API_KEY',
  'VITE_ZHIPU_API_KEY': 'ZHIPU_API_KEY',
  'VITE_SILICONFLOW_API_KEY': 'SILICONFLOW_API_KEY',
  'VITE_CUSTOM_API_KEY': 'CUSTOM_API_KEY',
  'VITE_CUSTOM_API_BASE_URL': 'CUSTOM_API_BASE_URL',
  'VITE_CUSTOM_API_MODEL': 'CUSTOM_API_MODEL'
};

// Dynamic environment variable mapping
const dynamicEnvMappings = scanDynamicCustomEnvVars();

// Merge all environment variable mappings
const allEnvMappings = {
  ...staticEnvMappings,
  ...dynamicEnvMappings
};

// Perform the environment variable mapping
Object.entries(allEnvMappings).forEach(([viteKey, mcpKey]) => {
  if (process.env[viteKey] && !process.env[mcpKey]) {
    process.env[mcpKey] = process.env[viteKey];
    console.log(`[MCP Environment] Mapped ${viteKey} -> ${mcpKey}`);
  }
});

export interface MCPServerConfig {
  httpPort: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  defaultLanguage: string;
  preferredModelProvider?: string;
}

export function loadConfig(): MCPServerConfig {
  return {
    httpPort: parseInt(process.env.MCP_HTTP_PORT || '3000'),
    logLevel: (process.env.MCP_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'debug',
    defaultLanguage: process.env.MCP_DEFAULT_LANGUAGE || 'en',
    preferredModelProvider: process.env.MCP_DEFAULT_MODEL_PROVIDER
  };
}

export function validateConfig(config: MCPServerConfig): void {
  if (config.httpPort < 1 || config.httpPort > 65535) {
    throw new Error('HTTP port must be between 1 and 65535');
  }

  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLogLevels.includes(config.logLevel)) {
    throw new Error(`Log level must be one of: ${validLogLevels.join(', ')}`);
  }
}
