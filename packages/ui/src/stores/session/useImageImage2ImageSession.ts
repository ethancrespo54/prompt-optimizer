/**
 * Image-Image2Image Session Store
 *
 * Manages the session state of the Image2Image sub-mode under Image mode
 * Characteristics:
 * - Contains the input image (uses ImageRef; the base64 data is stored in ImageStorageService)
 * - Image editing/transformation scenarios
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getPiniaServices } from '../../plugins/pinia'
import { isValidVariableName, sanitizeVariableRecord } from '../../types/variable'
import {
  isImageRef,
  createImageRef,
  type ImageResult,
  type IImageStorageService
} from '@prompt-optimizer/core'
import {
  IMAGE_IMAGE2IMAGE_SESSION_KEY,
  computeStableImageId,
  queueImageStorageMaintenance,
  scheduleImageStorageGc,
} from './imageStorageMaintenance'
import {
  createDefaultEvaluationResults,
  type PersistedEvaluationResults,
} from '../../types/evaluation'

type ImageResultItem = ImageResult['images'][number]

/**
 * Version selection of the image mode test panel:
 * - 0: v0 (original prompt)
 * - >=1: v1..vn (history chain version number)
 * - 'latest': follows the latest vn
 */
export type TestPanelVersionValue = 0 | number | 'latest'

export type TestVariantId = 'a' | 'b' | 'c' | 'd'

export type TestColumnCount = 2 | 3 | 4

export interface ImageWorkspaceLayoutConfig {
  /** Left width of the main layout (percentage, 25..50) */
  mainSplitLeftPct: number
  /** Number of test area columns (2..4) */
  testColumnCount: TestColumnCount
}

export interface TestVariantConfig {
  id: TestVariantId
  /** Prompt version (v0 / vN / latest) */
  version: TestPanelVersionValue
  /** Image model config key (configId) */
  modelKey: string
}

export type TestVariantResults = Record<TestVariantId, ImageResult | null>

export type TestVariantLastRunFingerprint = Record<TestVariantId, string>

export interface ImageImage2ImageSessionState {
  originalPrompt: string
  optimizedPrompt: string
  reasoning: string
  chainId: string
  versionId: string

  /**
   * Temporary variables (sub-mode isolated + persisted)
   * - Persisted at the image-image2image level (survives refresh)
   * - Not shared with image-text2image / pro-*
   */
  temporaryVariables: Record<string, string>

  inputImageB64: string | null
  inputImageId: string | null
  inputImageMime: string
  originalImageResult: ImageResult | null
  optimizedImageResult: ImageResult | null
  // v2: multi-column testing (up to 4 columns)
  layout: ImageWorkspaceLayoutConfig
  testVariants: TestVariantConfig[]
  testVariantResults: TestVariantResults
  testVariantLastRunFingerprint: TestVariantLastRunFingerprint
  evaluationResults: PersistedEvaluationResults
  isCompareMode: boolean
  selectedTextModelKey: string
  selectedImageModelKey: string
  selectedTemplateId: string | null
  selectedIterateTemplateId: string | null
  lastActiveAt: number
}

/**
 * Default state
 */
const createDefaultState = (): ImageImage2ImageSessionState => ({
  originalPrompt: '',
  optimizedPrompt: '',
  reasoning: '',
  chainId: '',
  versionId: '',
  temporaryVariables: {},
  inputImageB64: null,
  inputImageId: null,
  inputImageMime: '',
  originalImageResult: null,
  optimizedImageResult: null,
  // v2: multi-column testing (up to 4 columns)
  layout: { mainSplitLeftPct: 50, testColumnCount: 2 },
  testVariants: [
    { id: 'a', version: 0, modelKey: '' },
    { id: 'b', version: 'latest', modelKey: '' },
    { id: 'c', version: 'latest', modelKey: '' },
    { id: 'd', version: 'latest', modelKey: '' },
  ],
  testVariantResults: {
    a: null,
    b: null,
    c: null,
    d: null,
  },
  testVariantLastRunFingerprint: {
    a: '',
    b: '',
    c: '',
    d: '',
  },
  evaluationResults: createDefaultEvaluationResults(),
  isCompareMode: true,
  selectedTextModelKey: '',
  selectedImageModelKey: '',
  selectedTemplateId: null,
  selectedIterateTemplateId: null,
  lastActiveAt: Date.now(),
})

export const useImageImage2ImageSession = defineStore('imageImage2ImageSession', () => {
  // ========== State definitions (uses independent refs rather than wrapping them in a state object) ==========

  const originalPrompt = ref('')
  const optimizedPrompt = ref('')
  const reasoning = ref('')
  const chainId = ref('')
  const versionId = ref('')
  const temporaryVariables = ref<Record<string, string>>({})
  const evaluationResults = ref<PersistedEvaluationResults>(createDefaultEvaluationResults())
  const inputImageB64 = ref<string | null>(null)
  const inputImageId = ref<string | null>(null)
  const inputImageMime = ref('')
  const originalImageResult = ref<ImageResult | null>(null)
  const optimizedImageResult = ref<ImageResult | null>(null)
  // v2: multi-column testing (up to 4 columns)
  const layout = ref<ImageWorkspaceLayoutConfig>({ mainSplitLeftPct: 50, testColumnCount: 2 })
  const testVariants = ref<TestVariantConfig[]>([
    { id: 'a', version: 0, modelKey: '' },
    { id: 'b', version: 'latest', modelKey: '' },
    { id: 'c', version: 'latest', modelKey: '' },
    { id: 'd', version: 'latest', modelKey: '' },
  ])
  const testVariantResults = ref<TestVariantResults>({
    a: null,
    b: null,
    c: null,
    d: null,
  })
  const testVariantLastRunFingerprint = ref<TestVariantLastRunFingerprint>({
    a: '',
    b: '',
    c: '',
    d: '',
  })
  const isCompareMode = ref(true)
  const selectedTextModelKey = ref('')
  const selectedImageModelKey = ref('')
  const selectedTemplateId = ref<string | null>(null)
  const selectedIterateTemplateId = ref<string | null>(null)
  const lastActiveAt = ref(Date.now())

  const updatePrompt = (prompt: string) => {
    if (originalPrompt.value === prompt) return
    originalPrompt.value = prompt
    lastActiveAt.value = Date.now()
  }

  const updateOptimizedResult = (payload: {
    optimizedPrompt: string
    reasoning?: string
    chainId: string
    versionId: string
  }) => {
    const nextOptimizedPrompt = payload.optimizedPrompt
    const nextReasoning = payload.reasoning || ''
    const nextChainId = payload.chainId
    const nextVersionId = payload.versionId

    const changed =
      optimizedPrompt.value !== nextOptimizedPrompt ||
      reasoning.value !== nextReasoning ||
      chainId.value !== nextChainId ||
      versionId.value !== nextVersionId

    if (!changed) return

    optimizedPrompt.value = nextOptimizedPrompt
    reasoning.value = nextReasoning
    chainId.value = nextChainId
    versionId.value = nextVersionId
    lastActiveAt.value = Date.now()
  }

  const updateInputImage = (b64: string | null, mimeType: string = '', imageId?: string) => {
    inputImageB64.value = b64
    inputImageId.value = imageId || null
    inputImageMime.value = mimeType
    lastActiveAt.value = Date.now()
  }

  const updateOriginalImageResult = (result: ImageResult | null) => {
    originalImageResult.value = result
    testVariantResults.value = { ...testVariantResults.value, a: result }
    lastActiveAt.value = Date.now()
  }

  const updateOptimizedImageResult = (result: ImageResult | null) => {
    optimizedImageResult.value = result
    testVariantResults.value = { ...testVariantResults.value, b: result }
    lastActiveAt.value = Date.now()
  }

  const setTestColumnCount = (count: TestColumnCount) => {
    if (layout.value.testColumnCount === count) return
    layout.value = { ...layout.value, testColumnCount: count }
    lastActiveAt.value = Date.now()
    saveSession().catch(error => {
      console.error('[ImageImage2ImageSession] Failed to auto-save the session:', error)
    })
  }

  const setMainSplitLeftPct = (pct: number) => {
    const normalized = Number.isFinite(pct) ? Math.round(pct) : layout.value.mainSplitLeftPct
    const next = Math.min(50, Math.max(25, normalized))
    if (layout.value.mainSplitLeftPct === next) return
    layout.value = { ...layout.value, mainSplitLeftPct: next }
    lastActiveAt.value = Date.now()
    saveSession().catch(error => {
      console.error('[ImageImage2ImageSession] Failed to auto-save the session:', error)
    })
  }

  const updateTestVariant = (id: TestVariantId, patch: Partial<Omit<TestVariantConfig, 'id'>>) => {
    const idx = testVariants.value.findIndex(v => v.id === id)
    if (idx < 0) return
    const prev = testVariants.value[idx]
    const next: TestVariantConfig = { ...prev, ...patch, id }
    if (prev.version === next.version && prev.modelKey === next.modelKey) return
    const nextList = testVariants.value.slice()
    nextList[idx] = next
    testVariants.value = nextList
    lastActiveAt.value = Date.now()
    saveSession().catch(error => {
      console.error('[ImageImage2ImageSession] Failed to auto-save the session:', error)
    })
  }

  const updateTestVariantResult = (id: TestVariantId, result: ImageResult | null) => {
    testVariantResults.value = { ...testVariantResults.value, [id]: result }
    // legacy alias: A/B
    if (id === 'a') originalImageResult.value = result
    if (id === 'b') optimizedImageResult.value = result
    lastActiveAt.value = Date.now()
  }

  const setTestVariantLastRunFingerprint = (id: TestVariantId, fingerprint: string) => {
    if (testVariantLastRunFingerprint.value[id] === fingerprint) return
    testVariantLastRunFingerprint.value = { ...testVariantLastRunFingerprint.value, [id]: fingerprint }
    lastActiveAt.value = Date.now()
  }

  const updateTextModel = (modelKey: string) => {
    if (selectedTextModelKey.value === modelKey) return
    selectedTextModelKey.value = modelKey
    lastActiveAt.value = Date.now()
    saveSession().catch(error => {
      console.error('[ImageImage2ImageSession] Failed to auto-save the session:', error)
    })
  }

  const updateImageModel = (modelKey: string) => {
    if (selectedImageModelKey.value === modelKey) return
    selectedImageModelKey.value = modelKey
    lastActiveAt.value = Date.now()
    // Save the full state asynchronously (best-effort)
    saveSession().catch(error => {
      console.error('[ImageImage2ImageSession] Failed to auto-save the session:', error)
    })
  }

  const updateTemplate = (templateId: string | null) => {
    if (selectedTemplateId.value === templateId) return
    selectedTemplateId.value = templateId
    lastActiveAt.value = Date.now()
    saveSession().catch(error => {
      console.error('[ImageImage2ImageSession] Failed to auto-save the session:', error)
    })
  }

  const updateIterateTemplate = (templateId: string | null) => {
    if (selectedIterateTemplateId.value === templateId) return
    selectedIterateTemplateId.value = templateId
    lastActiveAt.value = Date.now()
    saveSession().catch(error => {
      console.error('[ImageImage2ImageSession] Failed to auto-save the session:', error)
    })
  }

  const toggleCompareMode = (enabled?: boolean) => {
    const nextValue = enabled ?? !isCompareMode.value
    if (isCompareMode.value === nextValue) return
    isCompareMode.value = nextValue
    lastActiveAt.value = Date.now()
  }

  // Temporary variables (persisted to the session)
  const setTemporaryVariable = (name: string, value: string) => {
    if (!isValidVariableName(name)) {
      console.warn('[ImageImage2ImageSession] Ignoring invalid temporary variable name:', name)
      return
    }
    temporaryVariables.value[name] = value
    lastActiveAt.value = Date.now()
  }

  const getTemporaryVariable = (name: string): string | undefined => {
    return Object.prototype.hasOwnProperty.call(temporaryVariables.value, name)
      ? temporaryVariables.value[name]
      : undefined
  }

  const deleteTemporaryVariable = (name: string) => {
    if (!Object.prototype.hasOwnProperty.call(temporaryVariables.value, name)) return
    delete temporaryVariables.value[name]
    lastActiveAt.value = Date.now()
  }

  const clearTemporaryVariables = () => {
    temporaryVariables.value = {}
    lastActiveAt.value = Date.now()
  }

  const reset = () => {
    const defaultState = createDefaultState()
    originalPrompt.value = defaultState.originalPrompt
    optimizedPrompt.value = defaultState.optimizedPrompt
    reasoning.value = defaultState.reasoning
    chainId.value = defaultState.chainId
    versionId.value = defaultState.versionId
    temporaryVariables.value = defaultState.temporaryVariables
    inputImageB64.value = defaultState.inputImageB64
    inputImageId.value = defaultState.inputImageId
    inputImageMime.value = defaultState.inputImageMime
    originalImageResult.value = defaultState.originalImageResult
    optimizedImageResult.value = defaultState.optimizedImageResult
    layout.value = defaultState.layout
    testVariants.value = defaultState.testVariants
    testVariantResults.value = defaultState.testVariantResults
    testVariantLastRunFingerprint.value = defaultState.testVariantLastRunFingerprint
    evaluationResults.value = defaultState.evaluationResults
    isCompareMode.value = defaultState.isCompareMode
    selectedTextModelKey.value = defaultState.selectedTextModelKey
    selectedImageModelKey.value = defaultState.selectedImageModelKey
    selectedTemplateId.value = defaultState.selectedTemplateId
    selectedIterateTemplateId.value = defaultState.selectedIterateTemplateId
    lastActiveAt.value = defaultState.lastActiveAt
  }

  /**
   * Prepare an ImageResult for saving
   * Extracts the base64 image into ImageStorageService and returns an ImageResult containing only references
   */
  const prepareForSave = async (
    result: ImageResult | null,
    storageService: IImageStorageService
  ): Promise<ImageResult | null> => {
    if (!result || !result.images || result.images.length === 0) {
      return result
    }

    const processedImages: ImageResultItem[] = []

    for (const img of result.images) {
      // If it is already a reference, keep it directly
      if (isImageRef(img)) {
        processedImages.push(img)
        continue
      }

      // If there is base64 data, save it to the storage service and create a reference
      if (img.b64) {
        const mimeType = img.mimeType || 'image/png'
        const imageId = await computeStableImageId(img.b64, mimeType)

        const existing = await storageService.getMetadata(imageId)
        if (!existing) {
          await storageService.saveImage({
            metadata: {
              id: imageId,
              mimeType,
              sizeBytes: Math.floor(img.b64.length * 0.75),
              createdAt: Date.now(),
              accessedAt: Date.now(),
              source: 'generated',
              metadata: {
                prompt: result.metadata?.prompt,
                modelId: result.metadata?.modelId,
                configId: result.metadata?.configId
              }
            },
            data: img.b64
          })
        }

        processedImages.push(createImageRef(imageId))
      } else {
        // URL or another format, keep directly
        processedImages.push(img)
      }
    }

    return {
      ...result,
      images: processedImages
    }
  }

  /**
   * Load the full image data from an ImageRef
   */
  const loadFromRef = async (
    result: ImageResult | null,
    storageService: IImageStorageService
  ): Promise<ImageResult | null> => {
    if (!result || !result.images || result.images.length === 0) {
      return result
    }

    const loadedImages: ImageResultItem[] = []

    for (const img of result.images) {
      // If it is a reference, load it from the storage service
      if (isImageRef(img)) {
        try {
          const fullImageData = await storageService.getImage(img.id)
          if (fullImageData) {
            loadedImages.push({
              b64: fullImageData.data,
              mimeType: fullImageData.metadata.mimeType
            })
          } else {
            console.warn(`[ImageImage2ImageSession] Image ${img.id} not found`)
            // Image not found, keep the reference (the UI will show an error)
            loadedImages.push(img)
          }
        } catch (error) {
          console.error(`[ImageImage2ImageSession] Failed to load image ${img.id}:`, error)
          // Loading failed, keep the reference
          loadedImages.push(img)
        }
      } else {
        // Not a reference format (URL or base64), keep directly
        loadedImages.push(img)
      }
    }

    return {
      ...result,
      images: loadedImages
    }
  }

  /**
   * Save the input image to the storage service
   */
  const saveInputImage = async (
    b64: string,
    mimeType: string,
    storageService: IImageStorageService
  ): Promise<string> => {
    const normalizedMime = mimeType || 'image/png'
    const imageId = await computeStableImageId(b64, normalizedMime)

    const existing = await storageService.getMetadata(imageId)
    if (!existing) {
      await storageService.saveImage({
        metadata: {
          id: imageId,
          mimeType: normalizedMime,
          sizeBytes: Math.floor(b64.length * 0.75),
          createdAt: Date.now(),
          accessedAt: Date.now(),
          source: 'uploaded'
        },
        data: b64
      })
    }

    return imageId
  }

  const saveSession = async () => {
    return await queueImageStorageMaintenance(async () => {
      const $services = getPiniaServices()
      if (!$services?.preferenceService) {
        throw new Error('[ImageImage2ImageSession] PreferenceService is unavailable, cannot save the session')
      }
      if (!$services?.imageStorageService) {
        throw new Error('[ImageImage2ImageSession] ImageStorageService is unavailable, cannot save the session')
      }

      // Prepare the data to save
      let inputImageIdToSave = inputImageId.value
      // v2: multi-column variants
      const baseVariantResults: TestVariantResults = {
        a: testVariantResults.value.a ?? originalImageResult.value,
        b: testVariantResults.value.b ?? optimizedImageResult.value,
        c: testVariantResults.value.c,
        d: testVariantResults.value.d,
      }

      // Save the input image
      if (inputImageB64.value && !inputImageId.value) {
        inputImageIdToSave = await saveInputImage(
          inputImageB64.value,
          inputImageMime.value,
          $services.imageStorageService
        )

        // ✅ Fix: only update the ID and keep the base64 in the runtime ref
        // Avoid the image disappearing from the UI after clearing it
        inputImageId.value = inputImageIdToSave
        // inputImageB64.value = null  // ❌ Remove this line; do not clear the runtime data
      }

      const variantResultsToSave: TestVariantResults = {
        a: await prepareForSave(baseVariantResults.a, $services.imageStorageService),
        b: await prepareForSave(baseVariantResults.b, $services.imageStorageService),
        c: await prepareForSave(baseVariantResults.c, $services.imageStorageService),
        d: await prepareForSave(baseVariantResults.d, $services.imageStorageService),
      }

      // ✅ Fix: do not modify the runtime ref; only use the converted data when serializing

      // Build the snapshot (without base64)
      const snapshot = {
        originalPrompt: originalPrompt.value,
        optimizedPrompt: optimizedPrompt.value,
        reasoning: reasoning.value,
        chainId: chainId.value,
        versionId: versionId.value,
        temporaryVariables: sanitizeVariableRecord(temporaryVariables.value),
        inputImageId: inputImageIdToSave,
        inputImageB64: null,
        inputImageMime: inputImageMime.value,
        // legacy: still keep the original/optimized fields (corresponding to A/B)
        originalImageResult: variantResultsToSave.a,
        optimizedImageResult: variantResultsToSave.b,
        // v2: multi-column variants
        layout: layout.value,
        testVariants: testVariants.value,
        testVariantResults: variantResultsToSave,
        testVariantLastRunFingerprint: testVariantLastRunFingerprint.value,
        evaluationResults: evaluationResults.value,
        isCompareMode: isCompareMode.value,
        selectedTextModelKey: selectedTextModelKey.value,
        selectedImageModelKey: selectedImageModelKey.value,
        selectedTemplateId: selectedTemplateId.value,
        selectedIterateTemplateId: selectedIterateTemplateId.value,
        lastActiveAt: lastActiveAt.value,
      }

      await $services.preferenceService.set(IMAGE_IMAGE2IMAGE_SESSION_KEY, snapshot)
      scheduleImageStorageGc($services.preferenceService, $services.imageStorageService)
    })
  }

  const restoreSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      throw new Error('[ImageImage2ImageSession] PreferenceService is unavailable, cannot restore the session')
    }
    if (!$services?.imageStorageService) {
      throw new Error('[ImageImage2ImageSession] ImageStorageService is unavailable, cannot restore the session')
    }

    try {
      const saved = await $services.preferenceService.get<unknown>(
        IMAGE_IMAGE2IMAGE_SESSION_KEY,
        null
      )

      if (saved) {
        const parsed =
          typeof saved === 'string'
            ? (JSON.parse(saved) as Record<string, unknown>)
            : (saved as Record<string, unknown>)

        const defaultState = createDefaultState()

        // Load the input image from storage
        let inputImageB64Loaded = null
        if (typeof parsed.inputImageId === 'string' && parsed.inputImageId) {
          try {
            const fullImageData = await $services.imageStorageService.getImage(parsed.inputImageId)
            if (fullImageData) {
              inputImageB64Loaded = fullImageData.data
            }
          } catch (error) {
            console.error(`[ImageImage2ImageSession] Failed to load the input image:`, error)
          }
        } else {
          // Backward compatibility: if there is base64 data, use it directly
          inputImageB64Loaded = typeof parsed.inputImageB64 === 'string' ? parsed.inputImageB64 : null
        }

        // ==================== v2: multi-column variants ====================
        // layout
        const rawLayout = parsed.layout
        if (rawLayout && typeof rawLayout === 'object') {
          const layoutRecord = rawLayout as Record<string, unknown>
          const pct =
            typeof layoutRecord['mainSplitLeftPct'] === 'number'
              ? (layoutRecord['mainSplitLeftPct'] as number)
              : defaultState.layout.mainSplitLeftPct
          const countRaw = layoutRecord['testColumnCount']
          const count: TestColumnCount = countRaw === 2 || countRaw === 3 || countRaw === 4 ? countRaw : defaultState.layout.testColumnCount
          layout.value = {
            mainSplitLeftPct: Math.min(50, Math.max(25, Math.round(pct))),
            testColumnCount: count,
          }
        } else {
          layout.value = defaultState.layout
        }

        // testVariants
        const rawVariants = parsed.testVariants
        if (Array.isArray(rawVariants)) {
          const byId = new Map<TestVariantId, TestVariantConfig>()

          const normalizeVersion = (v: unknown): TestPanelVersionValue => {
            if (v === 0) return 0
            if (v === 'latest') return 'latest'
            if (typeof v === 'number' && Number.isFinite(v) && v >= 1) return v
            return 'latest'
          }

          for (const item of rawVariants) {
            if (!item || typeof item !== 'object') continue
            const obj = item as Record<string, unknown>
            const id = obj['id']
            if (id !== 'a' && id !== 'b' && id !== 'c' && id !== 'd') continue
            const modelKey = typeof obj['modelKey'] === 'string' ? (obj['modelKey'] as string) : ''
            const version = normalizeVersion(obj['version'])
            byId.set(id, { id, modelKey, version })
          }

          testVariants.value = defaultState.testVariants.map((v) => byId.get(v.id) ?? v)
        } else {
          testVariants.value = defaultState.testVariants
        }

        // testVariantResults (prefer the v2 fields)
        const rawVariantResults = parsed.testVariantResults
        let variantResultsLoaded: TestVariantResults | null = null
        if (rawVariantResults && typeof rawVariantResults === 'object') {
          const record = rawVariantResults as Record<string, unknown>
          const pick = (id: TestVariantId): ImageResult | null => {
            const one = record[id]
            if (!one) return null
            if (typeof one !== 'object') return null
            return one as ImageResult
          }
          variantResultsLoaded = {
            a: pick('a'),
            b: pick('b'),
            c: pick('c'),
            d: pick('d'),
          }
        }

        // legacy: original/optimized → A/B
        if (!variantResultsLoaded) {
          variantResultsLoaded = {
            a: (parsed.originalImageResult as ImageResult | null) ?? null,
            b: (parsed.optimizedImageResult as ImageResult | null) ?? null,
            c: null,
            d: null,
          }
        }

        const loaded: TestVariantResults = {
          a: await loadFromRef(variantResultsLoaded.a, $services.imageStorageService),
          b: await loadFromRef(variantResultsLoaded.b, $services.imageStorageService),
          c: await loadFromRef(variantResultsLoaded.c, $services.imageStorageService),
          d: await loadFromRef(variantResultsLoaded.d, $services.imageStorageService),
        }

        testVariantResults.value = loaded
        // legacy alias
        originalImageResult.value = loaded.a
        optimizedImageResult.value = loaded.b

        // lastRunFingerprint
        const rawFingerprints = parsed.testVariantLastRunFingerprint
        if (rawFingerprints && typeof rawFingerprints === 'object') {
          const fingerprintRecord = rawFingerprints as Record<string, unknown>
          const pick = (id: TestVariantId) => (typeof fingerprintRecord[id] === 'string' ? (fingerprintRecord[id] as string) : '')
          testVariantLastRunFingerprint.value = {
            a: pick('a'),
            b: pick('b'),
            c: pick('c'),
            d: pick('d'),
          }
        } else {
          testVariantLastRunFingerprint.value = defaultState.testVariantLastRunFingerprint
        }

         originalPrompt.value = typeof parsed.originalPrompt === 'string' ? parsed.originalPrompt : ''
         optimizedPrompt.value = typeof parsed.optimizedPrompt === 'string' ? parsed.optimizedPrompt : ''
         reasoning.value = typeof parsed.reasoning === 'string' ? parsed.reasoning : ''
         chainId.value = typeof parsed.chainId === 'string' ? parsed.chainId : ''
         versionId.value = typeof parsed.versionId === 'string' ? parsed.versionId : ''

          temporaryVariables.value = sanitizeVariableRecord(parsed.temporaryVariables)
          inputImageB64.value = typeof inputImageB64Loaded === 'string' ? inputImageB64Loaded : null
          inputImageId.value = typeof parsed.inputImageId === 'string' ? parsed.inputImageId : null
          inputImageMime.value = typeof parsed.inputImageMime === 'string' ? parsed.inputImageMime : ''
         evaluationResults.value = {
           ...createDefaultEvaluationResults(),
           ...(parsed.evaluationResults && typeof parsed.evaluationResults === 'object'
             ? (parsed.evaluationResults as PersistedEvaluationResults)
             : {}),
         }
         isCompareMode.value = typeof parsed.isCompareMode === 'boolean' ? parsed.isCompareMode : true
         selectedTextModelKey.value = typeof parsed.selectedTextModelKey === 'string' ? parsed.selectedTextModelKey : ''
         selectedImageModelKey.value = typeof parsed.selectedImageModelKey === 'string' ? parsed.selectedImageModelKey : ''
         selectedTemplateId.value = typeof parsed.selectedTemplateId === 'string' ? parsed.selectedTemplateId : null
          selectedIterateTemplateId.value = typeof parsed.selectedIterateTemplateId === 'string' ? parsed.selectedIterateTemplateId : null
          lastActiveAt.value = Date.now()

          // If the modelKey of a variant is empty, try filling it once with the legacy selectedImageModelKey
          const seedModelKey = selectedImageModelKey.value
          if (seedModelKey) {
            let changed = false
            const next = testVariants.value.map((v) => {
              if (v.modelKey) return v
              changed = true
              return { ...v, modelKey: seedModelKey }
            })
            if (changed) {
              testVariants.value = next
            }
          }

      }
      // else: no saved session, use the default state
    } catch (error) {
      reset()
      throw error
    }
  }

  return {
    // ========== State (returned directly; Pinia tracks reactivity automatically) ==========
    originalPrompt,
    optimizedPrompt,
    reasoning,
    chainId,
    versionId,
    temporaryVariables,
    evaluationResults,
    inputImageB64,
    inputImageId,
    inputImageMime,
    originalImageResult,
    optimizedImageResult,
    layout,
    testVariants,
    testVariantResults,
    testVariantLastRunFingerprint,
    isCompareMode,
    selectedTextModelKey,
    selectedImageModelKey,
    selectedTemplateId,
    selectedIterateTemplateId,
    lastActiveAt,

    // ========== Update methods ==========
    updatePrompt,
    updateOptimizedResult,
    updateInputImage,
    updateOriginalImageResult,
    updateOptimizedImageResult,
    setTestColumnCount,
    setMainSplitLeftPct,
    updateTestVariant,
    updateTestVariantResult,
    setTestVariantLastRunFingerprint,
    updateTextModel,
    updateImageModel,
    updateTemplate,
    updateIterateTemplate,
    toggleCompareMode,

    setTemporaryVariable,
    getTemporaryVariable,
    deleteTemporaryVariable,
    clearTemporaryVariables,

    reset,

    // ========== Persistence methods ==========
    saveSession,
    restoreSession,
  }
})

export type ImageImage2ImageSessionApi = ReturnType<typeof useImageImage2ImageSession>
