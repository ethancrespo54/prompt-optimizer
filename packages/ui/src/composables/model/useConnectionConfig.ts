/**
 * Connection config management utility functions
 * Handles the connection config logic uniformly when switching providers for text models and image models
 */

export interface ProviderMeta {
  defaultBaseURL?: string
}

/**
 * Handle connection config updates when switching providers
 *
 * Use cases:
 * 1. The user manually switches the provider in a create/edit form (resetConnectionConfig: true)
 *    - Reset baseURL to the new provider's default value
 *    - Clear other fields such as apiKey (since credentials are not shared between providers)
 *
 * 2. Initialization when opening the edit dialog (resetConnectionConfig: false)
 *    - Keep all of the user's saved config (baseURL, apiKey, etc.)
 *    - Only fill in the provider default when baseURL is empty
 *
 * @param currentConfig Current connection config
 * @param providerMeta Provider metadata (including defaultBaseURL)
 * @param resetConnectionConfig Whether to reset the connection config
 * @returns The updated connection config
 */
export function computeConnectionConfig(
  currentConfig: Record<string, unknown> | undefined,
  providerMeta: ProviderMeta | undefined,
  resetConnectionConfig: boolean
): Record<string, unknown> {
  if (resetConnectionConfig) {
    // The user manually switches the provider: reset to the new provider's default config and clear the credentials
    // Explicitly set the old fields to empty strings to make sure Vue reactively updates the input boxes
    const result: Record<string, unknown> = {}
    if (currentConfig) {
      for (const key of Object.keys(currentConfig)) {
        result[key] = ''
      }
    }
    if (providerMeta?.defaultBaseURL) {
      result.baseURL = providerMeta.defaultBaseURL
    }
    return result
  }

  // Edit dialog initialization: keep the saved config and only fill in a missing baseURL
  if (providerMeta?.defaultBaseURL && !currentConfig?.baseURL) {
    return {
      ...currentConfig,
      baseURL: providerMeta.defaultBaseURL
    }
  }
  return currentConfig ?? {}
}

/**
 * Normalize the provider switch options
 * Supports a boolean shorthand and the object form of the parameter
 */
export interface NormalizedProviderChangeOptions {
  autoSelectFirstModel: boolean
  resetOverrides: boolean
  resetConnectionConfig: boolean
}

export function normalizeProviderChangeOptions(
  options: boolean | { autoSelectFirstModel?: boolean; resetOverrides?: boolean; resetConnectionConfig?: boolean } = true
): NormalizedProviderChangeOptions {
  if (typeof options === 'boolean') {
    return {
      autoSelectFirstModel: options,
      resetOverrides: options,
      resetConnectionConfig: options
    }
  }

  const autoSelectFirstModel = options.autoSelectFirstModel ?? true
  return {
    autoSelectFirstModel,
    resetOverrides: options.resetOverrides ?? autoSelectFirstModel,
    resetConnectionConfig: options.resetConnectionConfig ?? autoSelectFirstModel
  }
}
