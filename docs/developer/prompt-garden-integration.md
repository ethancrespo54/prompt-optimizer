# Prompt Garden -> Prompt Optimizer Import Contract (External Import Contract)

This document defines the "external import" contract between Prompt Garden and Prompt Optimizer.

Design goals:

- The URL carries minimal information (`importCode` + optional `subModeKey`)
- Prompt Optimizer always fetches content from `VITE_PROMPT_GARDEN_BASE_URL`
- The Garden API response format is consistent across all sub-modes (this is the core of the plugin contract)
- Only the **v1 schema** response is supported (no need to be compatible with the legacy `{ content, title }` fallback protocol)

## 1. Prompt Optimizer Side: Import Trigger and Parameters

After startup, Prompt Optimizer checks the current route query:

- If `importCode` is present, an import is triggered once
- After a successful import, the query is cleared (to avoid repeated imports on refresh)

### 1.1 URL Parameters (Minimal Set)

- `importCode` (required)
  - The unique identifier of the external prompt (for example `NB-001`)
- `subModeKey` (optional)
  - Explicitly specifies the target workspace for the import (`mode` is no longer supported)

Allowed `subModeKey` values:

- `basic-system`
- `basic-user`
- `pro-multi`
- `pro-variable`
- `image-text2image`
- `image-image2image`

Notes:

- `subModeKey` is only used to override the import target workspace.
- It is recommended to trigger the import by "opening the corresponding workspace route" (see 1.2) rather than relying on the query.

### 1.2 URL Examples (Recommended: Garden Opens a Non-Root Route Directly)

- Import into basic-system (simplest):
  - `https://prompt.example.com/#/basic/system?importCode=NB-001`

- Import into image-text2image (simplest):
  - `https://prompt.example.com/#/image/text2image?importCode=NB-001`

- If you want the query to specify the target workspace (optional):
  - `https://prompt.example.com/#/basic/system?importCode=NB-001&subModeKey=basic-system`

## 2. Prompt Garden Side: Required API

Prompt Optimizer will call:

`GET {gardenBaseUrl}/api/prompt-source/{encodeURIComponent(importCode)}`

Where:

- `gardenBaseUrl` always comes from Prompt Optimizer's environment variable `VITE_PROMPT_GARDEN_BASE_URL`
- `{encodeURIComponent(importCode)}` is used for safe concatenation

## 3. API Response Format (Key Point of the Contract: Consistent Across Sub-Modes)

Regardless of which `subModeKey` is being imported into, the API response format must be the same.

### 3.1 Success Response (HTTP 200)

`Content-Type: application/json` is recommended, returning **v1 schema** JSON:

```json
{
  "schema": "prompt-garden.prompt.v1",
  "schemaVersion": 1,
  "optimizerTarget": {
    "subModeKey": "basic-system"
  },
  "prompt": {
    "format": "text",
    "text": "..."
  },
  "variables": [
    {
      "name": "var_name",
      "defaultValue": "optional"
    }
  ]
}
```

Field constraints (v1):

- `schema`: required, fixed to `prompt-garden.prompt.v1`
- `schemaVersion`: required, fixed to `1`
- `optimizerTarget`: required
  - `optimizerTarget.subModeKey`: required, the import target workspace; see 1.1 for allowed values
- `prompt`: required
  - `prompt.format`: required, allowed values: `text` / `messages`
  - `prompt.text`: required when `format=text`, and must be a non-empty string
  - `prompt.messages`: required when `format=messages`, a message array (see 3.2)
- `variables`: required (an empty array `[]` is allowed), used to inject temporary variables into the target workspace (see 3.3)

Sub-mode differences:

- `optimizerTarget.subModeKey` only affects **which session store is written to**
- The API response does not need to distinguish sub-modes (the response structure is fixed)
- In image mode: the import only writes the prompt and variables; it does not import the input image (the input image for image2image must be chosen/uploaded by the user in the Optimizer)

### 3.2 prompt.messages Definition (format=messages)

`prompt.messages` is an array, and each item is:

```json
{
  "id": "optional-but-recommended",
  "role": "system",
  "content": "...",
  "originalContent": "optional"
}
```

Field constraints:

- `role`: required, allowed values: `system` / `user` / `assistant` / `tool`
- `content`: required, a non-empty string
- `id`: recommended (a string), so that Prompt Optimizer can stably select the message after import
- `originalContent`: optional; if not provided, it may be the same as `content`

### 3.3 variables Definition

`variables` is an array, and each item is:

```json
{
  "name": "variable_name",
  "defaultValue": "optional"
}
```

Field constraints:

- `name`: required, must conform to Prompt Optimizer's variable naming rules (recommended: `[a-zA-Z_][a-zA-Z0-9_]*`)
- `defaultValue`: optional, a string

Notes:

- On import, Prompt Optimizer writes `variables` into the "temporary variables" (temporaryVariables) store of the corresponding sub-mode.
- If the variable already exists before the import, the import will not overwrite the existing value (to avoid breaking the user's current variable settings).

### 3.4 Placeholder Syntax (Mandatory)

Prompt Optimizer only supports Mustache variable placeholders:

- ✅ `{{variable_name}}`
- ✅ `{{ variable_name }}` (spaces on both sides inside the braces are allowed)
- ❌ `{variable_name}` (not supported; will not be converted automatically)

Constraints:

- Variable placeholders appearing in `prompt.text` / `prompt.messages[].content` must use `{{...}}`.
- Prompt Garden should not return `{var}`-style placeholders; Prompt Optimizer does no compatibility handling or normalization.

### 3.5 Failure Responses

Suggested semantics:

- `404`: `importCode` does not exist
- `400`: `importCode` is invalid
- `500`: server error

For Prompt Optimizer:

- Any non-2xx response is treated as an import failure and the user is notified

## 4. CORS / Security Recommendations

Because Prompt Optimizer (Web) is a pure frontend application, cross-origin fetch requires Prompt Garden to configure CORS correctly.

Recommendations:

- `/api/prompt-source/*` should return:
  - `Access-Control-Allow-Origin: https://prompt.example.com` (or your actual deployment domain)
  - In development, `*` can be used temporarily to ease integration testing

## 5. Environment Variables

Prompt Optimizer side:

- `VITE_ENABLE_PROMPT_GARDEN_IMPORT=1` (or `true`)
  - Disabled by default; the import logic is registered only when enabled
- `VITE_PROMPT_GARDEN_BASE_URL=http://localhost:3000`
  - The fixed base URL of Prompt Garden (cannot be overridden via URL parameters)

## 6. Optional Integrations Mechanism

Prompt Optimizer uses an "optional integrations" mechanism to implement low-intrusion extensions:

- Integration modules are located at: `packages/ui/src/integrations/`
- Files are named: `*.integration.ts`
- Each module exports an `integration` object and uses `envFlag` to control whether it is enabled
- App calls only once: `registerOptionalIntegrations(...)`

Prompt Garden is one of the optional integrations, with the file:

- `packages/ui/src/integrations/prompt-garden.integration.ts`

## 7. Reference Implementation

Prompt Optimizer side import logic:

- `packages/ui/src/composables/app/useAppPromptGardenImport.ts`
