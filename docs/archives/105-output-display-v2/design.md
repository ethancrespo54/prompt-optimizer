# OutputDisplay V2 Design Document

## 1. Core Design Philosophy

The core goal of V2 is to resolve the confusing layout of functional controls and unclear scoping in V1. The new design follows these core principles:

-   **Control Grouping**: Controls with similar functions or the same scope should be visually grouped together.
-   **Scope Association**: The layout position of a control should intuitively reflect the UI area it controls.
-   **High Visibility**: Frequently used features should always be visible and easy to access, avoiding unnecessary hover interactions.

## 2. Final Layout (V3)

After several rounds of discussion, the V3 layout was finalized. Its core is a unified, always-visible top-level toolbar, with logical separation and visual harmony achieved through internal grouping.

### 2.1 Visual Layout

```
+----------------------------------------------------------------------+
| [Render|Source|Diff] (fixed left)             [Copy][Fullscreen*] (fixed right) |  <-- Unified top-level toolbar (always visible)
+----------------------------------------------------------------------+
|                                                                      |
| [Reasoning]........................................[Expand/Collapse] (fixed) |  <-- Reasoning panel
+----------------------------------------------------------------------+
|                (Reasoning content area, optional, collapsible)       |
|                (may have its own copy button inside)                 |
+----------------------------------------------------------------------+
|                                                                      |
|                      (Main content area)                             |
|                                                                      |
+----------------------------------------------------------------------+

* The fullscreen button is hidden in the fullscreen view
```

### 2.2 Control Details

#### 2.2.1 Top-level Toolbar (Primary Toolbar)

-   **Position and visibility**: Fixed at the very top of the whole component and always visible.
-   **Function**: Serves as the unified entry point for all primary actions.
-   **Internal groups**:
    -   **Left group (view control)**:
        -   **Members**: The `Render`, `Source`, `Diff` button group.
        -   **Purpose**: Controls how the "main content area" below is presented.
    -   **Right group (action execution)**:
        -   **Members**: `Copy` and `Fullscreen` buttons.
        -   **Purpose**: Perform one-off actions on the content or component. The `Copy` button acts on the "main content", and the `Fullscreen` button acts on the whole component.
        -   **Special rule**: The `Fullscreen` button should be hidden when the component is already in fullscreen mode. This logic is **encapsulated inside** the `OutputDisplayFullscreen.vue` component. It automatically filters out the `'fullscreen'` option from the `enabledActions` passed in by the parent component, ensuring the component's behavior is self-consistent.

#### 2.2.2 "Reasoning" Panel (Reasoning Panel)

-   **Position**: Below the top-level toolbar and above the main content area.
-   **Structure**: A self-contained module with its own title bar and content area.
-   **Controls**:
    -   **Expand/Collapse**: Located on the right side of the title bar, controls whether the content area is shown. The whole title bar is clickable to trigger it.
    -   **Copy reasoning**: To keep the scope clear, this button can be placed inside the content area (for example in the bottom-right corner) and is visible only when the content area is expanded.

## 3. Component Interface Design (`OutputDisplayCore`)

The external interface (Props & Events) of V2 stays highly compatible with V1; the core changes are in the internal implementation and the user experience.

### Props

```typescript
type ActionName = 'fullscreen' | 'diff' | 'copy' | 'edit' | 'reasoning';

interface OutputDisplayCoreProps {
  // ... other props unchanged ...
  content?: string;
  originalContent?: string; // Still the prerequisite for activating the "compare mode" button
  reasoning?: string;
  mode: 'readonly' | 'editable'; // Defines the component's "capability", deciding whether it is editable in source mode
  enabledActions?: ActionName[]; // Still used to control toolbar features
  // ...
}
```

## 4. Data Flow and State Management (Handling Draft Content)

A common question is: how is the content the user edits in source mode (which can be viewed as a "draft") managed?

**Core principle**: `OutputDisplay` is a pure **Controlled Component**. It holds no temporary "draft" state of its own. Its responsibility is to faithfully display the data passed in by the parent component via `props`, and to notify the parent component of the user's input through `events`.

This pattern follows the **Single Source of Truth** architecture principle, ensuring a predictable and consistent data flow.

### Data flow loop

```mermaid
graph TD
    subgraph Parent Component (e.g., PromptPanel)
        A(State: optimizedPrompt)
    end

    subgraph OutputDisplay
        B(Textarea)
    end

    A -- "1. State passed down (Props)" --> B;
    B -- "2. User input triggers @input event" --> C{emit('update:content', ...)}
    C -- "3. Change request (Events)" --> A;
    A -- "4. View syncs automatically (Re-render)" --> B;
```

**Workflow breakdown**:
1.  **State passed down**: The parent component passes the `optimizedPrompt` state to `OutputDisplay` via the `:content` prop.
2.  **Change request**: When the user types in the `<textarea>`, `OutputDisplay` does not store the new content in any internal variable; instead it immediately sends out the latest full content via `emit('update:content', ...)`.
3.  **State update**: The parent component listens to the `@update:content` event and uses the new content received to update its own `optimizedPrompt` state.
4.  **View sync**: Thanks to Vue's reactivity, the update of `optimizedPrompt` automatically triggers a re-render of `OutputDisplay`, keeping the `content` prop it displays fully in sync with the parent's state and closing the data flow loop.

This process is similar to a bank terminal, which does not store deposit data itself and only sends the user's transaction requests to the head office server and displays the latest balance returned by the server.

## 5. Component Structure and State Machine

### 5.1. Internal view state machine

The core of the component is driven by a new internal view state, `internalViewMode`.

```mermaid
graph TD
    A(Render Mode) -- Click "Source" button --> B(Source Mode);
    B -- Click "Render" button --> A;
    A -- When originalContent exists<br/>click "Diff" button --> C(Diff Mode);
    C -- Click "Render" button --> A;
    B -- When originalContent exists<br/>click "Diff" button --> C;
    C -- Click "Source" button --> B;

    subgraph "Auto switching"
        D(Any mode) -- streaming starts --> B;
        B -- streaming ends --> E{Restore previous mode};
    end
```

### 5.2. `OutputDisplayCore` internal structure

```OutputDisplayCore
├── FloatingToolbar
│   ├── ViewModeButtons (Render / Source / Diff)
│   └── ActionButtons (Copy / Fullscreen, etc.)
├── ReasoningSection (...)
└── MainContent
    ├── MarkdownRenderer (v-if="internalViewMode === 'render'")
    ├── textarea (v-if="internalViewMode === 'source'", :readonly="mode !== 'editable'")
    └── TextDiffUI (v-if="internalViewMode === 'diff'")
```

## 6. Features

### 6.1. Explicit view modes

Users can switch freely among the three modes via the dedicated button group on the toolbar; the button of the currently active mode is shown in a disabled/highlighted state.

-   **Render mode (`render`)**:
    -   The default view.
    -   Uses `MarkdownRenderer` to provide a rich text preview.
    -   Content is always read-only in this mode.
    -   **Shortcut**: Clicking the content area automatically switches to `source mode`, making it convenient to quickly view or edit.

-   **Source mode (`source`)**:
    -   Uses a `<textarea>` to show the unprocessed raw text.
    -   **Editability**: The textarea in this mode is editable only if `props.mode` is `'editable'` and the component is **not** in a streaming update (`streaming: false`). Otherwise it is read-only.
    -   This is the best mode for displaying streaming output.

-   **Diff mode (`diff`)**:
    -   **Availability**: The switch button for this mode is **rendered** only when the `originalContent` prop is given valid content (controlled by `v-if`). If `originalContent` is empty, the button is removed from the DOM entirely, not just disabled.
    -   Uses the `TextDiffUI` component to clearly show the differences between `content` and `originalContent`.

### 6.2. Smart auto-switching

This mechanism is designed to optimize the user experience during streaming updates, making it seamless and smart.

-   **Auto enter**: When `props.streaming` becomes `true`, the component will:
    1.  Internally remember the user's current view mode (e.g. `render`).
    2.  Automatically switch the view to `source` mode, since this is the best way to display a stream of raw text.
-   **Auto restore**: When `props.streaming` becomes `false`, the component automatically restores the view mode the user had previously chosen.

This process lets users clearly see the data being generated without losing their preferred viewing mode after it finishes.

### 6.3. Smart show/hide of the reasoning area

To resolve the potential conflict between "auto expand/collapse" and "manual user actions", we introduced a "user intent memory" mechanism.

**Core state**:
- `isReasoningExpanded: ref(false)`: Controls the current expanded/collapsed state of the reasoning area.
- `userHasManuallyToggledReasoning: ref(false)`: Remembers whether the user has acted manually.

**Logic**:

| Scenario | Condition | Behavior |
| :--- | :--- | :--- |
| **Default state** | Component initialization | The reasoning area is collapsed by default. |
| **Manual action** | User clicks the expand/collapse button | 1. Toggle the `isReasoningExpanded` state.<br>2. Set `userHasManuallyToggledReasoning` to `true`, **locking the automatic behavior**. |
| **New task starts** | `props.streaming` changes from `false` to `true` | **Reset the user memory**: set `userHasManuallyToggledReasoning` back to `false`, letting the automation take over again. |
| **Auto expand** | 1. `userHasManuallyToggledReasoning` is `false`.<br>2. `props.reasoning` is detected to start receiving streamed content. | Set `isReasoningExpanded` to `true`. |
| **Auto collapse** | 1. `userHasManuallyToggledReasoning` is `false`.<br>2. `props.streaming` changes from `true` to `false`. | Set `isReasoningExpanded` to `false`. |

This design ensures that the user's explicit actions have the highest priority, and the system performs smart automatic show/hide only when the user has not intervened, providing a seamless and unobtrusive user experience.

## V2 Refactor Implementation Summary

This section records the key decisions, implementation details, and follow-up optimizations from the V1 to V2 refactor, as a supplement to the final design.

### 1. Core improvements

The core improvements finally achieved by the refactor are as follows:

-   **UI structure optimization**:
    -   **Unified top-level toolbar**: Removed the old floating toolbar and replaced it with an always-visible top-level toolbar, greatly improving the discoverability and efficiency of common features (such as view switching and copy).
    -   **Clear function grouping**: The toolbar is explicitly divided into a left "view control area" and a right "action execution area", matching user intuition.
    -   **Independent reasoning panel**: Moved the "reasoning" panel below the top-level toolbar and created an independent title bar for it that can be clicked to expand/collapse.

-   **Interaction experience improvements**:
    -   Implemented smart automatic view mode switching during streaming updates (switch to source on entry, restore on end), remembering the user's choice after manual intervention.
    -   Implemented smart expand/collapse logic for the reasoning panel, optimizing how information is presented while content loads.

-   **Code quality improvements**:
    -   Greatly simplified the state management logic, removing many old states such as `isHovering`, `isEditing`, and `manualToggleActive`.
    -   Simplified the event handling mechanism, making component behavior more predictable.
    -   The unified and simplified design improved the maintainability and testability of the component, with good final test coverage (all 35 test cases pass).

### 2. Follow-up optimization log (style and layout)

After the core refactor was complete, a series of optimizations aimed at improving visual consistency and fixing style conflicts were made:

-   **Removed a redundant control**: Removed the extra "Copy" button in the reasoning panel, simplifying the interface.
-   **Unified padding**:
    -   **Problem**: The padding of render mode (`MarkdownRenderer`) and source mode (`textarea`) was found to be inconsistent, causing visual jumps.
    -   **Solution**: Added `!p-0` to the render mode container to override the default padding provided by `theme-card`, then applied a uniform `px-3 py-2` padding to both `MarkdownRenderer` and `textarea`, ensuring visual consistency across views.

### 3. Theme style conflict fix (key lesson)

When adapting V2 to custom themes (such as purple and green), we ran into a problem of a third-party library overriding styles. The final solution is recorded as an important lesson:

-   **Root cause**: The Tailwind Typography plugin (the `prose` class) injects a complete style scheme including foreground and background colors, which overrides the background color the project's custom theme sets for Markdown content, resulting in an incongruous light background under dark themes.
-   **Final solution**:
    1.  **Isolate styles**: In `theme.css`, completely removed the definition of `.theme-markdown-content` from `@apply prose-sm ...`, cutting off the strong color injection from `prose`.
    2.  **Rebuild the layout manually**: Manually added purely layout and spacing styles with no colors (such as `font-size`, `margin`, `padding`) to Markdown elements like `h1`, `p`, `ul`, and `code`.
    -   **Conclusion**: This "**fully isolate, rebuild manually**" strategy is an effective way to resolve conflicts between a third-party library with strong style opinions and a custom theme system. It ensures that the custom theme's color system is applied correctly while keeping the necessary text layout. 
