# Technical Implementation Details

## 🔧 Architecture Design

### Overall Architecture Evolution
```
Original Architecture       Extended Architecture
┌─────────────┐           ┌─────────────────────────────────┐
│ BasicTestPanel │    →     │ AdvancedTestPanel (main component) │
└─────────────┘           │ ├── BasicTestMode               │
                          │ ├── ConversationManager         │
                          │ ├── VariableManagerModal        │
                          │ └── ToolManager                 │
                          └─────────────────────────────────┘
```

### Core Design Principles
1. **Minimal Intrusion** - Minimal extension built on the existing architecture
2. **Backward Compatibility** - All new features are optional
3. **Separation of Responsibilities** - The UI layer manages variables; the Core layer handles logic
4. **Type Safety** - Complete TypeScript type support

## 🧪 Advanced Variable Management Implementation

### 1. VariableManager Service Architecture
```typescript
export class VariableManager implements IVariableManager {
  private customVariables: Record<string, string> = {};
  private readonly predefinedVariables = [
    'originalPrompt', 
    'lastOptimizedPrompt', 
    'iterateInput',
    'currentPrompt'  // New: used in the test phase
  ];
  
  // Variable CRUD operations
  setVariable(name: string, value: string): void {
    if (!this.validateVariableName(name)) {
      throw new Error(`Invalid variable name: ${name}`);
    }
    this.customVariables[name] = value;
    this.saveCustomVariables();
  }
  
  // Resolve all variables (predefined + custom)
  resolveAllVariables(context: TemplateContext): Record<string, string> {
    const predefinedVars = this.extractPredefinedVariables(context);
    return { ...predefinedVars, ...this.customVariables };
  }
}
```

### 2. ConversationManager Implementation
```typescript
export function useConversationManager() {
  const messages = ref<ConversationMessage[]>([]);
  
  // Detect missing variables
  const getMissingVariables = (content: string): string[] => {
    const referencedVars = variableManager.scanVariablesInContent(content);
    const availableVars = Object.keys(variableManager.listVariables());
    return referencedVars.filter(variable => !availableVars.includes(variable));
  };
  
  // Preview messages (after variable replacement)
  const previewMessages = (variables: Record<string, string>): ConversationMessage[] => {
    return messages.value.map(message => ({
      ...message,
      content: replaceVariables(message.content, variables)
    }));
  };
}
```

### 3. UI Redesign Implementation
```vue
<!-- MainLayout navigation menu integration -->
<div class="navigation-actions">
  <!-- Advanced mode navigation button -->
  <ActionButtonUI
    icon="🚀"
    :text="$t('nav.advancedMode')"
    @click="toggleAdvancedMode"
    :class="{ 'active-button': advancedModeEnabled }"
  />
  
  <!-- Variable management button - only shown in advanced mode -->
  <ActionButtonUI
    v-if="advancedModeEnabled"
    icon="📊"
    :text="$t('nav.variableManager')"
    @click="showVariableManager = true"
  />
</div>
```

## 🛠️ Tool Calling Implementation

### 1. Unified Tool Calling Interface Design
```typescript
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface StreamHandlers {
  onToken: (token: string) => void;
  onReasoningToken?: (token: string) => void;
  onToolCall?: (toolCall: ToolCall) => void;  // New
  onComplete: (response?: LLMResponse) => void;
  onError: (error: Error) => void;
}
```

### 2. OpenAI Tool Calling Implementation
```typescript
async streamOpenAIMessageWithTools(
  messages: Message[],
  modelConfig: ModelConfig,
  tools: ToolDefinition[],
  callbacks: StreamHandlers
): Promise<void> {
  const completionConfig: any = {
    model: modelConfig.defaultModel,
    messages: formattedMessages,
    tools: tools,
    tool_choice: 'auto',
    stream: true,
    ...restLlmParams
  };
  
  // Handle tool call deltas
  const toolCallDeltas = chunk.choices[0]?.delta?.tool_calls;
  if (toolCallDeltas) {
    for (const toolCallDelta of toolCallDeltas) {
      // Delta handling logic
      if (callbacks.onToolCall) {
        callbacks.onToolCall(currentToolCall);
      }
    }
  }
}
```

### 3. Gemini Tool Calling Adaptation
```typescript
async streamGeminiMessageWithTools(
  messages: Message[],
  modelConfig: ModelConfig,
  tools: ToolDefinition[],
  callbacks: StreamHandlers
): Promise<void> {
  // Convert the tool format to the Gemini standard
  const geminiTools = this.convertToGeminiTools(tools);
  
  // Handle Gemini tool calls
  const functionCalls = chunk.functionCalls();
  if (functionCalls && functionCalls.length > 0) {
    for (const functionCall of functionCalls) {
      const toolCall: ToolCall = {
        id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'function' as const,
        function: {
          name: functionCall.name,
          arguments: JSON.stringify(functionCall.args)
        }
      };
      
      if (callbacks.onToolCall) {
        callbacks.onToolCall(toolCall);
      }
    }
  }
}
```

## 📝 Key Problem Resolution Log

### Issue 1: Variable State Synchronization
**Problem**: AdvancedTestPanel created its own variable manager instance, causing data to go out of sync
**Solution**: Unify the variable manager instance
```typescript
const variableManager: Ref<VariableManagerHooks | null> = computed(() => {
  if (props.variableManager) {
    return props.variableManager  // Use the unified instance passed in from App.vue
  }
  return localVariableManager      // Fallback
})
```

### Issue 2: TypeScript Type Safety
**Problem**: For tool calls, type 'string' is not assignable to type '"function"'
**Solution**: Use a literal type assertion
```typescript
const toolCall: ToolCall = {
  id: `call_${Date.now()}`,
  type: 'function' as const,  // Add the as const assertion
  function: {
    name: functionCall.name,
    arguments: JSON.stringify(functionCall.args)
  }
};
```

### Issue 3: Theme CSS Integration
**Problem**: New components used hard-coded styles that were inconsistent with the theme system
**Solution**: Use the project's unified theme CSS classes
```vue
<div class="add-message-row theme-manager-card">
  <button class="add-message-btn theme-manager-button-secondary">
    Add Message
  </button>
</div>
```

## 🔄 Apply to Test Feature: Innovative Implementation

### Smart Template Configuration System
Shift from simply enabling advanced mode to smart test configuration:
```typescript
const applyOptimizedPromptToTest = (optimizationData: {
  originalPrompt: string
  optimizedPrompt: string
  optimizationMode: string
}) => {
  if (optimizationData.optimizationMode === 'system') {
    // System prompt optimization: system message + user interaction message
    conversationMessages.value = [
      { role: 'system', content: '{{currentPrompt}}' },
      { role: 'user', content: 'Following your assigned role, show me what you can do and interact with me.' }
    ]
  } else {
    // User prompt optimization: user message only
    conversationMessages.value = [
      { role: 'user', content: '{{currentPrompt}}' }
    ]
  }
}
```

## 🧪 Test Verification

### MCP Tool End-to-End Testing
Used the MCP Playwright tool to verify the complete workflow:
1. **Tool Creation** - Create the get_weather tool in ContextEditor
2. **Tool Sync** - Sync from the optimization phase to the test phase  
3. **Prompt Optimization** - Optimize the weather assistant system prompt
4. **Tool Call Test** - Run a Gemini tool call test
5. **Result Verification** - Confirm the tool call information is passed correctly

### Test Results
- ✅ Tool definition created and saved correctly
- ✅ UI displays "Tools: 1" and "Tools used: get_weather"
- ✅ Gemini API correctly carries the tool information
- ✅ Tool calling flow executes completely
- ✅ Test results show the AI response and tool intent

## 📊 Architecture Advantages

### 1. Multi-provider Compatibility
- **OpenAI** - Handles tool_calls deltas directly
- **Gemini** - Converts functionCalls() to the standard ToolCall format
- **Backward Compatibility** - No breaking changes to existing APIs

### 2. Component Decoupling Design
```
ContextEditor (tool creation and management)
      ↓ 
ConversationManager (tool statistics and sync)
      ↓
AdvancedTestPanel (tool call testing)
```

### 3. Data Flow Management
- **Tool-Variable Separation** - Tool definitions do not use the variable system
- **Unified Message Structure** - ConversationMessage is reused across the optimization and test phases
- **State Persistence** - Uses the unified preferenceService
