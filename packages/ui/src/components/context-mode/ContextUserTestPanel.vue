<template>
    <NFlex vertical :style="{ height: mode === 'full' ? '100%' : 'auto', gap: '12px' }">
        <TemporaryVariablesPanel
            :manager="variableManager"
            :show-generate-values="true"
            :is-generating="isGenerating"
            @generate-values="handleGenerateValues"
        />

        <template v-if="mode === 'full'">
            <!-- Control toolbar -->
            <NCard :style="{ flexShrink: 0 }" size="small">
                <TestControlBar
                    :model-label="t('test.model')"
                    :model-name="modelName"
                    :show-compare-toggle="enableCompareMode"
                    :is-compare-mode="isCompareMode"
                    @compare-toggle="handleCompareToggle"
                    :primary-action-text="primaryActionText"
                    :primary-action-disabled="primaryActionDisabled"
                    :primary-action-loading="isTestRunning"
                    :button-size="adaptiveButtonSize"
                    @primary-action="handleTest"
                >
                    <template #model-select>
                        <slot name="model-select"></slot>
                    </template>
                    <template #secondary-controls>
                        <slot name="secondary-controls"></slot>
                    </template>
                    <template #custom-actions>
                        <slot name="custom-actions"></slot>
                    </template>
                </TestControlBar>
            </NCard>

            <!-- Test result area (tool calls not supported; only text results are shown) -->
            <TestResultSection
                :is-compare-mode="isCompareMode"
                :vertical-layout="adaptiveResultVerticalLayout"
                :show-original="isCompareMode"
                :original-result-title="t('test.originalResult')"
                :optimized-result-title="t('test.optimizedResult')"
                :single-result-title="singleResultTitle"
                :size="adaptiveButtonSize"
                :style="{ flex: 1, minHeight: 0 }"
                :show-evaluation="showEvaluation"
                :has-original-result="hasOriginalResult"
                :has-optimized-result="hasOptimizedResult"
                :is-evaluating-original="isEvaluatingOriginal"
                :is-evaluating-optimized="isEvaluatingOptimized"
                :original-score="originalScore"
                :optimized-score="optimizedScore"
                :has-original-evaluation="hasOriginalEvaluation"
                :has-optimized-evaluation="hasOptimizedEvaluation"
                :original-evaluation-result="originalEvaluationResult"
                :optimized-evaluation-result="optimizedEvaluationResult"
                :original-score-level="originalScoreLevel"
                :optimized-score-level="optimizedScoreLevel"
                @evaluate-original="emit('evaluate-original')"
                @evaluate-optimized="emit('evaluate-optimized')"
                @evaluate-with-feedback="emit('evaluate-with-feedback', $event)"
                @show-original-detail="emit('show-original-detail')"
                @show-optimized-detail="emit('show-optimized-detail')"
                @apply-improvement="emit('apply-improvement', $event)"
            >
                <!-- Compare mode: original result -->
                <template #original-result>
                    <slot name="original-result"></slot>
                </template>

                <!-- Compare mode: optimized result -->
                <template #optimized-result>
                    <slot name="optimized-result"></slot>
                </template>

                <!-- Single result mode -->
                <template #single-result>
                    <slot name="single-result"></slot>
                </template>
            </TestResultSection>
        </template>

        <!-- Variable value preview dialog -->
        <VariableValuePreviewDialog
            v-model:show="showPreviewDialog"
            :result="generationResult"
            @confirm="confirmBatchApply"
        />
    </NFlex>
</template>

<script setup lang="ts">
import { computed, onUnmounted, toRef } from 'vue'

import { useI18n } from "vue-i18n";
import {
    NFlex,
    NCard,
} from "naive-ui";
import { useResponsive } from '../../composables/ui/useResponsive';
import { usePerformanceMonitor } from "../../composables/performance/usePerformanceMonitor";
import { useDebounceThrottle } from "../../composables/performance/useDebounceThrottle";
import { useTestVariableManager } from "../../composables/variable/useTestVariableManager";
import { useSmartVariableValueGeneration } from "../../composables/variable/useSmartVariableValueGeneration";
import TestControlBar from "../TestControlBar.vue";
import TestResultSection from "../TestResultSection.vue";
import TemporaryVariablesPanel from "../variable/TemporaryVariablesPanel.vue";
import VariableValuePreviewDialog from "../variable/VariableValuePreviewDialog.vue";
import type { EvaluationResponse, EvaluationType } from '@prompt-optimizer/core';
import type { ScoreLevel } from '../../composables/prompt/useEvaluation';
import type { AppServices } from '../../types/services';

const { t } = useI18n();

// Performance monitoring
const { recordUpdate, getPerformanceReport } = usePerformanceMonitor("ContextUserTestPanel");

// Debounce/throttle
const { debounce, throttle } = useDebounceThrottle();

// Responsive config
const {
    shouldUseVerticalLayout,
    buttonSize,
} = useResponsive();

interface Props {
    /**
     * Render mode:
     * - full: variable form + test control bar + result area (historical behavior)
     * - variables-only: variable form only (for the Workspace to render the multi-column variants test area itself)
     */
    mode?: "full" | "variables-only";

    // Original prompt (fallback, used when optimizedPrompt is empty)
    prompt?: string;
    // Optimized prompt (preferred)
    optimizedPrompt?: string;

    // Test state
    isTestRunning?: boolean;
    isCompareMode?: boolean;
    enableCompareMode?: boolean;

    // Model info (used for the display label)
    modelName?: string;
    // 🆕 Evaluation model (used for variable extraction and variable value generation)
    evaluationModelKey?: string;

    // Variable management (three layers)
    globalVariables?: Record<string, string>;
    predefinedVariables?: Record<string, string>;
    temporaryVariables?: Record<string, string>;

    // 🆕 App services
    services?: AppServices | null;

    // Layout config
    buttonSize?: "small" | "medium" | "large";
    resultVerticalLayout?: boolean;

    // Result display config
    singleResultTitle?: string;

    // 🆕 Evaluation feature config
    showEvaluation?: boolean;
    // Whether there are test results (used to show the evaluate button)
    hasOriginalResult?: boolean;
    hasOptimizedResult?: boolean;
    // Evaluation state
    isEvaluatingOriginal?: boolean;
    isEvaluatingOptimized?: boolean;
    // Evaluation score
    originalScore?: number | null;
    optimizedScore?: number | null;
    // Whether there are evaluation results
    hasOriginalEvaluation?: boolean;
    hasOptimizedEvaluation?: boolean;
    // Evaluation results and grades (used for the hover preview)
    originalEvaluationResult?: EvaluationResponse | null;
    optimizedEvaluationResult?: EvaluationResponse | null;
    originalScoreLevel?: ScoreLevel | null;
    optimizedScoreLevel?: ScoreLevel | null;
}

const props = withDefaults(defineProps<Props>(), {
    mode: "full",
    prompt: "",
    optimizedPrompt: "",
    isTestRunning: false,
    isCompareMode: false,
    enableCompareMode: true,
    buttonSize: "medium",
    resultVerticalLayout: false,
    singleResultTitle: "",
    evaluationModelKey: "",
    globalVariables: () => ({}),
    predefinedVariables: () => ({}),
    temporaryVariables: () => ({}),
    services: null,
    // Evaluation defaults
    showEvaluation: false,
    hasOriginalResult: false,
    hasOptimizedResult: false,
    isEvaluatingOriginal: false,
    isEvaluatingOptimized: false,
    originalScore: null,
    optimizedScore: null,
    hasOriginalEvaluation: false,
    hasOptimizedEvaluation: false,
    originalEvaluationResult: null,
    optimizedEvaluationResult: null,
    originalScoreLevel: null,
    optimizedScoreLevel: null,
});

const emit = defineEmits<{
    "update:isCompareMode": [value: boolean];
    test: [testVariables: Record<string, string>];
    "compare-toggle": [];
    "open-variable-manager": [];
    "variable-change": [name: string, value: string];
    "save-to-global": [name: string, value: string];
    "temporary-variable-remove": [name: string];
    "temporary-variables-clear": [];
    // 🆕 Evaluation-related events
    "evaluate-original": [];
    "evaluate-optimized": [];
    "evaluate-with-feedback": [payload: { type: EvaluationType; feedback: string }];
    "show-original-detail": [];
    "show-optimized-detail": [];
    "apply-improvement": [payload: { improvement: string; type: EvaluationType }];
}>();

// Handle the compare mode toggle
const handleCompareToggle = () => {
    emit("update:isCompareMode", !props.isCompareMode);
    emit("compare-toggle");
    recordUpdate();
};

// Responsive layout config
const adaptiveButtonSize = computed(() => {
    return buttonSize.value;
});

const adaptiveResultVerticalLayout = computed(() => {
    return shouldUseVerticalLayout.value || props.resultVerticalLayout;
});

// Primary action button text
const primaryActionText = computed(() => {
    if (props.isTestRunning) {
        return t("test.testing");
    }
    return props.isCompareMode
        ? t("test.startCompare")
        : t("test.startTest");
});

// Primary action button disabled state
const primaryActionDisabled = computed(() => {
    return props.isTestRunning;
});

const handleTest = throttle(
    () => {
        // Get and pass the test variables
        const testVars = getVariableValues();
        emit("test", testVars);
        recordUpdate();
    },
    200,
    "handleTest",
);

// ========== Variable management ==========

const variableManager = useTestVariableManager({
    globalVariables: toRef(props, 'globalVariables'),
    predefinedVariables: toRef(props, 'predefinedVariables'),
    temporaryVariables: toRef(props, 'temporaryVariables'),
    onVariableChange: (name, value) => {
        emit('variable-change', name, value);
        recordUpdate();
    },
    onSaveToGlobal: (name, value) => {
        emit('save-to-global', name, value);
        recordUpdate();
    },
    onVariableRemove: (name) => {
        emit('temporary-variable-remove', name);
        recordUpdate();
    },
    onVariablesClear: () => {
        emit('temporary-variables-clear');
        recordUpdate();
    },
});

const {
    sortedVariables: displayVariables,
    getVariableSource,
    getVariableDisplayValue,
    handleVariableValueChange,
    getVariableValues,
    setVariableValues,
} = variableManager;

// ========== Variable value generation ==========

const {
    isGenerating,
    generationResult,
    showPreviewDialog,
    handleGenerateValues,
    confirmBatchApply,
} = useSmartVariableValueGeneration({
    services: toRef(props, 'services'),
    promptContent: computed(() => props.optimizedPrompt || props.prompt),
    variableNames: displayVariables,
    getVariableValue: (name: string) => getVariableDisplayValue(name),
    getVariableSource: (name: string) => getVariableSource(name),
    applyValue: (name: string, value: string) => {
        handleVariableValueChange(name, value)
    },
    evaluationModelKey: computed(() => props.evaluationModelKey || ''),
})

// Performance debugging in the development environment
if (import.meta.env.DEV) {
    const logPerformance = debounce(
        () => {
            const report = getPerformanceReport();
            if (report.grade.grade === "F") {
                console.warn("ContextUserTestPanel performance is poor:", report);
            }
        },
        5000,
        false,
        "performanceLog",
    );

    const timer = setInterval(logPerformance, 10000);
    onUnmounted(() => clearInterval(timer));
}

// Expose methods for the parent component to call (compatible with the TestAreaPanelInstance interface)
defineExpose({
    // ContextUser does not support tool calls; provide an empty implementation
    clearToolCalls: () => {},
    handleToolCall: () => {},
    getToolCalls: () => ({ original: [], optimized: [] }),

    // Variable management
    getVariableValues,
    setVariableValues,

    // Preview feature placeholder (compatibility interface)
    showPreview: () => {},
    hidePreview: () => {},
});
</script>

<style scoped>
/* ContextUser does not need tool-call-related styles */
</style>
