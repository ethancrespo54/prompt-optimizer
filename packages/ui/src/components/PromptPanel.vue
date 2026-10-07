<template>
    <NFlex
        vertical
        :style="{
            height: '100%',
            maxHeight: '100%',
            overflow: 'hidden',
        }"
    >
        <!-- Title and button area -->
        <NCard
            size="small"
            :bordered="false"
            :segmented="false"
            class="flex-none"
            content-style="padding: 0;"
            :style="{ maxHeight: '120px', overflow: 'visible' }"
        >
            <NFlex justify="space-between" align="flex-start" :wrap="false">
                <!-- Left: title and version -->
                <NSpace vertical :size="8" class="flex-1 min-w-0">
                    <NSpace align="center" :size="12">
                        <NText class="text-lg font-semibold">{{
                            t("prompt.optimized")
                        }}</NText>
                        <NSpace
                            v-if="versions && versions.length > 0"
                            :size="4"
                            class="version-tags"
                        >
                            <!-- V3, V2, V1... shown in descending order (newest version first) -->
                            <NTag
                                v-for="version in versions.slice().reverse()"
                                :key="version.id"
                                :type="
                                    currentVersionId === version.id && !isV0Selected
                                        ? 'success'
                                        : 'default'
                                "
                                size="small"
                                @click="switchVersion(version)"
                                :bordered="currentVersionId !== version.id || isV0Selected"
                            >
                                V{{ version.version }}
                            </NTag>
                            <!-- 🆕 The original version is always placed last -->
                            <NTooltip v-if="showV0Tag" trigger="hover">
                                <template #trigger>
                                    <NTag
                                        :type="isV0Selected ? 'success' : 'default'"
                                        size="small"
                                        @click="switchToV0"
                                        :bordered="!isV0Selected"
                                    >
                                        {{ t("prompt.originalVersion") }}
                                    </NTag>
                                </template>
                                {{ t("prompt.originalVersionTooltip") }}
                            </NTooltip>
                        </NSpace>
                    </NSpace>
                </NSpace>

                <!-- Right: action buttons -->
                <NSpace align="center" :size="8" class="flex-shrink-0">
                    <!-- Preview button -->
                    <NButton
                        v-if="showPreview && optimizedPrompt"
                        @click="$emit('open-preview')"
                        type="tertiary"
                        size="small"
                        ghost
                        round
                        :title="t('common.preview')"
                    >
                        <template #icon>
                            <NIcon>
                                <svg
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                            </svg>
                            </NIcon>
                        </template>
                    </NButton>
                    <!-- Apply to conversation -->
                    <NButton
                        v-if="showApplyButton && versions && versions.length > 0"
                        @click="$emit('apply-to-conversation')"
                        type="success"
                        size="small"
                        ghost
                        :disabled="isOptimizing || !currentVersionId"
                    >
                        <template #icon>
                            <NIcon>
                                <svg
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            </NIcon>
                        </template>
                        {{ t("prompt.applyToConversation") }}
                    </NButton>
                    <!-- Evaluation entry: score badge or evaluate button -->
                    <!-- prompt-only evaluation (the analysis feature) does not need optimizedPrompt -->
                    <div v-if="showEvaluation && (optimizedPrompt || evaluationType === 'prompt-only')" class="evaluation-entry">
                        <EvaluationScoreBadge
                            v-if="hasEvaluationResult || isEvaluating"
                            :score="evaluationScore"
                            :level="evaluationScoreLevel"
                            :loading="isEvaluating"
                            :result="evaluationResult"
                            :type="evaluationType"
                            size="small"
                            @show-detail="handleShowEvaluationDetail"
                            @evaluate="handleEvaluate"
                            @evaluate-with-feedback="handleEvaluateWithFeedback"
                            @apply-improvement="handleApplyImprovement"
                            @apply-patch="handleApplyPatch"
                        />
                        <FocusAnalyzeButton
                            v-else
                            :type="evaluationType"
                            :label="t('prompt.analyze')"
                            :loading="isEvaluating"
                            :button-props="{ size: 'small', type: 'tertiary' }"
                            @evaluate="handleEvaluate"
                            @evaluate-with-feedback="handleEvaluateWithFeedback"
                        >
                            <template #icon>
                                <NIcon>
                                    <svg
                                        class="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2"
                                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                                        ></path>
                                    </svg>
                                </NIcon>
                            </template>
                        </FocusAnalyzeButton>
                    </div>
                    <!-- Save local changes (after manual edits / direct fixes, saving to a history version is recommended) -->
                    <NButton
                        v-if="showSaveChanges"
                        type="default"
                        size="small"
                        class="min-w-[100px]"
                        @click="handleSaveChanges"
                    >
                        {{ t("prompt.saveChanges") }}
                    </NButton>
                    <!-- Continue optimizing button -->
                    <NButton
                        v-if="optimizedPrompt"
                        @click="handleIterate"
                        :disabled="isIterating"
                        :loading="isIterating"
                        type="primary"
                        size="small"
                        class="min-w-[100px]"
                    >
                        <template #icon>
                            <svg
                                v-if="!isIterating"
                                class="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                ></path>
                            </svg>
                        </template>
                        {{
                            isIterating
                                ? t("prompt.optimizing")
                                : t("prompt.continueOptimize")
                        }}
                    </NButton>
                </NSpace>
            </NFlex>
        </NCard>

        <!-- Content area: uses the OutputDisplay component -->
        <OutputDisplay
            :test-id="testId ? testId + '-output' : undefined"
            ref="outputDisplayRef"
            :content="optimizedPrompt"
            :original-content="previousVersionText"
            :reasoning="reasoning"
            mode="editable"
            :streaming="isOptimizing || isIterating"
            :enable-diff="true"
            :enable-copy="true"
            :enable-fullscreen="true"
            :enable-edit="true"
            :placeholder="t('prompt.optimizedPlaceholder')"
            :style="{
                height: '100%',
                maxHeight: '100%',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
            }"
            @update:content="$emit('update:optimizedPrompt', $event)"
            @save-favorite="$emit('save-favorite', $event)"
        />
    </NFlex>
    <!-- Iterative optimization dialog -->
    <Modal v-model="showIterateInput" @confirm="submitIterate">
        <template #title>
            {{ templateTitleText }}
        </template>

        <div class="space-y-4">
            <div>
                <NText class="text-sm font-medium mb-2">{{
                    templateSelectText
                }}</NText>
                <TemplateSelect
                    ref="iterateTemplateSelectRef"
                    :modelValue="selectedIterateTemplate"
                    @update:modelValue="
                        $emit('update:selectedIterateTemplate', $event)
                    "
                    :type="templateType"
                    :optimization-mode="optimizationMode"
                    @manage="$emit('openTemplateManager', templateType)"
                />
            </div>

            <div>
                <NText class="text-sm font-medium mb-2">{{
                    t("prompt.iterateDirection")
                }}</NText>
                <NInput
                    v-model:value="iterateInput"
                    type="textarea"
                    :placeholder="t('prompt.iteratePlaceholder')"
                    :rows="3"
                    :autosize="{ minRows: 3, maxRows: 6 }"
                />
            </div>
        </div>

        <template #footer>
            <NButton @click="cancelIterate" type="default" size="medium">
                {{ t("common.cancel") }}
            </NButton>
            <NButton
                @click="submitIterate"
                :disabled="!iterateInput.trim() || isIterating"
                :loading="isIterating"
                type="primary"
                size="medium"
            >
                {{
                    isIterating
                        ? t("prompt.optimizing")
                        : t("prompt.confirmOptimize")
                }}
            </NButton>
        </template>
    </Modal>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from "vue";
import { useI18n } from "vue-i18n";
import { NButton, NText, NInput, NCard, NFlex, NSpace, NTag, NIcon, NTooltip } from "naive-ui";
import { useToast } from '../composables/ui/useToast';
import { useEvaluationContextOptional } from '../composables/prompt/useEvaluationContext';
import { useProContextOptional } from '../composables/prompt/useProContext';
import TemplateSelect from "./TemplateSelect.vue";
import Modal from "./Modal.vue";
import OutputDisplay from "./OutputDisplay.vue";
import { EvaluationScoreBadge, FocusAnalyzeButton } from "./evaluation";
import type { Template, PromptRecord, EvaluationType, PatchOperation } from "@prompt-optimizer/core";

const { t } = useI18n();
const toast = useToast();

interface IteratePayload {
    originalPrompt: string;
    optimizedPrompt: string;
    iterateInput: string;
}

const props = defineProps({
    /** testId for E2E/test targeting (used for the OutputDisplay root node data-testid) */
    testId: {
        type: String,
        default: undefined,
    },
    optimizedPrompt: {
        type: String,
        default: "",
    },
    reasoning: {
        type: String,
        default: "",
    },
    isOptimizing: {
        type: Boolean,
        default: false,
    },
    isIterating: {
        type: Boolean,
        default: false,
    },
    selectedIterateTemplate: {
        type: Object as () => Template | null,
        default: null,
    },
    versions: {
        type: Array as () => PromptRecord[],
        default: () => [],
    },
    currentVersionId: {
        type: String,
        default: "",
    },
    originalPrompt: {
        type: String,
        default: "",
    },
    optimizationMode: {
        type: String as () => import("@prompt-optimizer/core").OptimizationMode,
        required: true,
    },
    advancedModeEnabled: {
        type: Boolean,
        default: false,
    },
    // 🆕 Allow the iteration template type to be specified externally (basic/context/image); the original behavior is kept by default
    iterateTemplateType: {
        type: String as () => "iterate" | "contextIterate" | "imageIterate",
        default: undefined,
    },
    // Whether to show the preview button
    showPreview: {
        type: Boolean,
        default: false,
    },
    showApplyButton: {
        type: Boolean,
        default: false,
    },
});

// Use the evaluation context (optional; the parent is not required to provide it)
const evaluation = useEvaluationContextOptional();

// Use the Pro mode context (optional; provided by the Workspace only in Pro mode)
const proContextRef = useProContextOptional();

// Get the iteration requirement of the current version (if any) - must be defined before the evaluation type is computed
const currentIterationNote = computed(() => {
    if (!props.versions || !props.currentVersionId) return "";
    const currentVersion = props.versions.find((v) => v.id === props.currentVersionId);
    return currentVersion?.iterationNote || "";
});

// Compute the evaluation-related state (taken from the context)
const showEvaluation = computed(() => !!evaluation);

// Determine the evaluation type in use: use prompt-iterate when there is an iteration requirement, otherwise prompt-only
const evaluationType = computed<'prompt-only' | 'prompt-iterate'>(() => {
    const hasIterateNote = currentIterationNote.value.trim().length > 0;
    return hasIterateNote ? 'prompt-iterate' : 'prompt-only';
});

// Get the corresponding state based on the evaluation type
const isEvaluating = computed(() => {
    if (!evaluation) return false;
    return evaluationType.value === 'prompt-iterate'
        ? evaluation.isEvaluatingPromptIterate.value
        : evaluation.isEvaluatingPromptOnly.value;
});

const evaluationScore = computed(() => {
    if (!evaluation) return null;
    return evaluationType.value === 'prompt-iterate'
        ? evaluation.promptIterateScore.value
        : evaluation.promptOnlyScore.value;
});

const evaluationScoreLevel = computed(() => {
    if (!evaluation) return null;
    return evaluationType.value === 'prompt-iterate'
        ? evaluation.promptIterateLevel.value
        : evaluation.promptOnlyLevel.value;
});

const hasEvaluationResult = computed(() => {
    if (!evaluation) return false;
    return evaluationType.value === 'prompt-iterate'
        ? evaluation.hasPromptIterateResult.value
        : evaluation.hasPromptOnlyResult.value;
});

const evaluationResult = computed(() => {
    if (!evaluation) return null;
    return evaluationType.value === 'prompt-iterate'
        ? evaluation.state['prompt-iterate'].result
        : evaluation.state['prompt-only'].result;
});

const emit = defineEmits<{
    "update:optimizedPrompt": [value: string];
    iterate: [payload: IteratePayload];
    openTemplateManager: [
        type:
            | "optimize"
            | "userOptimize"
            | "iterate"
            | "imageIterate"
            | "contextIterate",
    ];
    "update:selectedIterateTemplate": [template: Template | null];
    switchVersion: [version: PromptRecord];
    switchToV0: [version: PromptRecord];  // 🆕 Event dedicated to V0 switching
    templateSelect: [template: Template];
    "save-favorite": [data: { content: string; originalContent?: string }];
    "open-preview": [];
    "apply-to-conversation": [];
    // Evaluation-related events (evaluate and show-evaluation-detail are handled directly through the injected evaluation context)
    "apply-improvement": [payload: { improvement: string; type: EvaluationType }];
    /** Apply a patch */
    "apply-patch": [payload: { operation: PatchOperation }];
    /** Save the current edited content as a new version (does not trigger the LLM) */
    "save-local-edit": [payload: { note?: string }];
}>();

const showIterateInput = ref(false);
const iterateInput = ref("");
const templateType = computed<"iterate" | "contextIterate" | "imageIterate">(
    () => {
        return (
            (props.iterateTemplateType as
                | "iterate"
                | "contextIterate"
                | "imageIterate") ||
            (props.advancedModeEnabled ? "contextIterate" : "iterate")
        );
    },
);

const outputDisplayRef = ref<InstanceType<typeof OutputDisplay> | null>(null);
const iterateTemplateSelectRef = ref<{ refresh?: () => void } | null>(null);

// 🆕 Special V0 handling: track whether V0 is selected
const isV0Selected = ref(false);

// 🆕 Whether to show the V0 tag (only when versions exist and have original content)
const showV0Tag = computed(() => {
    if (!props.versions || props.versions.length === 0) return false;
    if (!props.versions[0]?.originalPrompt) return false;
    // If the chain itself already starts at V0 (version===0), no extra "V0 original content" tag is needed, avoiding duplication
    return !props.versions.some((v) => v.version === 0);
});

const currentVersionOptimizedPrompt = computed(() => {
    if (!props.versions || !props.currentVersionId) return "";
    return props.versions.find((v) => v.id === props.currentVersionId)?.optimizedPrompt || "";
});

const showSaveChanges = computed(() => {
    if (!props.optimizedPrompt) return false;
    if (!props.versions || props.versions.length === 0) return false;
    if (!props.currentVersionId) return false;
    if (isV0Selected.value) return false;
    return props.optimizedPrompt !== currentVersionOptimizedPrompt.value;
});

// 🆕 Switch to V0 (original content)
const switchToV0 = async () => {
    if (!props.versions || props.versions.length === 0) return;

    const v0Content = props.versions[0].originalPrompt;
    if (!v0Content) return;

    // Mark V0 as selected
    isV0Selected.value = true;

    // 🔧 Trigger the dedicated switchToV0 event so the parent component knows this is a V0 switch
    // Pass the first version object; the parent component should use originalPrompt rather than optimizedPrompt
    emit("switchToV0", props.versions[0]);

    // Update the displayed content to the original content
    emit("update:optimizedPrompt", v0Content);

    // Wait for the parent component to update the content
    await nextTick();

    // Force a refresh of the OutputDisplay content
    if (outputDisplayRef.value) {
        outputDisplayRef.value.forceRefreshContent();
    }

    console.log("[PromptPanel] Switched to V0 (original content)");
};

// Handle the evaluate button click (trigger an evaluation)
const executeEvaluate = async (userFeedback?: string, preferredType?: EvaluationType) => {
    if (!props.optimizedPrompt?.trim()) {
        toast.error(t("prompt.error.noOptimizedPrompt"));
        return;
    }

    if (!evaluation) {
        toast.error(t("evaluation.error.serviceNotReady"));
        return;
    }

    const iterateRequirement = currentIterationNote.value.trim();
    const targetType =
        preferredType === "prompt-only" || preferredType === "prompt-iterate"
            ? preferredType
            : evaluationType.value;

    // Get the Pro mode context (if available)
    const proContext = proContextRef?.value;

    if (targetType === "prompt-iterate" && iterateRequirement) {
        // When there is an iteration requirement, use prompt-iterate evaluation
        await evaluation.evaluatePromptIterate({
            originalPrompt: props.originalPrompt,
            optimizedPrompt: props.optimizedPrompt,
            iterateRequirement,
            proContext,
            userFeedback,
        });
    } else {
        // When there is no iteration requirement, use prompt-only evaluation
        await evaluation.evaluatePromptOnly({
            originalPrompt: props.originalPrompt,
            optimizedPrompt: props.optimizedPrompt,
            proContext,
            userFeedback,
        });
    }
};

// Handle the evaluate button click (trigger an evaluation)
const handleEvaluate = async () => {
    await executeEvaluate();
};

const handleEvaluateWithFeedback = async (payload: { type: EvaluationType; feedback: string }) => {
    await executeEvaluate(payload.feedback, payload.type);
};

// Handle showing the evaluation details
const handleShowEvaluationDetail = () => {
    if (!evaluation) return;
    evaluation.showDetail(evaluationType.value);
};

// Handle applying improvement suggestions (still needs emit since the parent component must open the iteration dialog)
const handleApplyImprovement = (payload: { improvement: string; type: EvaluationType }) => {
    emit("apply-improvement", payload);
};

// Handle applying a patch
const handleApplyPatch = (payload: { operation: PatchOperation }) => {
    emit("apply-patch", payload);
};

// Compute the title text
const templateTitleText = computed(() => {
    return t("prompt.iterateTitle");
});

// Compute the template selection title
const templateSelectText = computed(() => {
    return t("prompt.selectIterateTemplate");
});

// Compute the previous version's text for display
const previousVersionText = computed(() => {
    // ✅ Enhanced: make sure versions is an array (avoids type errors when props are not passed during route rendering)
    if (!Array.isArray(props.versions) || props.versions.length === 0) {
        return props.originalPrompt || "";
    }

    const currentIndex = props.versions.findIndex(
        (v) => v.id === props.currentVersionId,
    );

    if (currentIndex > 0) {
        // The current version has a previous version
        return props.versions[currentIndex - 1].optimizedPrompt;
    } else if (currentIndex === 0) {
        // The current one is V1; use the original prompt
        return props.originalPrompt || "";
    } else {
        // Current version not found; use the original prompt
        return props.originalPrompt || "";
    }
});

// Get the current version number (kept for future features)
// const getCurrentVersionNumber = () => {
//   if (!props.versions || props.versions.length === 0) return 0
//   const currentVersion = props.versions.find(v => v.id === props.currentVersionId)
//   return currentVersion ? currentVersion.version : 1
// }

const handleIterate = () => {
    showIterateInput.value = true;
};

const cancelIterate = () => {
    showIterateInput.value = false;
    iterateInput.value = "";
};

const submitIterate = () => {
    if (!iterateInput.value.trim()) return;
    if (!props.selectedIterateTemplate) {
        toast.error(t("prompt.error.noTemplate"));
        return;
    }

    emit("iterate", {
        originalPrompt: props.originalPrompt,
        optimizedPrompt: outputDisplayRef.value?.content || props.optimizedPrompt,
        iterateInput: iterateInput.value.trim(),
    });

    // Reset the input
    iterateInput.value = "";
    showIterateInput.value = false;
};

// Add the version switch function
const switchVersion = async (version: PromptRecord) => {
    if (version.id === props.currentVersionId && !isV0Selected.value) return;

    if (showSaveChanges.value) {
        const ok = window.confirm(t("prompt.unsavedChangesConfirm"));
        if (!ok) return;
    }

    // 🆕 Clear the V0 selected state
    isV0Selected.value = false;

    // Emit the version switch event
    emit("switchVersion", version);

    // Wait for the parent component to update the content
    await nextTick();

    // Force a refresh of the OutputDisplay content
    if (outputDisplayRef.value) {
        outputDisplayRef.value.forceRefreshContent();
    }

    console.log("[PromptPanel] Version switch complete, forcing a content refresh:", {
        versionId: version.id,
        version: version.version,
    });
};

const handleSaveChanges = () => {
    emit("save-local-edit", { note: t("prompt.saveChangesNote") });
};

// Watch streaming state changes and force exit from the editing state
watch(
    [() => props.isOptimizing, () => props.isIterating],
    ([newOptimizing, newIterating], [oldOptimizing, oldIterating]) => {
        // When optimization or iteration starts (false to true), force exit from the editing state
        if (
            (!oldOptimizing && newOptimizing) ||
            (!oldIterating && newIterating)
        ) {
            if (outputDisplayRef.value) {
                outputDisplayRef.value.forceExitEditing();
                console.log(
                    "[PromptPanel] Detected the start of optimization/iteration, forcing exit from the editing state",
                );
            }
        }
    },
    { immediate: false },
);

// Expose the method for refreshing the iteration template selection
const refreshIterateTemplateSelect = () => {
    if (iterateTemplateSelectRef.value?.refresh) {
        iterateTemplateSelectRef.value.refresh();
    }
};

// Open the iteration dialog and optionally prefill the text
const openIterateDialog = (input?: string) => {
    if (input) {
        iterateInput.value = input;
    }
    showIterateInput.value = true;
};

defineExpose({
    refreshIterateTemplateSelect,
    openIterateDialog,
});
</script>

<style scoped>
/* Version container styles */
.version-container {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

/* Clickable version tag styles */
.version-tag-clickable {
    cursor: pointer;
    user-select: none;
    transition: transform 0.15s ease;
}

.version-tag-clickable:hover {
    transform: translateY(-1px);
}

.version-tag-clickable:active {
    transform: translateY(0);
}

@media (max-width: 640px) {
    .version-container {
        margin-top: 4px;
    }
}

/* Evaluation entry styles */
.evaluation-entry {
    display: flex;
    align-items: center;
    flex-shrink: 0;
}
</style>
