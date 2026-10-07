import { computed, type Ref } from 'vue'

import { isValidVariableName } from '../../types/variable'


/**
 * Detected variable info
 */
export interface DetectedVariable {
  /** Variable name */
  name: string;
  /** Variable source */
  source: "global" | "temporary" | "predefined" | "missing";
  /** Variable value */
  value: string;
  /** Start position in the document */
  from: number;
  /** End position in the document */
  to: number;
}

/**
 * Variable detection composable
 *
 * Features:
 * 1. Extract all {{variable}} placeholders from the text
 * 2. Classify variables by source (global / temporary / predefined / missing)
 * 3. Return the position info of variables, used for highlight rendering
 *
 * @param globalVariables Global variables
 * @param temporaryVariables Temporary variables
 * @param predefinedVariables Predefined variables
 */
export function useVariableDetection(
  globalVariables: Ref<Record<string, string>>,
  temporaryVariables: Ref<Record<string, string>>,
  predefinedVariables: Ref<Record<string, string>>,
) {
  /**
   * Extract all variables from the text
   *
   * @param text Text to analyze
   * @returns List of detected variables
   */
  const extractVariables = (text: string): DetectedVariable[] => {
    const regex = /\{\{\s*([^\d{}\s][^{}\s]*)\s*\}\}/gu;
    const variables: DetectedVariable[] = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      const name = match[1];
      // Prevent abnormal keys / invalid variable names from entering highlighting and missing-variable hints
      if (!isValidVariableName(name)) {
        continue
      }
      const from = match.index;
      const to = from + match[0].length;

      // Classify the variable and get its value
      let source: DetectedVariable["source"];
      let value = "";

      // Priority: predefined > global > temporary > missing
      if (predefinedVariables.value[name] !== undefined) {
        source = "predefined";
        value = predefinedVariables.value[name];
      } else if (globalVariables.value[name] !== undefined) {
        source = "global";
        value = globalVariables.value[name];
      } else if (temporaryVariables.value[name] !== undefined) {
        source = "temporary";
        value = temporaryVariables.value[name];
      } else {
        source = "missing";
        value = "";
      }

      variables.push({ name, source, value, from, to });
    }

    return variables;
  };

  /**
   * Get the list of missing variables
   */
  const missingVariables = computed(() => {
    // This method must be used after calling extractVariables externally
    // A helper method is provided here
    return (text: string) => {
      return extractVariables(text).filter((v) => v.source === "missing");
    };
  });

  /**
   * Get variable statistics
   */
  const getVariableStats = (text: string) => {
    const variables = extractVariables(text);
    return {
      total: variables.length,
      global: variables.filter((v) => v.source === "global").length,
      temporary: variables.filter((v) => v.source === "temporary").length,
      predefined: variables.filter((v) => v.source === "predefined").length,
      missing: variables.filter((v) => v.source === "missing").length,
    };
  };

  return {
    extractVariables,
    missingVariables,
    getVariableStats,
  };
}
