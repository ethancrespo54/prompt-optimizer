/**
 * MCP server template config
 * Fully reuses the built-in template system of the core package
 */

import { TemplateManager } from '@prompt-optimizer/core';

/**
 * Get the default template ID
 * Dynamically gets the first template of the given type from the template manager of core
 */
export async function getDefaultTemplateId(
  templateManager: TemplateManager,
  optimizationMode: 'user' | 'system' | 'iterate'
): Promise<string> {
  // Map the optimization mode to a template type
  const templateTypeMap = {
    'user': 'userOptimize' as const,
    'system': 'optimize' as const,
    'iterate': 'iterate' as const
  };

  const templateType = templateTypeMap[optimizationMode];
  if (!templateType) {
    throw new Error(`Unknown optimization mode: ${optimizationMode}`);
  }

  // Get the template list of the given type from core
  const templates = await templateManager.listTemplatesByType(templateType);

  if (templates.length === 0) {
    throw new Error(`No templates found for type: ${templateType}`);
  }

  // Return the ID of the first template (built-in templates are sorted first)
  return templates[0].id;
}

/**
 * Get all available template options of the given type
 * Uses the TemplateManager of the core package directly, no filtering needed
 */
export async function getTemplateOptions(
  templateManager: TemplateManager,
  templateType: 'optimize' | 'userOptimize' | 'iterate'
): Promise<Array<{value: string, label: string, description?: string}>> {
  try {
    // Use the template manager of core directly to get the templates
    const templates = await templateManager.listTemplatesByType(templateType);

    // Convert the templates to the option format
    const options = templates.map(template => ({
      value: template.id,
      label: template.name,
      description: template.metadata.description || (template.isBuiltin ? 'Built-in template' : 'User template')
    }));

    return options;
  } catch (error) {
    console.error(`Failed to get template options for ${templateType}:`, error);
    return [];
  }
}
