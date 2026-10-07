/**
 * Utility functions for environment detection and configuration.
 */

// Constant definitions
export const CUSTOM_API_PATTERN = /^VITE_CUSTOM_API_(KEY|BASE_URL|MODEL)_(.+)$/;
export const SUFFIX_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const MAX_SUFFIX_LENGTH = 50;

// Simple caching mechanism
let cachedCustomModels: Record<string, ValidatedCustomModelEnvConfig> | null = null;



/**
 * Custom model environment variable config interface (scanning stage)
 */
export interface CustomModelEnvConfig {
  /** Suffix name (e.g. qwen3, claude_local) */
  suffix: string;
  /** API key (optional; may be undefined during scanning) */
  apiKey?: string;
  /** API base URL (optional) */
  baseURL?: string;
  /** Model name (optional) */
  model?: string;
}

/**
 * Validated custom model environment variable config interface
 * A config that has passed validateCustomModelConfig; all required fields are guaranteed to exist
 */
export interface ValidatedCustomModelEnvConfig {
  /** Suffix name (format and length validated) */
  suffix: string;
  /** API key (validated to exist) */
  apiKey: string;
  /** API base URL (format validated) */
  baseURL: string;
  /** Model name (validated to exist) */
  model: string;
}

/**
 * Config validation result interface
 */
export interface ValidationResult {
  /** Whether it is valid */
  valid: boolean;
  /** List of error messages */
  errors: string[];
  /** List of warning messages */
  warnings: string[];
}

/**
 * Validate a custom model config
 * @param config Custom model config
 * @returns Validation result
 */
export function validateCustomModelConfig(config: CustomModelEnvConfig): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  };

  // Validate the suffix name
  if (!config.suffix) {
    result.errors.push('Suffix is required');
    result.valid = false;
  } else if (config.suffix.length > MAX_SUFFIX_LENGTH || !SUFFIX_PATTERN.test(config.suffix)) {
    result.errors.push(`Invalid suffix: ${config.suffix}. Use 1-${MAX_SUFFIX_LENGTH} alphanumeric characters, underscores, or hyphens`);
    result.valid = false;
  }

  // Validate the API key
  if (!config.apiKey) {
    result.errors.push('API key is required');
    result.valid = false;
  } else if (config.apiKey.length < 8) {
    result.warnings.push('API key seems too short, please verify it is correct');
  }

  // Validate the baseURL (required)
  if (!config.baseURL) {
    result.errors.push('Base URL is required');
    result.valid = false;
  } else {
    try {
      const url = new URL(config.baseURL);
      if (!['http:', 'https:'].includes(url.protocol)) {
        result.warnings.push(`Unusual protocol in baseURL: ${url.protocol}. Expected http: or https:`);
      }
    } catch (error) {
      result.errors.push(`Invalid baseURL format: ${config.baseURL}`);
      result.valid = false;
    }
  }

  // Validate the model name (required)
  if (!config.model) {
    result.errors.push('Model name is required');
    result.valid = false;
  }

  return result;
}

/**
 * Check whether running in a browser environment
 */
export const isBrowser = (): boolean => {
  return typeof window !== 'undefined';
};

/**
 * Check whether running in development mode
 * Uses the unified VITE_LOCAL_DEV environment variable and avoids depending on built-ins like NODE_ENV and MODE
 * Accessed dynamically through getEnvVar to avoid Vite's compile-time inline replacement (similar to the VITE_APP_PLATFORM design)
 *
 * Only considered a development environment when the VITE_LOCAL_DEV environment variable is explicitly set to 'true'
 * Supports multiple environments: Vite, Node.js, Docker, Electron, etc.
 */
export function isDevelopment(): boolean {
  // Only check the VITE_LOCAL_DEV environment variable
  const localDev = getEnvVar('VITE_LOCAL_DEV');
  return localDev === 'true';
}


/**
 * Detect whether running in an Electron environment
 * Prefers the VITE_APP_PLATFORM environment variable, then uses automatic detection
 */
export function isRunningInElectron(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // Step 1: check the environment variable (highest priority)
  const platformEnv = getEnvVar('VITE_APP_PLATFORM');
  if (platformEnv) {
    console.log('[isRunningInElectron] Using platform from env:', platformEnv);
    return platformEnv === 'electron';
  }

  // Auto-detection: check electronAPI first
  const hasElectronAPI = typeof (window as any).electronAPI !== 'undefined';
  if (hasElectronAPI) {
    console.log('[isRunningInElectron] Verdict: true (via electronAPI)');
    return true;
  }

  // Fallback detection: check stricter Electron characteristics
  const hasValidElectronProcess = typeof (window as any).process !== 'undefined' &&
                                 (window as any).process?.type === 'renderer' &&
                                 (window as any).process?.versions?.electron;

  if (hasValidElectronProcess) {
    console.log('[isRunningInElectron] Verdict: true (via process.versions.electron)');
    return true;
  }

  console.log('[isRunningInElectron] Verdict: false (no Electron features detected)');
  return false;
}

/**
 * Detect whether the Electron API is fully ready
 * Detects not only the environment but also the availability of key APIs
 */
export function isElectronApiReady(): boolean {
  if (!isRunningInElectron()) {
    return false;
  }

  const window_any = window as any;
  const hasElectronAPI = typeof window_any.electronAPI !== 'undefined';
  const hasPreferenceApi = hasElectronAPI && typeof window_any.electronAPI.preference !== 'undefined';
  
  console.log('[isElectronApiReady] API readiness check:', {
    hasElectronAPI,
    hasPreferenceApi,
  });

  // Check whether electronAPI.preference is available
  return hasElectronAPI && hasPreferenceApi;
}

/**
 * Wait for the Electron API to be fully ready
 * @param timeout Timeout in milliseconds, default 5000ms
 * @returns Promise<boolean> Whether the API became ready before the timeout
 */
export function waitForElectronApi(timeout: number = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    // If it is already ready, return immediately
    if (isElectronApiReady()) {
      console.log('[waitForElectronApi] API already ready');
      resolve(true);
      return;
    }

    console.log('[waitForElectronApi] Waiting for Electron API...');
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (isElectronApiReady()) {
        clearInterval(checkInterval);
        console.log('[waitForElectronApi] API ready after', Date.now() - startTime, 'ms');
        resolve(true);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        console.warn('[waitForElectronApi] Timeout waiting for Electron API after', timeout, 'ms');
        resolve(false);
      }
    }, 50); // Check every 50ms
  });
}

/**
 * General function for getting environment variables
 * Supports multiple environments: browser runtime config, process.env, import.meta.env
 */
export const getEnvVar = (key: string): string => {
  // 1. First check the runtime config (Docker environment)
  if (typeof window !== 'undefined' && window.runtime_config) {
    // Remove the VITE_ prefix to match the key names in the runtime config
    const runtimeKey = key.replace('VITE_', '');
    const value = window.runtime_config[runtimeKey];
    if (value !== undefined && value !== null) {
      return String(value);
    }
  }

  // 2. Then try process.env (Node.js environment)
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return process.env[key] || '';
  }

  // 3. Then try import.meta.env (Vite environment)
  try {
    // @ts-ignore - ignore this error at build time
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore - ignore this error at build time
      const value = import.meta.env[key];
      if (value) return value;
    }
  } catch {
    // Ignore errors
  }

  // 4. Finally return an empty string
  return '';
};

/**
 * Scan all custom model environment variables
 * Finds environment variables matching the VITE_CUSTOM_API_*_suffix pattern
 * @param useCache Whether to use the cache, default true
 * @returns Map of validated custom model configs, where key is the suffix name and value is the validated config object
 */
export function scanCustomModelEnvVars(useCache: boolean = true): Record<string, ValidatedCustomModelEnvConfig> {
  // If caching is enabled and there is a cached result, return it directly
  if (useCache && cachedCustomModels) {
    return cachedCustomModels;
  }
  const customModels: Record<string, CustomModelEnvConfig> = {};

  // Get the environment variables in priority order (higher priority overrides lower priority)
  const mergedEnv: Record<string, string> = {};

  // Priority 1 (lowest): import.meta.env (Vite development environment)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      Object.entries(import.meta.env).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          mergedEnv[key] = String(value);
        }
      });
    }
  } catch (error) {
    console.warn('[scanCustomModelEnvVars] Failed to access import.meta.env:', error);
  }

  // Priority 2 (medium): process.env (Node.js environment)
  if (typeof process !== 'undefined' && process.env) {
    Object.entries(process.env).forEach(([key, value]) => {
      if (value !== undefined) {
        mergedEnv[key] = value;
      }
    });
  }

  // Priority 3 (highest): runtime config (Docker environment)
  if (typeof window !== 'undefined' && window.runtime_config) {
    Object.entries(window.runtime_config).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        // Add the VITE_ prefix for uniform handling
        mergedEnv[`VITE_${key}`] = String(value);
      }
    });
  }

  console.log(`[scanCustomModelEnvVars] Environment sources loaded`);

  // Use the predefined regular expression patterns
  const customApiPattern = CUSTOM_API_PATTERN;

  // Iterate over the merged environment variables
  Object.entries(mergedEnv).forEach(([key, value]) => {
    // Skip undefined, null, and empty strings, but allow other falsy values
    if (value === undefined || value === null || value === '') return;

    const match = key.match(customApiPattern);
    if (match) {
      const [, configType, suffix] = match;

      // Validate the suffix name (cannot be empty, cannot contain special characters, cannot exceed the length limit)
      if (!suffix || suffix.length > MAX_SUFFIX_LENGTH || !SUFFIX_PATTERN.test(suffix)) {
        console.warn(`[scanCustomModelEnvVars] Invalid suffix in ${key}: ${suffix}`);
        return;
      }

      // Initialize the config object
      if (!customModels[suffix]) {
        customModels[suffix] = {
          suffix,
          apiKey: undefined,
          baseURL: undefined,
          model: undefined
        };
      }

      // Set the corresponding config item
      switch (configType) {
        case 'KEY':
          customModels[suffix].apiKey = value;
          break;
        case 'BASE_URL':
          customModels[suffix].baseURL = value;
          break;
        case 'MODEL':
          customModels[suffix].model = value;
          break;
        default:
          console.warn(`[scanCustomModelEnvVars] Unknown config type: ${configType} in ${key}`);
          break;
      }
    }
    });

  // Validate and filter the configs
  const validModels: Record<string, ValidatedCustomModelEnvConfig> = {};
  Object.entries(customModels).forEach(([suffix, config]) => {
    const validation = validateCustomModelConfig(config);

    if (validation.valid) {
      // Type assertion: a config that passed validation is guaranteed to have all required fields
      validModels[suffix] = config as ValidatedCustomModelEnvConfig;

      // Output warning messages
      if (validation.warnings.length > 0) {
        console.warn(`[scanCustomModelEnvVars] Warnings for ${suffix}:`);
        validation.warnings.forEach(warning => {
          console.warn(`  - ${warning}`);
        });
      }
    } else {
      console.error(`[scanCustomModelEnvVars] Skipping ${suffix} due to validation errors:`);
      validation.errors.forEach(error => {
        console.error(`  - ${error}`);
      });

      if (validation.warnings.length > 0) {
        console.warn(`[scanCustomModelEnvVars] Additional warnings for ${suffix}:`);
        validation.warnings.forEach(warning => {
          console.warn(`  - ${warning}`);
        });
      }
    }
  });

  console.log(`[scanCustomModelEnvVars] Found ${Object.keys(validModels).length} valid custom models:`, Object.keys(validModels));

  // Cache the result
  if (useCache) {
    cachedCustomModels = validModels;
  }

  return validModels;
}



/**
 * Clear the custom model environment variable scan cache
 * Call when the environment variables change
 */
export function clearCustomModelEnvCache(): void {
  cachedCustomModels = null;
  console.log('[clearCustomModelEnvCache] Cache cleared');
}
