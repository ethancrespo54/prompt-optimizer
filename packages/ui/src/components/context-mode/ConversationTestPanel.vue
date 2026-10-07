<template>
    <NFlex vertical :style="{ height: mode === 'full' ? '100%' : 'auto', gap: '12px' }">
        <TemporaryVariablesPanel
            :manager="variableManager"
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

            <!-- Test result area (supports compare mode) -->
            <TestResultSection
                :is-compare-mode="isCompareMode"
                :vertical-layout="adaptiveResultVerticalLayout"
                :show-original="isCompareMode"
                :original-result-title="t('test.originalResult')"
                :optimized-result-title="t('test.optimizedResult')"
                :single-result-title="singleResultTitle"
                :original-result="originalTestResult"
                :optimized-result="optimizedTestResult"
                :single-result="testResult"
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
                <!-- 🆕 Compare mode: original result -->
                <template #original-result>
                    <div class="result-container">
                        <!-- Tool call display -->
                        <ToolCallDisplay
                            v-if="originalToolCalls.length > 0"
                            :tool-calls="originalToolCalls"
                            :size="
                                adaptiveButtonSize === 'small' ? 'small' : 'medium'
                            "
                            class="tool-calls-section"
                        />

                        <div class="result-body">
                            <slot name="original-result"></slot>
                        </div>
                    </div>
                </template>

                <!-- 🆕 Compare mode: optimized result -->
                <template #optimized-result>
                    <div class="result-container">
                        <!-- Tool call display -->
                        <ToolCallDisplay
                            v-if="optimizedToolCalls.length > 0"
                            :tool-calls="optimizedToolCalls"
                            :size="
                                adaptiveButtonSize === 'small' ? 'small' : 'medium'
                            "
                            class="tool-calls-section"
                        />

                        <div class="result-body">
                            <slot name="optimized-result"></slot>
                        </div>
                    </div>
                </template>

                <!-- Single result mode -->
                <template #single-result>
                    <div class="result-container">
                        <!-- Tool call display -->
                        <ToolCallDisplay
                            v-if="toolCalls.length > 0"
                            :tool-calls="toolCalls"
                            :size="
                                adaptiveButtonSize === 'small' ? 'small' : 'medium'
                            "
                            class="tool-calls-section"
                        />

                        <div class="result-body">
                            <slot name="single-result"></slot>
                        </div>
                    </div>
                </template>
            </TestResultSection>
        </template>
    </NFlex>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted, toRef } from 'vue'

import { useI18n } from "vue-i18n";
import {
    NFlex,
    NCard,
} from "naive-ui";
import type {
    OptimizationMode,
    AdvancedTestResult,
    ToolCallResult,
    EvaluationResponse,
    EvaluationType,
} from "@prompt-optimizer/core";
import type { ScoreLevel } from '../../composables/prompt/useEvaluation';
import { useResponsive } from '../../composables/ui/useResponsive';
import { usePerformanceMonitor } from "../../composables/performance/usePerformanceMonitor";
import { useDebounceThrottle } from "../../composables/performance/useDebounceThrottle";
import TestControlBar from "../TestControlBar.vue";
import TestResultSection from "../TestResultSection.vue";
import ToolCallDisplay from "../ToolCallDisplay.vue";
import TemporaryVariablesPanel from "../variable/TemporaryVariablesPanel.vue";
import { useTestVariableManager } from "../../composables/variable/useTestVariableManager";

const { t } = useI18n();

// Performance monitoring
const { recordUpdate, getPerformanceReport } = usePerformanceMonitor("ConversationTestPanel");

// Debounce/throttle
const { debounce, throttle } = useDebounceThrottle();

// Responsive config
const {
    shouldUseVerticalLayout,
    buttonSize: responsiveButtonSize,
} = useResponsive();

interface Props {
    /**
     * Render mode:
     * - full: variable form + test control bar + result area (historical behavior)
     * - variables-only: variable form only (for the Workspace to render the multi-column variants test area itself)
     */
    mode?: "full" | "variables-only";

    // Core state
    optimizationMode: OptimizationMode;
    isTestRunning?: boolean;

    // 🆕 Compare mode
    isCompareMode?: boolean;
    enableCompareMode?: boolean;

    // Model info (used for the display label)
    modelName?: string;

    // Variable management
    globalVariables?: Record<string, string>;
    predefinedVariables?: Record<string, string>;
    temporaryVariables?: Record<string, string>;

    // Layout config
    inputMode?: "compact" | "normal";
    buttonSize?: "small" | "medium" | "large";
    resultVerticalLayout?: boolean;

    // Result display config
    singleResultTitle?: string;

    // 🆕 Test result data (supports compare mode)
    testResult?: AdvancedTestResult;
    originalTestResult?: AdvancedTestResult;
    optimizedTestResult?: AdvancedTestResult;

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
    isTestRunning: false,
    isCompareMode: false,
    enableCompareMode: true,
    inputMode: "normal",
    buttonSize: "medium",
    resultVerticalLayout: false,
    singleResultTitle: "",
    globalVariables: () => ({}),
    predefinedVariables: () => ({}),
    temporaryVariables: () => ({}),
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
    test: [testVariables: Record<string, string>];
    "update:isCompareMode": [value: boolean];
    "compare-toggle": [];
    "open-variable-manager": [];
    "variable-change": [name: string, value: string];
    "save-to-global": [name: string, value: string];
    "tool-call": [toolCall: ToolCallResult];
    "tool-calls-updated": [toolCalls: ToolCallResult[]];
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

// 🆕 Tool call state management (supports compare mode)
const toolCalls = ref<ToolCallResult[]>([]);
const originalToolCalls = ref<ToolCallResult[]>([]);
const optimizedToolCalls = ref<ToolCallResult[]>([]);

// 🆕 Handle the compare mode toggle
const handleCompareToggle = () => {
    emit("update:isCompareMode", !props.isCompareMode);
    emit("compare-toggle");
    recordUpdate();
};

// 🆕 Method for handling tool calls (supports compare mode)
const handleToolCall = (toolCall: ToolCallResult, testType?: 'original' | 'optimized') => {
    if (props.isCompareMode && testType) {
        // Compare mode: add to the corresponding array based on testType
        if (testType === 'original') {
            originalToolCalls.value.push(toolCall);
        } else {
            optimizedToolCalls.value.push(toolCall);
        }
    } else {
        // Single mode: add to the unified array
        toolCalls.value.push(toolCall);
    }
    emit("tool-call", toolCall);
    emit("tool-calls-updated", toolCalls.value);
    recordUpdate();
};

// 🆕 Method for clearing tool call data (supports compare mode)
const clearToolCalls = (testType?: 'original' | 'optimized' | 'both') => {
    if (!testType || testType === 'both') {
        // Clear all
        toolCalls.value = [];
        originalToolCalls.value = [];
        optimizedToolCalls.value = [];
    } else if (testType === 'original') {
        originalToolCalls.value = [];
    } else if (testType === 'optimized') {
        optimizedToolCalls.value = [];
    }
};

// Responsive layout config
const adaptiveButtonSize = computed(() => {
    return props.buttonSize ?? responsiveButtonSize.value;
});

const adaptiveResultVerticalLayout = computed(() => {
    return shouldUseVerticalLayout.value || props.resultVerticalLayout;
});

// Primary action button text
const primaryActionText = computed(() => {
    if (props.isTestRunning) {
        return t("test.testing");
    }
    return t("test.startTest");
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
        emit('variable-change', name, value)
        recordUpdate()
    },
    onSaveToGlobal: (name, value) => {
        emit('save-to-global', name, value)
        recordUpdate()
    },
    onVariableRemove: (name) => {
        emit('temporary-variable-remove', name)
        recordUpdate()
    },
    onVariablesClear: () => {
        emit('temporary-variables-clear')
        recordUpdate()
    },
})

const getVariableValues = () => {
    return variableManager.getVariableValues()
}

const setVariableValues = (values: Record<string, string>) => {
    variableManager.setVariableValues(values)
}

// Performance debugging in the development environment
if (import.meta.env.DEV) {
    const logPerformance = debounce(
        () => {
            const report = getPerformanceReport();
            if (report.grade.grade === "F") {
                console.warn("ConversationTestPanel performance is poor:", report);
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
    handleToolCall,
    clearToolCalls,
    // 🆕 Tool call data supporting compare mode
    getToolCalls: () => ({
        original: props.isCompareMode ? originalToolCalls.value : [],
        optimized: props.isCompareMode ? optimizedToolCalls.value : toolCalls.value
    }),
    getVariableValues,
    setVariableValues,
    // Preview feature placeholder (compatibility interface)
    showPreview: () => {},
    hidePreview: () => {},
});
</script>

<style scoped>
.result-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
}

.result-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
}

.tool-calls-section {
    flex: 0 0 auto;
}

.result-container:has(.tool-call-display) :deep(.n-empty) {
    display: none;
}
</style>
