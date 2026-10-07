# Global Function Mode and Context Templates

This document describes the relationship between the global function mode (basic/pro) and the six template types, as well as how history records and storage keys are coordinated.

## Function Mode

- Preference key: `app:settings:ui:function-mode`
- Values: `'basic' | 'pro'` (default `'basic'`; automatically persisted as `'basic'` on first run)
- Purpose: Uniformly drives behaviors such as template dropdown selection and history reuse (a global source similar to theme/language).

## Template Type Mapping (6 types)

- Basic (basic):
  - System optimization: `optimize`
  - User optimization: `userOptimize`
  - Iterative optimization: `iterate`
- Pro (pro):
  - Context - system optimization: `contextSystemOptimize`
  - Context - user optimization: `contextUserOptimize`
  - Context - iterative optimization: `contextIterate`

> Pages (such as App.vue) automatically choose the corresponding template type based on the current `function-mode` and the system/user/iterate family; no new local toggle is needed.

## Template Manager Categories

The template manager is independent of the function mode and provides full management of all 6 template types:
- `optimize` / `userOptimize` / `iterate`
- `contextSystemOptimize` / `contextUserOptimize` / `contextIterate`

When a template is created or copied within a category, its `metadata.templateType` is set to the type corresponding to that category.

## Template Selection Persistence (Keys)

To preserve the "memory" experience after switching modes, selections for basic and pro modes are stored separately:

- Basic:
  - System: `app:selected-optimize-template`
  - User: `app:selected-user-optimize-template`
  - Iterate: `app:selected-iterate-template`
- Pro (context):
  - System: `app:selected-context-system-optimize-template`
  - User: `app:selected-context-user-optimize-template`
  - Iterate: `app:selected-context-iterate-template`

When `function-mode` is switched, the system reads the corresponding key; if it does not exist, it falls back to the first item in that type's list and writes it back.

## History

- Types: Extended to 6, consistent with the template types (plus `test`).
- New chain:
  - `function-mode='pro'` or a `context*` template selected → recorded as `contextSystemOptimize`/`contextUserOptimize`.
  - Otherwise recorded as the basic type `optimize`/`userOptimize`;
  - Iteration versions are always `iterate` (staying in the same family as the root type).
- Reuse chain:
  - Root record type is `context*` → automatically switch to `function-mode='pro'`;
  - Root record type is basic → automatically switch to `function-mode='basic'`;
  - Also switch the `system/user` optimization mode according to the root type.

## Fallback Strategy

When a `context*` type is requested but no template is available:
- The dropdown list is empty and guides the user to add a template in the template manager;
- The service layer's default template lookup falls back from `context*` to the corresponding basic type, so the flow is not interrupted.

## Compatibility

- The default `function-mode` is `'basic'`, which is backward compatible with older versions;
- If a historical boolean "advanced mode" exists, it can be migrated to `function-mode` in one pass: `true → 'pro'`, `false → 'basic'` (optional at the implementation layer).

