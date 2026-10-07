# Image Mode

Image Mode provides text-to-image (T2I) and image-to-image (I2I, a single local image) capabilities. The output is uniformly base64 (default image/png), and multiple images are generated serially.

## Feature Scope
- Text-to-image: text prompt only
- Image-to-image: a single local image + text prompt (png/jpeg only, ≤10MB)
- Output: base64 (default image/png)
- Number of images: 1~4 (serial, not concurrent)
- Not yet supported: multi-image fusion, image sets, mask/local editing, upscale, history, image templates

## Built-in Image Models and Environment Variables
- Gemini (image-gemini)
  - provider: `gemini`
  - defaultModel: `gemini-2.5-flash-image-preview`
  - apiKey: reuses `VITE_GEMINI_API_KEY`
- Seedream (image-seedream)
  - provider: `seedream`
  - defaultModel: `doubao-seedream-4-0-250828`
  - apiKey: reads `VITE_SEEDREAM_API_KEY` | `VITE_ARK_API_KEY` (or `process.env.ARK_API_KEY`)

> Tip: Once the environment variables above are configured, the built-in image models are injected automatically and enabled on demand.

## Usage (Web)
1. In the top navigation, "Advanced Mode" is now a dropdown: select "Image Mode".
2. Enter a prompt on the left; optionally choose a local image (image-to-image); set the number of images (1~4).
3. Select an image model (from the image model manager).
4. Click "Generate"; a single-image base64 preview is shown on the right, with download and copy support.

## Model Management
- The model manager adds a new tab: "Text Models | Image Models".
- The image model tab supports: add, edit, enable/disable, delete.
- Connectivity test: not currently available on the image tab (a quick small-image check may be considered later).

## Validation and Limits
- Local image: only `image/png` or `image/jpeg`; size ≤ 10MB (validated on both frontend and backend).
- count: 1~4, executed serially.
- Seedream requests always disable image sets (`sequential_image_generation='disabled'`) and return `b64_json`.

## Development Notes
- Core layer: `ImageService` + adapters (Gemini/Seedream/OpenAI); the adapter registry routes by provider.
- UI: `ImageWorkspace.vue` is the Image Mode workspace; it calls `ImageService` through `useImageGeneration`.
- Proxy and network: only direct access to model providers is currently supported. If you hit cross-origin restrictions in a browser environment, use the desktop version or configure a reverse proxy yourself.
