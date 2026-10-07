<template>
    <NFlex vertical :style="{ height: '100%', gap: '12px' }">
        <!-- Test input area (only shown in system prompt optimization mode) -->
        <NCard v-if="showTestInput" :style="{ flexShrink: 0 }" size="small">
            <TestInputSection
                v-model="testContentProxy"
                :label="t('test.content')"
                :placeholder="t('test.placeholder')"
                :help-text="t('test.simpleMode.help')"
                :disabled="isTestRunning"
                :mode="adaptiveInputMode"
                :size="inputSize"
                :enable-fullscreen="enableFullscreen"
                :test-id="props.testIdPrefix ? `${props.testIdPrefix}-test-input` : undefined"
            />
        </NCard>

        <!-- Control toolbar -->
        <NCard :style="{ flexShrink: 0 }" size="small">
            <TestControlBar
                :model-label="t('test.model')"
                :model-name="props.modelName"
                :show-compare-toggle="enableCompareMode"
                :is-compare-mode="props.isCompareMode"
                :primary-action-text="primaryActionText"
                :primary-action-disabled="primaryActionDisabled"
                :primary-action-loading="isTestRunning"
                :button-size="adaptiveButtonSize"
                :compare-toggle-test-id="props.testIdPrefix ? `${props.testIdPrefix}-test-compare-toggle` : undefined"
                :primary-action-test-id="props.testIdPrefix ? `${props.testIdPrefix}-test-run` : undefined"
                @compare-toggle="handleCompareToggle"
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

        <!-- Test result area -->
        <TestResultSection
            :is-compare-mode="props.isCompareMode && enableCompareMode"
            :vertical-layout="adaptiveResultVerticalLayout"
            :show-original="showOriginalResult"
            :original-title="originalResultTitle"
            :optimized-title="optimizedResultTitle"
            :single-result-title="singleResultTitle"
            :original-result="originalResult"
            :optimized-result="optimizedResult"
            :single-result="singleResult"
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
            @evaluate-original="handleEvaluateOriginal"
            @evaluate-optimized="handleEvaluateOptimized"
            @evaluate-with-feedback="handleEvaluateWithFeedback"
            @show-original-detail="handleShowOriginalDetail"
            @show-optimized-detail="handleShowOptimizedDetail"
            @apply-improvement="handleApplyImprovement"
            @apply-patch="handleApplyPatch"
        >
            <template #original-result>
                <div class="result-container">
                    <!-- Tool call display for the original result - moved before the body -->
                    <ToolCallDisplay
                        v-if="originalToolCalls.length > 0"
                        :tool-calls="originalToolCalls"
                        :size="
                            adaptiveButtonSize === 'large' ? 'medium' : 'small'
                        "
                        class="tool-calls-section"
                    />

                    <div class="result-body">
                        <slot name="original-result"></slot>
                    </div>
                </div>
            </template>
            <template #optimized-result>
                <div class="result-container">
                    <!-- Tool call display for the optimized result - moved before the body -->
                    <ToolCallDisplay
                        v-if="optimizedToolCalls.length > 0"
                        :tool-calls="optimizedToolCalls"
                        :size="
                            adaptiveButtonSize === 'large' ? 'medium' : 'small'
                        "
                        class="tool-calls-section"
                    />

                    <div class="result-body">
                        <slot name="optimized-result"></slot>
                    </div>
                </div>
            </template>
            <template #single-result>
                <div class="result-container">
                    <!-- Tool call display for a single result - moved before the body (uses the optimized result's data) -->
                    <ToolCallDisplay
                        v-if="optimizedToolCalls.length > 0"
                        :tool-calls="optimizedToolCalls"
                        :size="
                            adaptiveButtonSize === 'large' ? 'medium' : 'small'
                        "
                        class="tool-calls-section"
                    />

                    <div class="result-body">
                        <slot name="single-result"></slot>
                    </div>
                </div>
            </template>
        </TestResultSection>
    </NFlex>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'

import { useI18n } from "vue-i18n";
import {
    NFlex,
    NCard,
} from "naive-ui";
import type {
    OptimizationMode,
    AdvancedTestResult,
    ToolCallResult,
    ConversationMessage,
    EvaluationResponse,
    EvaluationType,
    PatchOperation,
} from "@prompt-optimizer/core";
import type { ScoreLevel } from './evaluation/types';
import { useResponsive } from '../composables/ui/useResponsive';
import { usePerformanceMonitor } from "../composables/performance/usePerformanceMonitor";
import { useDebounceThrottle } from "../composables/performance/useDebounceThrottle";
import TestInputSection from "./TestInputSection.vue";
import TestControlBar from "./TestControlBar.vue";
import TestResultSection from "./TestResultSection.vue";
import ToolCallDisplay from "./ToolCallDisplay.vue";

const { t } = useI18n();

// Performance monitoring
const {
    recordUpdate,
    getPerformanceReport,
    // performanceGrade  // Kept for performance monitoring
} = usePerformanceMonitor("TestAreaPanel");

// Debounce/throttle
const { debounce, throttle } = useDebounceThrottle();

// Responsive config
const {
    shouldUseVerticalLayout,
    shouldUseCompactMode,
    // spaceSize,  // Kept for responsive layout
    buttonSize,
    inputSize,
    // gridConfig  // Kept for grid layout
} = useResponsive();

interface Props {
    // Core state
    optimizationMode: OptimizationMode;
    isTestRunning?: boolean;

    // Test content
    testContent?: string;
    optimizedPrompt?: string; // Optimized prompt (used for variable detection)
    isCompareMode?: boolean;

    // Model info (used to display tags)
    modelName?: string;

    // Feature toggles
    enableCompareMode?: boolean;
    enableFullscreen?: boolean;

    // Layout config
    inputMode?: "compact" | "normal";
    buttonSize?: "small" | "medium" | "large";

    // Result display config
    showOriginalResult?: boolean;
    resultVerticalLayout?: boolean;
    originalResultTitle?: string;
    optimizedResultTitle?: string;
    singleResultTitle?: string;

    // Advanced feature: test result data (supports tool call display)
    originalResult?: AdvancedTestResult;
    optimizedResult?: AdvancedTestResult;
    singleResult?: AdvancedTestResult;

    // Evaluation feature config
    showEvaluation?: boolean;
    hasOriginalResult?: boolean;
    hasOptimizedResult?: boolean;
    isEvaluatingOriginal?: boolean;
    isEvaluatingOptimized?: boolean;
    originalScore?: number | null;
    optimizedScore?: number | null;
    hasOriginalEvaluation?: boolean;
    hasOptimizedEvaluation?: boolean;
    // New: evaluation results and grades, used for the hover preview
    originalEvaluationResult?: EvaluationResponse | null;
    optimizedEvaluationResult?: EvaluationResponse | null;
    originalScoreLevel?: ScoreLevel | null;
    optimizedScoreLevel?: ScoreLevel | null;

    /** E2E: stable selector prefix, e.g. "basic-system" */
    testIdPrefix?: string;
}

const props = withDefaults(defineProps<Props>(), {
    isTestRunning: false,
    testContent: "",
    isCompareMode: true,
    enableCompareMode: true,
    enableFullscreen: true,
    inputMode: "normal",
    buttonSize: "medium",
    showOriginalResult: true,
    resultVerticalLayout: false,
    originalResultTitle: "",
    optimizedResultTitle: "",
    singleResultTitle: "",
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
    testIdPrefix: undefined,
});

const emit = defineEmits<{
    "update:testContent": [value: string];
    "update:isCompareMode": [value: boolean];
    test: []; // 🆕 Pass the test variables
    "compare-toggle": [];
    // Advanced feature events
    "open-variable-manager": [];
    "open-context-editor": [];
    "context-change": [
        messages: ConversationMessage[],
        variables: Record<string, string>,
    ];
    // Tool call events
    "tool-call": [toolCall: ToolCallResult, testType: "original" | "optimized"];
    "tool-calls-updated": [
        toolCalls: ToolCallResult[],
        testType: "original" | "optimized",
    ];
    // Evaluation events
    "evaluate-original": [];
    "evaluate-optimized": [];
    "evaluate-with-feedback": [payload: { type: EvaluationType; feedback: string }];
    "show-original-detail": [];
    "show-optimized-detail": [];
    "apply-improvement": [payload: { improvement: string; type: EvaluationType }];
    "apply-patch": [payload: { operation: PatchOperation }];
}>();

// Internal state management - debouncing removed to keep input responsive
const testContentProxy = computed({
    get: () => props.testContent,
    set: (value: string) => {
        emit("update:testContent", value);
        recordUpdate();
    },
});

// Tool call state management
const originalToolCalls = ref<ToolCallResult[]>([]);
const optimizedToolCalls = ref<ToolCallResult[]>([]);

// Method for handling tool calls
const handleToolCall = (
    toolCall: ToolCallResult,
    testType: "original" | "optimized",
) => {
    if (testType === "original") {
        originalToolCalls.value.push(toolCall);
    } else {
        optimizedToolCalls.value.push(toolCall);
    }

    emit("tool-call", toolCall, testType);
    emit(
        "tool-calls-updated",
        testType === "original"
            ? originalToolCalls.value
            : optimizedToolCalls.value,
        testType,
    );
    recordUpdate();
};

// Method for clearing tool call data
const clearToolCalls = (
    testType: "original" | "optimized" | "both" = "both",
) => {
    if (testType === "original" || testType === "both") {
        originalToolCalls.value = [];
    }
    if (testType === "optimized" || testType === "both") {
        optimizedToolCalls.value = [];
    }
};

// Removed result caching and related throttling logic to avoid unnecessary complexity

// Key computed property: showTestInput depends on the optimization mode
// Basic mode: only needs test content input when optimizing the system prompt
const showTestInput = computed(() => {
    return props.optimizationMode === "system";
});

// Responsive layout config
const adaptiveInputMode = computed(() => {
    if (shouldUseCompactMode.value) return "compact";
    return props.inputMode || "normal";
});

const adaptiveButtonSize = computed<"small" | "medium" | "large">(() => {
    return props.buttonSize || buttonSize.value;
});

const adaptiveResultVerticalLayout = computed(() => {
    return shouldUseVerticalLayout.value || props.resultVerticalLayout;
});

// Primary action button text
const primaryActionText = computed(() => {
    if (props.isTestRunning) {
        return t("test.testing");
    }
    return props.isCompareMode && props.enableCompareMode
        ? t("test.startCompare")
        : t("test.startTest");
});

// Primary action button disabled state
const primaryActionDisabled = computed(() => {
    if (props.isTestRunning) return true;

    // System prompt mode requires test content
    if (props.optimizationMode === "system" && !props.testContent.trim()) {
        return true;
    }

    return false;
});

// Event handling - switch the compare mode immediately to avoid click delay
const handleCompareToggle = () => {
    const newValue = !props.isCompareMode;
    emit("update:isCompareMode", newValue);
    emit("compare-toggle");
    recordUpdate();
};

const handleTest = throttle(
    () => {
        emit("test");
        recordUpdate();
    },
    200,
    "handleTest",
);

// ========== Evaluation event handling ==========
const handleEvaluateOriginal = () => {
    emit("evaluate-original");
};

const handleEvaluateOptimized = () => {
    emit("evaluate-optimized");
};

const handleEvaluateWithFeedback = (payload: { type: EvaluationType; feedback: string }) => {
    emit("evaluate-with-feedback", payload);
};

const handleShowOriginalDetail = () => {
    emit("show-original-detail");
};

const handleShowOptimizedDetail = () => {
    emit("show-optimized-detail");
};

// Apply improvement suggestions handling
const handleApplyImprovement = (payload: { improvement: string; type: EvaluationType }) => {
    emit("apply-improvement", payload);
};

// Apply patch handling
const handleApplyPatch = (payload: { operation: PatchOperation }) => {
    emit("apply-patch", payload);
};

// ========== Variable management ==========

// 🆕 Add variable dialog state






// Performance debugging in the development environment
if (import.meta.env.DEV) {
    const logPerformance = debounce(
        () => {
            const report = getPerformanceReport();
            if (report.grade.grade === "F") {
                console.warn("TestAreaPanel performance is poor:", report);
            }
        },
        5000,
        false,
        "performanceLog",
    );

    // Check performance periodically
    const timer = setInterval(logPerformance, 10000);
    onUnmounted(() => clearInterval(timer));
}

// Expose methods for the parent component to call
defineExpose({
    handleToolCall,
    clearToolCalls,
    // Get the current tool call state
    getToolCalls: () => ({
        original: originalToolCalls.value,
        optimized: optimizedToolCalls.value,
    }),

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

/* When a tool call list exists, hide the empty placeholder in the result area */
/* Relies on a sibling container with .tool-call-display to hide Naive UI's NEmpty */
.result-container:has(.tool-call-display) :deep(.n-empty) {
    display: none;
}
</style>
