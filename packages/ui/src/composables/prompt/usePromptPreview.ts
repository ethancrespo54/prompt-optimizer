import { computed, type Ref } from 'vue'

import { PREDEFINED_VARIABLES, type ContextMode } from "@prompt-optimizer/core";

import {
  findMissingVariables,
  replaceVariablesInContent,
  scanVariableNames,
} from "../../utils/prompt-variables";

/**
 * Prompt preview composable
 *
 * Used to compute the prompt rendering result in real time and detect missing variables
 *
 * @param content - Prompt content (reactive)
 * @param variables - Variables object (reactive)
 * @param contextMode - Context mode (reactive, kept but with no difference at the rendering level)
 */
export function usePromptPreview(
  content: Ref<string>,
  variables: Ref<Record<string, string>>,
  contextMode: Ref<ContextMode>,
) {
  /**
   * Parse the variables in the template
   */
  const parsedVariables = computed(() => {
    if (!content.value) {
      return {
        builtinVars: new Set<string>(),
        customVars: new Set<string>(),
        allVars: new Set<string>(),
      };
    }

    const names = scanVariableNames(content.value);
    const allVars = new Set<string>(names);
    const builtinVars = new Set<string>();
    const customVars = new Set<string>();

    const predefinedSet = new Set<string>(PREDEFINED_VARIABLES);
    for (const name of names) {
      if (predefinedSet.has(name)) builtinVars.add(name);
      else customVars.add(name);
    }

    return { builtinVars, customVars, allVars };
  });

  /**
   * Missing variables
   */
  const missingVariables = computed(() => {
    return findMissingVariables(content.value || "", variables.value || {});
  });

  /**
   * Rendered preview content
   *
   * Simplified version: uses simple replacement logic uniformly
   * Note: simple regex replacement is used here rather than Mustache, because:
   * 1. The UI preview does not need advanced Mustache features such as conditional rendering
   * 2. Simple replacement performs better and suits real-time previews
   * 3. It is consistent with the backend Mustache behavior (both keep placeholders in values)
   */
  const previewContent = computed(() => {
    if (!content.value) {
      return "";
    }

    try {
      const vars = variables.value || {};

      // Preview behavior: keep placeholders when value is missing/empty.
      // This makes missing variables obvious even though execution blocks them.
      const filledVars: Record<string, string> = {};
      for (const [key, value] of Object.entries(vars)) {
        if (value === undefined) continue;
        const str = String(value);
        if (str.trim() === '') continue;
        filledVars[key] = str;
      }

      return replaceVariablesInContent(content.value, filledVars);
    } catch (error) {
      console.error("[usePromptPreview] Preview rendering failed:", error);
      return content.value;
    }
  });

  /**
   * Whether there are missing variables
   */
  const hasMissingVariables = computed(() => missingVariables.value.length > 0);

  /**
   * Variable statistics
   */
  const variableStats = computed(() => ({
    total: parsedVariables.value.allVars.size,
    builtin: parsedVariables.value.builtinVars.size,
    custom: parsedVariables.value.customVars.size,
    missing: missingVariables.value.length,
    provided:
      parsedVariables.value.allVars.size - missingVariables.value.length,
  }));

  return {
    /** Parsed variable info */
    parsedVariables,
    /** List of missing variables */
    missingVariables,
    /** Rendered preview content */
    previewContent,
    /** Whether there are missing variables */
    hasMissingVariables,
    /** Variable statistics */
    variableStats,
  };
}
