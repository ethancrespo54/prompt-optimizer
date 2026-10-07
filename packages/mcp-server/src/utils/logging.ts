/**
 * Uses the standard debug library for logging
 *
 * Usage:
 * - Development: DEBUG=mcp:* node server.js
 * - Production: DEBUG=mcp:info,mcp:warn,mcp:error node server.js
 */

import createDebug from 'debug';

// Create debuggers for the different levels
const debugLogger = createDebug('mcp:debug');
const infoLogger = createDebug('mcp:info');
const warnLogger = createDebug('mcp:warn');
const errorLogger = createDebug('mcp:error');

// Set a color for each level
debugLogger.color = '6'; // cyan
infoLogger.color = '2';  // green
warnLogger.color = '3';  // yellow
errorLogger.color = '1'; // red

/**
 * Set the log level (controlled by the DEBUG environment variable)
 * This function is mainly kept for compatibility with the old API
 */
export function setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
  // The debug library is controlled through the environment variable; here we can set it dynamically
  const levelMap = {
    debug: 'mcp:*',
    info: 'mcp:info,mcp:warn,mcp:error',
    warn: 'mcp:warn,mcp:error',
    error: 'mcp:error'
  };

  // Dynamically set the DEBUG environment variable (if it has not been set yet)
  if (!process.env.DEBUG) {
    process.env.DEBUG = levelMap[level];
  }

  // Force re-initialization of the enabled function of the debug library
  const debugPattern = process.env.DEBUG || levelMap[level];
  createDebug.enabled = (namespace: string) => {
    if (debugPattern === 'mcp:*') return namespace.startsWith('mcp:');
    return debugPattern.split(',').some(pattern =>
      pattern.trim() === namespace ||
      (pattern.includes('*') && namespace.startsWith(pattern.replace('*', '')))
    );
  };

  // Re-enable all debuggers
  debugLogger.enabled = createDebug.enabled('mcp:debug');
  infoLogger.enabled = createDebug.enabled('mcp:info');
  warnLogger.enabled = createDebug.enabled('mcp:warn');
  errorLogger.enabled = createDebug.enabled('mcp:error');
}

/**
 * Debug log
 */
export function debug(message: string, meta?: unknown): void {
  if (meta !== undefined) {
    debugLogger(message, meta);
  } else {
    debugLogger(message);
  }
}

/**
 * Info log
 */
export function info(message: string, meta?: unknown): void {
  if (meta !== undefined) {
    infoLogger(message, meta);
  } else {
    infoLogger(message);
  }
}

/**
 * Warning log
 */
export function warn(message: string, meta?: unknown): void {
  if (meta !== undefined) {
    warnLogger(message, meta);
  } else {
    warnLogger(message);
  }
}

/**
 * Error log
 */
export function error(message: string, err?: Error): void {
  if (err) {
    errorLogger(message, {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
  } else {
    errorLogger(message);
  }
}
