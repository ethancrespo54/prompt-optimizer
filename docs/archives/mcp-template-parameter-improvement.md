# MCP Server Template Parameter Improvement

## Problem Description

The `template` parameter in the MCP server's tool parameters was originally an optional string. Users did not know what values could be entered, and there was no default value. This made for a poor user experience because:

1. Users did not know which template options were available
2. There was no default value, so users had to guess or read the documentation
3. It was easy to enter a wrong template ID and cause an error

## Solution

Change the `template` parameter to an enum type and provide a default value:

### 1. Added a function to get template options

Added the `getTemplateOptions` function in `packages/mcp-server/src/config/templates.ts`:

```typescript
export async function getTemplateOptions(
  templateManager: TemplateManager, 
  templateType: 'optimize' | 'userOptimize' | 'iterate'
): Promise<Array<{value: string, label: string, description?: string}>>
```

This function:
- Gets all available templates by template type
- Returns an array of formatted options containing value, label, and description
- Ensures the default template is always in the option list
- Provides error handling and a fallback mechanism

### 2. Modified the tool definitions

Modified the `inputSchema` of three tools in `packages/mcp-server/src/index.ts`:

#### optimize-user-prompt
```json
{
  "template": {
    "type": "string",
    "description": "Select an optimization template. Different templates have different optimization strategies and styles.",
    "enum": ["user-prompt-professional", "user-prompt-basic", "user-prompt-planning"],
    "default": "user-prompt-basic"
  }
}
```

#### optimize-system-prompt
```json
{
  "template": {
    "type": "string",
    "description": "Select an optimization template. Different templates have different optimization strategies and styles.",
    "enum": ["general-optimize", "output-format-optimize", "analytical-optimize"],
    "default": "general-optimize"
  }
}
```

#### iterate-prompt
```json
{
  "template": {
    "type": "string",
    "description": "Select an iterative optimization template. Different templates have different iteration strategies.",
    "enum": ["iterate"],
    "default": "iterate"
  }
}
```

### 3. Added a CoreServicesManager method

Added a `getTemplateManager()` method in `packages/mcp-server/src/adapters/core-services.ts` to obtain the template manager instance.

## Results of the Improvement

1. **User-friendly**: Users can now see all available template options without guessing
2. **Has defaults**: Each tool has a reasonable default template that users can use directly
3. **Type safety**: The enum type prevents users from entering invalid template IDs
4. **Clear descriptions**: Each parameter has a detailed description explaining its purpose
5. **Dynamic retrieval**: Template options are obtained dynamically, supporting the addition of new templates in the future

## Test Verification

Testing verified that:
- The MCP server starts normally
- All tools are registered correctly
- The template parameter contains the correct enum values and default values
- Different types of templates are correctly categorized and mapped

## Technical Details

- Used a template type mapping to handle type differences between the Core module and the MCP server
- Implemented error handling and a fallback mechanism, ensuring basic functionality even if template loading fails
- Filtered out the MCP-server-specific templates with the `-default` suffix, showing only genuine built-in templates
- Modified the default template ID mapping to use built-in templates instead of the MCP server's simplified templates
- Maintained backward compatibility; existing template IDs remain valid

## Final Result

The template options after the fix:

- **User optimization**: `user-prompt-professional`, `user-prompt-basic`, `user-prompt-planning` (default: `user-prompt-basic`)
- **System optimization**: `general-optimize`, `output-format-optimize`, `analytical-optimize` (default: `general-optimize`)
- **Iterative optimization**: `iterate` (default: `iterate`)

All template IDs are real built-in templates, so users can use them with confidence.
