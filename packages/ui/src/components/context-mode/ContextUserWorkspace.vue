<template>
    <!--
        Context mode - user prompt workspace

        Responsibilities:
        - Left: user prompt input + optimization result display
        - Right: test area (variable input + test execution)

        Differences from system mode:
        - No conversation manager (ConversationManager)
        - Only optimizes a single user message, with no need to manage multi-turn conversation context
        - Includes a tool management button (system mode does not)
    -->
    <div class="context-user-workspace" data-testid="workspace" data-mode="pro-variable">
        <div
            ref="splitRootRef"
            class="context-user-split"
            :style="{ gridTemplateColumns: `${mainSplitLeftPct}% 12px 1fr` }"
        >
            <!-- Left: optimization area -->
            <div class="split-pane" style="min-width: 0; height: 100%; overflow: hidden;">
                <NFlex
                    vertical
                    :size="12"
                    :style="{ overflow: 'auto', height: '100%', minHeight: 0 }"
                >
            <!-- Prompt input panel (collapsible) -->
            <NCard style="flex-shrink: 0;">
                <!-- Collapsed state: only show the title bar -->
                <NFlex
                    v-if="isInputPanelCollapsed"
                    justify="space-between"
                    align="center"
                >
                    <NFlex align="center" :size="8">
                        <NText :depth="1" style="font-size: 18px; font-weight: 500">
                            {{ t('promptOptimizer.originalPrompt') }}
                        </NText>
                        <NText
                            v-if="contextUserOptimization.prompt"
                            depth="3"
                            style="font-size: 12px;"
                        >
                            {{ promptSummary }}
                        </NText>
                    </NFlex>
                    <NButton
                        type="tertiary"
                        size="small"
                        ghost
                        round
                        @click="isInputPanelCollapsed = false"
                        :title="t('common.expand')"
                    >
                        <template #icon>
                            <NIcon>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </NIcon>
                        </template>
                    </NButton>
                </NFlex>

                <!-- Expanded state: full input panel -->
                <InputPanelUI
                    v-else
                    test-id-prefix="pro-variable"
                    v-model="contextUserOptimization.prompt"
                    :selected-model="selectedOptimizeModelKeyModel"
                    :label="t('promptOptimizer.originalPrompt')"
                    :placeholder="t('promptOptimizer.userPromptPlaceholder')"
                    :help-text="variableGuideInlineHint"
                    :model-label="t('promptOptimizer.optimizeModel')"
                    :template-label="t('promptOptimizer.templateLabel')"
                    :button-text="t('promptOptimizer.optimize')"
                    :loading-text="t('common.loading')"
                    :loading="contextUserOptimization.isOptimizing"
                    :disabled="contextUserOptimization.isOptimizing"
                     :show-preview="true"
                     :show-analyze-button="true"
                     :analyze-loading="isAnalyzing"
                      @submit="handleOptimize"
                      @analyze="handleAnalyze"
                      @configModel="handleOpenModelManager"
                      @open-preview="handleOpenInputPreview"
                      :enable-variable-extraction="true"
                     :show-extract-button="true"
                     :extracting="props.isExtracting"
                     v-bind="inputPanelVariableData || {}"
                     @extract-variables="handleExtractVariables"
                    @variable-extracted="handleVariableExtracted"
                    @add-missing-variable="handleAddMissingVariable"
                >
                    <!-- Model selection slot -->
                    <template #model-select>
                        <SelectWithConfig
                            v-model="selectedOptimizeModelKeyModel"
                            :options="modelSelection.textModelOptions.value"
                            :getPrimary="OptionAccessors.getPrimary"
                            :getSecondary="OptionAccessors.getSecondary"
                            :getValue="OptionAccessors.getValue"
                            @config="handleOpenModelManager"
                        />
                    </template>

                    <!-- Template selection slot -->
                    <template #template-select>
                        <SelectWithConfig
                            v-model="selectedTemplateIdModel"
                            :options="templateSelection.templateOptions.value"
                            :getPrimary="OptionAccessors.getPrimary"
                            :getSecondary="OptionAccessors.getSecondary"
                            :getValue="OptionAccessors.getValue"
                            @config="handleOpenTemplateManager"
                        />
                    </template>

                    <!-- Title bar collapse button -->
                    <template #header-extra>
                        <NButton
                            type="tertiary"
                            size="small"
                            ghost
                            round
                            @click="isInputPanelCollapsed = true"
                            :title="t('common.collapse')"
                        >
                            <template #icon>
                                <NIcon>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
                                    </svg>
                                </NIcon>
                            </template>
                        </NButton>
                    </template>
                </InputPanelUI>
            </NCard>

            <!--
                User mode notes:
                The conversation manager (ConversationManager) is not shown here

                Reasons:
                - User mode focuses on optimizing a single user prompt
                - It does not involve multi-turn conversation context management
                - Only system mode needs to manage multiple system/user/assistant/tool messages

                To manage complex conversation context, use system mode
            -->

            <!-- Optimization result panel -->
            <NCard
                style="flex: 1; min-height: 200px; overflow: hidden"
                content-style="height: 100%; max-height: 100%; overflow: hidden;"
            >
                <PromptPanelUI
                    test-id="pro-variable"
                    ref="promptPanelRef"
                    :optimized-prompt="contextUserOptimization.optimizedPrompt"
                    @update:optimized-prompt="contextUserOptimization.optimizedPrompt = $event"
                    :reasoning="contextUserOptimization.optimizedReasoning"
                    :original-prompt="contextUserOptimization.prompt"
                    :is-optimizing="contextUserOptimization.isOptimizing"
                    :is-iterating="contextUserOptimization.isIterating"
                    :selected-iterate-template="selectedIterateTemplate"
                    @update:selectedIterateTemplate="
                        emit('update:selectedIterateTemplate', $event)
                    "
                    :versions="contextUserOptimization.currentVersions"
                    :current-version-id="contextUserOptimization.currentVersionId"
                      :optimization-mode="optimizationMode"
                       :advanced-mode-enabled="true"
                       :show-preview="true"
                      @iterate="handleIterate"
                      @openTemplateManager="handleOpenTemplateManager"
                      @switchVersion="handleSwitchVersion"
                      @switchToV0="handleSwitchToV0"
                      @save-favorite="emit('save-favorite', $event)"
                     @open-preview="handleOpenPromptPreview"
                     @apply-improvement="handleApplyImprovement"
                     @save-local-edit="handleSaveLocalEdit"
                 />
            </NCard>
                </NFlex>
            </div>

            <div
                class="split-divider"
                role="separator"
                tabindex="0"
                :aria-valuemin="25"
                :aria-valuemax="50"
                :aria-valuenow="mainSplitLeftPct"
                @pointerdown="onSplitPointerDown"
                @keydown="onSplitKeydown"
            />

            <!-- Right: test area (shared variables + multi-column variants) -->
            <div ref="testPaneRef" class="split-pane" style="min-width: 0; height: 100%; overflow: hidden;">
                <NFlex vertical :style="{ height: '100%', gap: '12px' }">
                    <!-- Variable form (shared by all columns) -->
                    <ContextUserTestPanel
                        ref="testAreaPanelRef"
                        mode="variables-only"
                        :prompt="contextUserOptimization.prompt"
                        :optimized-prompt="contextUserOptimization.optimizedPrompt"
                        :evaluation-model-key="effectiveEvaluationModelKey"
                        :services="servicesRef"
                        :global-variables="globalVariables"
                        :predefined-variables="predefinedVariables"
                        :temporary-variables="temporaryVariables"
                        @variable-change="handleTestVariableChange"
                        @save-to-global="handleSaveToGlobalFromTest"
                        @temporary-variable-remove="handleTestVariableRemove"
                        @temporary-variables-clear="handleClearTemporaryVariables"
                    />

                    <!-- Top: column count and global actions -->
                    <NCard size="small" :style="{ flexShrink: 0 }">
                        <div class="test-area-top">
                            <NFlex align="center" :size="8" :wrap="false" style="min-width: 0;">
                                <NText :depth="2" class="test-area-label">
                                    {{ t('test.layout.columns') }}：
                                </NText>
                                <NRadioGroup
                                    v-model:value="testColumnCountModel"
                                    size="small"
                                    :disabled="isAnyVariantRunning"
                                >
                                    <NRadioButton :value="2">2</NRadioButton>
                                    <NRadioButton :value="3">3</NRadioButton>
                                    <NRadioButton :value="4" :disabled="!canUseFourColumns">4</NRadioButton>
                                </NRadioGroup>
                            </NFlex>

                            <NFlex align="center" justify="end" :size="8" :wrap="false">
                                <NButton
                                    type="primary"
                                    size="small"
                                    :loading="isAnyVariantRunning"
                                    :disabled="isAnyVariantRunning"
                                    @click="runAllVariants"
                                    :data-testid="'pro-variable-test-run-all'"
                                >
                                    {{ t('test.layout.runAll') }}
                                </NButton>

                                <template v-if="testColumnCountModel === 2 && hasVariantResult('a') && hasVariantResult('b')">
                                    <EvaluationScoreBadge
                                        v-if="hasCompareEvaluation || isEvaluatingCompare"
                                        :score="compareScore"
                                        :level="compareScoreLevel"
                                        :loading="isEvaluatingCompare"
                                        :result="compareEvaluationResult"
                                        type="compare"
                                        size="small"
                                        @show-detail="() => showDetail('compare')"
                                        @evaluate="() => handleEvaluate('compare')"
                                        @evaluate-with-feedback="handleEvaluateWithFeedback"
                                        @apply-improvement="handleApplyImprovement"
                                        @apply-patch="handleApplyLocalPatch"
                                    />
                                    <FocusAnalyzeButton
                                        v-else
                                        type="compare"
                                        :label="t('evaluation.compareEvaluate')"
                                        :loading="isEvaluatingCompare"
                                        :button-props="{ size: 'small', quaternary: true }"
                                        @evaluate="() => handleEvaluate('compare')"
                                        @evaluate-with-feedback="handleEvaluateWithFeedback"
                                    />
                                </template>
                            </NFlex>
                        </div>
                    </NCard>

                    <!-- Config area: aligned with the result columns -->
                    <NCard size="small" :style="{ flexShrink: 0 }">
                        <div class="variant-deck" :style="{ gridTemplateColumns: testGridTemplateColumns }">
                            <div v-for="id in activeVariantIds" :key="id" class="variant-cell">
                                <div class="variant-cell__controls">
                                    <NTag size="small" :bordered="false" class="variant-cell__label">
                                        {{ getVariantLabel(id) }}
                                    </NTag>
                                    <NTag
                                        v-if="isVariantStale(id)"
                                        size="small"
                                        type="warning"
                                        :bordered="false"
                                        class="variant-cell__stale"
                                    >
                                        {{ t('test.layout.stale') }}
                                    </NTag>
                                    <NSelect
                                        :value="variantVersionModels[id].value"
                                        :options="versionOptions"
                                        size="small"
                                        :disabled="variantRunning[id] || isAnyVariantRunning"
                                        :data-testid="getVariantVersionTestId(id)"
                                        @update:value="(value) => { variantVersionModels[id].value = value }"
                                        style="width: 92px"
                                    />
                                    <div class="variant-cell__model">
                                        <SelectWithConfig
                                            :data-testid="getVariantModelTestId(id)"
                                            :model-value="variantModelKeyModels[id].value"
                                            @update:model-value="(value) => { variantModelKeyModels[id].value = String(value ?? '') }"
                                            :options="modelSelection.textModelOptions.value"
                                            :getPrimary="OptionAccessors.getPrimary"
                                            :getSecondary="OptionAccessors.getSecondary"
                                            :getValue="OptionAccessors.getValue"
                                            @config="emit('config-model')"
                                            style="min-width: 0; width: 100%;"
                                        />
                                    </div>

                                    <NTooltip trigger="hover">
                                        <template #trigger>
                                            <NButton
                                                type="primary"
                                                size="small"
                                                circle
                                                :loading="variantRunning[id]"
                                                :disabled="isAnyVariantRunning && !variantRunning[id]"
                                                @click="() => runVariant(id)"
                                                :data-testid="getVariantRunTestId(id)"
                                            >
                                                <template #icon>
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                                        <path d="M8 5v14l11-7z" />
                                                    </svg>
                                                </template>
                                            </NButton>
                                        </template>
                                        {{ t('test.layout.runThisColumn') }}
                                    </NTooltip>
                                </div>
                            </div>
                        </div>
                    </NCard>

                    <!-- Result area: multi-column grid (no horizontal scrolling) -->
                    <div class="variant-results-wrap">
                        <div class="variant-results" :style="{ gridTemplateColumns: testGridTemplateColumns }">
                            <NCard
                                v-for="id in activeVariantIds"
                                :key="id"
                                size="small"
                                class="variant-result-card"
                                content-style="padding: 0; height: 100%; max-height: 100%; overflow: hidden;"
                            >
                                <OutputDisplay
                                    :test-id="getVariantOutputTestId(id)"
                                    :content="getVariantResult(id).result"
                                    :reasoning="getVariantResult(id).reasoning"
                                    :streaming="variantRunning[id]"
                                    :enableCopy="true"
                                    :enableFullscreen="true"
                                    :enableEdit="false"
                                    :enableDiff="false"
                                    :enableFavorite="false"
                                    reasoningMode="hide"
                                    mode="readonly"
                                    :style="{ height: '100%', minHeight: '0' }"
                                >
                                    <template #toolbar-right-extra>
                                        <div v-if="id === 'a' && hasVariantResult('a')" class="output-evaluation-entry">
                                            <EvaluationScoreBadge
                                                v-if="hasOriginalEvaluation || isEvaluatingOriginal"
                                                :score="originalScore"
                                                :level="originalScoreLevel"
                                                :loading="isEvaluatingOriginal"
                                                :result="originalEvaluationResult"
                                                type="original"
                                                size="small"
                                                @show-detail="() => showDetail('original')"
                                                @evaluate="() => handleEvaluate('original')"
                                                @evaluate-with-feedback="handleEvaluateWithFeedback"
                                                @apply-improvement="handleApplyImprovement"
                                                @apply-patch="handleApplyLocalPatch"
                                            />
                                            <FocusAnalyzeButton
                                                v-else
                                                type="original"
                                                :label="t('evaluation.evaluate')"
                                                :loading="isEvaluatingOriginal"
                                                :button-props="{ size: 'small', quaternary: true }"
                                                @evaluate="() => handleEvaluate('original')"
                                                @evaluate-with-feedback="handleEvaluateWithFeedback"
                                            />
                                        </div>

                                        <div v-else-if="id === 'b' && hasVariantResult('b')" class="output-evaluation-entry">
                                            <EvaluationScoreBadge
                                                v-if="hasOptimizedEvaluation || isEvaluatingOptimized"
                                                :score="optimizedScore"
                                                :level="optimizedScoreLevel"
                                                :loading="isEvaluatingOptimized"
                                                :result="optimizedEvaluationResult"
                                                type="optimized"
                                                size="small"
                                                @show-detail="() => showDetail('optimized')"
                                                @evaluate="() => handleEvaluate('optimized')"
                                                @evaluate-with-feedback="handleEvaluateWithFeedback"
                                                @apply-improvement="handleApplyImprovement"
                                                @apply-patch="handleApplyLocalPatch"
                                            />
                                            <FocusAnalyzeButton
                                                v-else
                                                type="optimized"
                                                :label="t('evaluation.evaluate')"
                                                :loading="isEvaluatingOptimized"
                                                :button-props="{ size: 'small', quaternary: true }"
                                                @evaluate="() => handleEvaluate('optimized')"
                                                @evaluate-with-feedback="handleEvaluateWithFeedback"
                                            />
                                        </div>
                                    </template>
                                </OutputDisplay>
                            </NCard>
                        </div>
                    </div>
                </NFlex>
            </div>
        </div>

        <EvaluationPanel
            v-model:show="evaluation.isPanelVisible.value"
            :is-evaluating="panelProps.isEvaluating"
            :result="panelProps.result"
            :stream-content="panelProps.streamContent"
            :error="panelProps.error"
            :current-type="panelProps.currentType"
            :score-level="panelProps.scoreLevel"
            @re-evaluate="evaluationHandler.handleReEvaluate"
            @evaluate-with-feedback="({ feedback }) => evaluationHandler.handleEvaluateActiveWithFeedback(feedback)"
            @apply-local-patch="handleApplyLocalPatch"
            @apply-improvement="handleApplyImprovement"
            @clear="handleClearEvaluation"
            @retry="evaluationHandler.handleReEvaluate"
        />

        <!-- Sub-mode local preview panel: no longer depends on the global preview state of PromptOptimizerApp -->
        <PromptPreviewPanel
            v-model:show="showPromptPreview"
            :previewContent="previewContent"
            :missingVariables="missingVariables"
            :hasMissingVariables="hasMissingVariables"
            :variableStats="variableStats"
            :contextMode="previewContextMode"
            :renderPhase="previewRenderPhase"
        />
    </div>
</template>

<script setup lang="ts">
/**
 * Context mode - user prompt workspace component
 *
 * @description
 * Workspace UI for optimizing a single user prompt, using a left-right split layout:
 * - Left: prompt input + optimization result display
 * - Right: test area (variable input + test execution)
 *
 * @features
 * - 🆕 Fully independent optimization and test logic (using dedicated composables)
 * - Supports prompt optimization and iteration
 * - Supports version management and history
 * - Supports the variable system (global variables + temporary test variables)
 * - 🆕 Supports selecting text and extracting it as a variable (exclusive to user mode)
 * - 🆕 Uses a composable to manage temporary variables, with no need to pass props
 * - Supports tool call configuration
 * - Supports responsive layout
 *
 * @example
 * ```vue
 * <ContextUserWorkspace
 *   :optimization-mode="optimizationMode"
 *   :selected-optimize-model="modelKey"
 *   :selected-template="template"
 *   :global-variables="globalVars"
 * />
 * ```
 */
import { ref, reactive, computed, inject, nextTick, watch, onMounted, onUnmounted, toRef, type Ref } from 'vue'

import { useI18n } from "vue-i18n";
import { NCard, NFlex, NText, NIcon, NButton, NSelect, NRadioGroup, NRadioButton, NTooltip, NTag } from "naive-ui";
import { useToast } from "../../composables/ui/useToast";
import InputPanelUI from "../InputPanel.vue";
import PromptPanelUI from "../PromptPanel.vue";
import PromptPreviewPanel from "../PromptPreviewPanel.vue";
import ContextUserTestPanel from "./ContextUserTestPanel.vue";
import OutputDisplay from "../OutputDisplay.vue";
import SelectWithConfig from "../SelectWithConfig.vue";
import { EvaluationPanel, EvaluationScoreBadge, FocusAnalyzeButton } from '../evaluation'
import {
    applyPatchOperationsToText,
    PREDEFINED_VARIABLES,
    type ContextMode,
    type EvaluationType,
    type OptimizationMode,
    type PatchOperation,
    type PromptRecord,
    type PromptRecordChain,
    type Template,
    type ProUserEvaluationContext,
} from "@prompt-optimizer/core";
import type { TestAreaPanelInstance } from "../types/test-area";
import type { IteratePayload, SaveFavoritePayload } from "../../types/workspace";
import type { AppServices } from '../../types/services';
import type { VariableManagerHooks } from '../../composables/prompt/useVariableManager';
import { useTemporaryVariables } from "../../composables/variable/useTemporaryVariables";
import { useLocalPromptPreviewPanel } from '../../composables/prompt/useLocalPromptPreviewPanel'
import { useVariableAwareInputBridge } from '../../composables/variable/useVariableAwareInputBridge'
import { useContextUserOptimization } from '../../composables/prompt/useContextUserOptimization';
import type { ConversationMessage } from '../../types/variable'
import { useEvaluationHandler, provideEvaluation, provideProContext } from '../../composables/prompt';
import {
    useProVariableSession,
    type TestPanelVersionValue,
    type TestVariantConfig,
    type TestVariantId,
    type TestColumnCount,
} from '../../stores/session/useProVariableSession';
import { useWorkspaceModelSelection } from '../../composables/workspaces/useWorkspaceModelSelection';
import { useWorkspaceTemplateSelection } from '../../composables/workspaces/useWorkspaceTemplateSelection';
import { OptionAccessors } from '../../utils/data-transformer';
import { useElementSize } from '@vueuse/core'
import { buildPromptExecutionContext, hashString, hashVariables } from '../../utils/prompt-variables'

// ========================
// Props definition
// ========================
interface Props {
    // --- ✅ Removed: model and template config (now read directly from the session store) ---
    // ✅ Removed: optimizationMode - changed to an internal constant

    /** Test model name (used for the display label) */
    testModelName?: string;
    /** 🆕 Evaluation model (used for variable extraction and variable value generation) */
    evaluationModelKey?: string;

    // --- Test data ---
    /** Whether compare mode is enabled */
    isCompareMode: boolean;
    /** Whether a test is running (kept for compatibility; actually managed internally) */
    isTestRunning?: boolean;
    /** 🆕 Whether AI variable extraction is running */
    isExtracting?: boolean;

    // --- Variable data ---
    /** Global variables (persisted) - kept, used for variable detection */
    globalVariables: Record<string, string>;
    /** Predefined variables (built into the system) - kept, used for variable detection */
    predefinedVariables: Record<string, string>;

    // --- Responsive layout config ---
    /** Button size */
    buttonSize?: "small" | "medium" | "large";
    /** Maximum height of the conversation history */
    conversationMaxHeight?: number;
    /** Whether the result area is laid out vertically */
    resultVerticalLayout?: boolean;
}

interface ContextUserHistoryPayload {
    record: PromptRecord;
    chain: PromptRecordChain;
    rootPrompt?: string;
}

const props = withDefaults(defineProps<Props>(), {
    testModelName: undefined,
    evaluationModelKey: undefined,
    isTestRunning: false,
    isExtracting: false,
    globalVariables: () => ({}),
    predefinedVariables: () => ({}),
    buttonSize: "medium",
    conversationMaxHeight: 300,
    resultVerticalLayout: false,
});

// ========================
// Emits definition
// ========================
const emit = defineEmits<{
    // --- Data update events ---
    "update:selectedIterateTemplate": [value: Template | null];
    "update:isCompareMode": [value: boolean];

    // --- Action events ---
    /** Toggle compare mode */
    "compare-toggle": [];
    /** Save to favorites */
    "save-favorite": [data: SaveFavoritePayload];

    // --- Open panels/managers ---
    /** Open the variable manager */
    "open-variable-manager": [];
    /** Open the template manager */
    "open-template-manager": [type?: string];
    /** Configure the model */
    "config-model": [];

    // --- Preview-related ---
    /** Open the input preview */
    "open-input-preview": [];
    /** Open the prompt preview */
    "open-prompt-preview": [];

    // --- Variable management ---
    /** Variable value change */
    "variable-change": [name: string, value: string];
    /** Save test variables to global */
    "save-to-global": [name: string, value: string];
    /** 🆕 AI variable extraction event */
    "extract-variables": [];
    /** 🆕 Variable extraction event (used to handle variables extracted from selected text) */
    "variable-extracted": [
        data: {
            variableName: string;
            variableValue: string;
            variableType: "global" | "temporary";
        },
    ];
}>();

const { t } = useI18n();
const toast = useToast();

// ========================
// Internal constants
// ========================
/** Optimization mode: fixed to 'user' (this component is dedicated to user prompt optimization) */
const optimizationMode: OptimizationMode = 'user';

// ========================
// Inject services and the variable manager
// ========================
const injectedServices = inject<Ref<AppServices | null>>('services');
const servicesRef = injectedServices ?? ref<AppServices | null>(null)
const variableManager = inject<VariableManagerHooks | null>('variableManager', null);

// Inject the App layer's unified open* interfaces (consistent with the Basic/Image workspaces)
const appOpenModelManager = inject<
    ((tab?: 'text' | 'image' | 'function') => void) | null
>('openModelManager', null)
const appOpenTemplateManager = inject<((type?: string) => void) | null>(
    'openTemplateManager',
    null,
)

const handleOpenModelManager = () => {
    if (appOpenModelManager) {
        appOpenModelManager('text')
        return
    }
    emit('config-model')
}

const handleOpenTemplateManager = (typeOrPayload?: string | Record<string, unknown>) => {
    // The @config of SelectWithConfig may pass a payload (not a string), so it is handled uniformly with a fallback here.
    const type = typeof typeOrPayload === 'string' ? typeOrPayload : undefined
    if (appOpenTemplateManager) {
        appOpenTemplateManager(type || 'optimize')
        return
    }
    emit('open-template-manager', type)
}

// ========================
// Internal state management
// ========================

// Input area collapsed state (expanded initially)
const isInputPanelCollapsed = ref(false);

// ========================
// Analysis state
// ========================
/** Whether an analysis is running */
const isAnalyzing = ref(false);

/** 🆕 Use the global temporary variable manager (variables extracted from text, valid only for the current session) */
const tempVarsManager = useTemporaryVariables();
const temporaryVariables = tempVarsManager.temporaryVariables;

// ========================
// Sub-mode local prompt preview (does not go through PromptOptimizerApp)
// ========================
const previewContextMode = computed<ContextMode>(() => 'user')

const globalVariables = computed<Record<string, string>>(
    () => variableManager?.customVariables.value || props.globalVariables || {},
)

const predefinedVariables = computed<Record<string, string>>(() => {
    const originalPrompt = (contextUserOptimization.prompt || '').trim()
    const lastOptimizedPrompt = (contextUserOptimization.optimizedPrompt || '').trim()
    const currentPrompt = (lastOptimizedPrompt || originalPrompt).trim()

    const map: Record<string, string> = {}
    PREDEFINED_VARIABLES.forEach((name) => {
        map[name] = ''
    })

    map.originalPrompt = originalPrompt
    map.lastOptimizedPrompt = lastOptimizedPrompt
    map.currentPrompt = currentPrompt
    map.userQuestion = currentPrompt

    return map
})

// Priority: global < temporary < predefined (predefined is treated as reserved/system variables)
const previewVariables = computed<Record<string, string>>(() => ({
    ...globalVariables.value,
    ...(temporaryVariables.value || {}),
    ...predefinedVariables.value,
}))

const {
    show: showPromptPreview,
    renderPhase: previewRenderPhase,
    previewContent,
    missingVariables,
    hasMissingVariables,
    variableStats,
    open: openPromptPreview,
} = useLocalPromptPreviewPanel(previewVariables, previewContextMode)

const handleOpenInputPreview = () => {
    openPromptPreview(contextUserOptimization.prompt || '', { renderPhase: 'optimize' })
}

const handleOpenPromptPreview = () => {
    openPromptPreview(contextUserOptimization.optimizedPrompt || '', { renderPhase: 'optimize' })
}

// Pro-user (variable mode) uses the session store as the single source of truth (persistable fields)
const proVariableSession = useProVariableSession();

// ==================== Main layout: draggable split pane (left 25%~50%) ====================

const splitRootRef = ref<HTMLElement | null>(null)
const testPaneRef = ref<HTMLElement | null>(null)

const clampLeftPct = (pct: number) => Math.min(50, Math.max(25, pct))

// Use a local draft to avoid frequent writes to persistent storage while dragging
const mainSplitLeftPct = ref<number>(50)
watch(
    () => proVariableSession.layout.mainSplitLeftPct,
    (pct) => {
        if (typeof pct === 'number' && Number.isFinite(pct)) {
            mainSplitLeftPct.value = clampLeftPct(Math.round(pct))
        }
    },
    { immediate: true },
)

const isDraggingSplit = ref(false)
let dragStartX = 0
let dragStartPct = 0

const handleSplitPointerMove = (e: PointerEvent) => {
    const root = splitRootRef.value
    if (!root) return
    const rect = root.getBoundingClientRect()
    if (!rect.width) return

    const deltaX = e.clientX - dragStartX
    const nextPct = dragStartPct + (deltaX / rect.width) * 100
    mainSplitLeftPct.value = clampLeftPct(nextPct)
}

const endSplitDrag = () => {
    if (!isDraggingSplit.value) return
    isDraggingSplit.value = false
    document.removeEventListener('pointermove', handleSplitPointerMove)
    document.removeEventListener('pointerup', endSplitDrag)
    document.removeEventListener('pointercancel', endSplitDrag)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''

    proVariableSession.setMainSplitLeftPct(mainSplitLeftPct.value)
}

const onSplitPointerDown = (e: PointerEvent) => {
    if (!splitRootRef.value) return
    dragStartX = e.clientX
    dragStartPct = mainSplitLeftPct.value
    isDraggingSplit.value = true
    document.addEventListener('pointermove', handleSplitPointerMove)
    document.addEventListener('pointerup', endSplitDrag)
    document.addEventListener('pointercancel', endSplitDrag)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
}

const onSplitKeydown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()

    if (e.key === 'Home') {
        mainSplitLeftPct.value = 25
    } else if (e.key === 'End') {
        mainSplitLeftPct.value = 50
    } else {
        const delta = e.key === 'ArrowLeft' ? -1 : 1
        mainSplitLeftPct.value = clampLeftPct(mainSplitLeftPct.value + delta)
    }

    proVariableSession.setMainSplitLeftPct(mainSplitLeftPct.value)
}

onUnmounted(() => {
    endSplitDrag()
})

// ✨ New: use the session store directly to manage model and template selection
const modelSelection = useWorkspaceModelSelection(servicesRef, proVariableSession)
const templateSelection = useWorkspaceTemplateSelection(
    servicesRef,
    proVariableSession,
    'contextUserOptimize',
    'contextIterate'
)

// Variable value generation uses ContextUserTestPanel and requires a model key.
// If the app-level evaluation model key isn't configured, fall back to the selected optimize model.
const effectiveEvaluationModelKey = computed(() => {
    return props.evaluationModelKey || modelSelection.selectedOptimizeModelKey.value || ''
})

const patchSessionOptimizedResult = (
    partial: Partial<{
        optimizedPrompt: string;
        reasoning: string;
        chainId: string;
        versionId: string;
    }>,
) => {
    proVariableSession.updateOptimizedResult({
        optimizedPrompt:
            partial.optimizedPrompt ??
            proVariableSession.optimizedPrompt ??
            "",
        reasoning: partial.reasoning ?? proVariableSession.reasoning ?? "",
        chainId: partial.chainId ?? proVariableSession.chainId ?? "",
        versionId: partial.versionId ?? proVariableSession.versionId ?? "",
    });
};

const sessionPrompt = computed<string>({
    get: () => proVariableSession.prompt ?? "",
    set: (value) => proVariableSession.updatePrompt(value || ""),
});

const sessionOptimizedPrompt = computed<string>({
    get: () => proVariableSession.optimizedPrompt ?? "",
    set: (value) => patchSessionOptimizedResult({ optimizedPrompt: value || "" }),
});

const sessionOptimizedReasoning = computed<string>({
    get: () => proVariableSession.reasoning ?? "",
    set: (value) => patchSessionOptimizedResult({ reasoning: value || "" }),
});

const sessionChainId = computed<string>({
    get: () => proVariableSession.chainId ?? "",
    set: (value) => patchSessionOptimizedResult({ chainId: value || "" }),
});

const sessionVersionId = computed<string>({
    get: () => proVariableSession.versionId ?? "",
    set: (value) => patchSessionOptimizedResult({ versionId: value || "" }),
});

// 🔧 Create unwrapped computed for the v-model of SelectWithConfig (avoids Vue prop type warnings)
const selectedOptimizeModelKeyModel = computed({
    get: () => modelSelection.selectedOptimizeModelKey.value,
    set: (value) => { modelSelection.selectedOptimizeModelKey.value = value }
})

const selectedTemplateIdModel = computed({
    get: () => templateSelection.selectedTemplateId.value,
    set: (value) => { templateSelection.selectedTemplateId.value = value }
})

const selectedIterateTemplate = computed<Template | null>({
    get: () => templateSelection.selectedIterateTemplate.value,
    set: (value) => {
        templateSelection.selectedIterateTemplateId.value = value?.id ?? ''
        templateSelection.selectedIterateTemplate.value = value ?? null
    }
})

// 🆕 Initialize the ContextUser-specific optimizer
const contextUserOptimization = useContextUserOptimization(
    servicesRef,
    modelSelection.selectedOptimizeModelKey,
    templateSelection.selectedTemplate,
    templateSelection.selectedIterateTemplate,
    {
        prompt: sessionPrompt as unknown as Ref<string>,
        optimizedPrompt: sessionOptimizedPrompt as unknown as Ref<string>,
        optimizedReasoning: sessionOptimizedReasoning as unknown as Ref<string>,
        currentChainId: sessionChainId as unknown as Ref<string>,
        currentVersionId: sessionVersionId as unknown as Ref<string>,
    },
);

// Prompt summary (shown in the collapsed state)
const promptSummary = computed(() => {
    const prompt = contextUserOptimization.prompt;
    if (!prompt) return '';
    return prompt.length > 50
        ? prompt.slice(0, 50) + '...'
        : prompt;
});

// ==================== Test area: multi-column variants (shared variables) ====================

const getVariant = (id: TestVariantId): TestVariantConfig | undefined => {
    const list = proVariableSession.testVariants as unknown as TestVariantConfig[]
    return Array.isArray(list) ? list.find(v => v.id === id) : undefined
}

const testColumnCountModel = computed<TestColumnCount>({
    get: () => {
        const raw = proVariableSession.layout.testColumnCount
        return raw === 2 || raw === 3 || raw === 4 ? raw : 2
    },
    set: (value) => proVariableSession.setTestColumnCount(value),
})

const variantAVersionModel = computed<TestPanelVersionValue>({
    get: () => getVariant('a')?.version ?? 0,
    set: (value) => proVariableSession.updateTestVariant('a', { version: value }),
})

const variantBVersionModel = computed<TestPanelVersionValue>({
    get: () => getVariant('b')?.version ?? 'latest',
    set: (value) => proVariableSession.updateTestVariant('b', { version: value }),
})

const variantCVersionModel = computed<TestPanelVersionValue>({
    get: () => getVariant('c')?.version ?? 'latest',
    set: (value) => proVariableSession.updateTestVariant('c', { version: value }),
})

const variantDVersionModel = computed<TestPanelVersionValue>({
    get: () => getVariant('d')?.version ?? 'latest',
    set: (value) => proVariableSession.updateTestVariant('d', { version: value }),
})

const variantAModelKeyModel = computed<string>({
    get: () => getVariant('a')?.modelKey ?? '',
    set: (value) => proVariableSession.updateTestVariant('a', { modelKey: value }),
})

const variantBModelKeyModel = computed<string>({
    get: () => getVariant('b')?.modelKey ?? '',
    set: (value) => proVariableSession.updateTestVariant('b', { modelKey: value }),
})

const variantCModelKeyModel = computed<string>({
    get: () => getVariant('c')?.modelKey ?? '',
    set: (value) => proVariableSession.updateTestVariant('c', { modelKey: value }),
})

const variantDModelKeyModel = computed<string>({
    get: () => getVariant('d')?.modelKey ?? '',
    set: (value) => proVariableSession.updateTestVariant('d', { modelKey: value }),
})

const ALL_VARIANT_IDS: TestVariantId[] = ['a', 'b', 'c', 'd']
const activeVariantIds = computed<TestVariantId[]>(() => ALL_VARIANT_IDS.slice(0, testColumnCountModel.value))

const variantVersionModels = {
    a: variantAVersionModel,
    b: variantBVersionModel,
    c: variantCVersionModel,
    d: variantDVersionModel,
} as const

const variantModelKeyModels = {
    a: variantAModelKeyModel,
    b: variantBModelKeyModel,
    c: variantCModelKeyModel,
    d: variantDModelKeyModel,
} as const

// pro-variable variable priority: global < temporary < predefined
const mergedTestVariables = computed<Record<string, string>>(() => ({
    ...(globalVariables.value || {}),
    ...(temporaryVariables.value || {}),
    ...(predefinedVariables.value || {}),
}))

// Test area width: used to disable 4 columns (avoids horizontal scrolling)
const { width: testPaneWidth } = useElementSize(testPaneRef)
const canUseFourColumns = computed(() => testPaneWidth.value >= 1000)

watch(
    canUseFourColumns,
    (ok) => {
        if (!ok && testColumnCountModel.value === 4) {
            testColumnCountModel.value = 3
        }
    },
    { immediate: true },
)

const testGridTemplateColumns = computed(() => `repeat(${testColumnCountModel.value}, minmax(0, 1fr))`)

type ResolvedTestPrompt = { text: string; resolvedVersion: number }

const resolveTestPrompt = (selection: TestPanelVersionValue): ResolvedTestPrompt => {
    const v0 = contextUserOptimization.prompt || ''
    const versions = contextUserOptimization.currentVersions || []
    const latest = versions.reduce<{ version: number; optimizedPrompt: string } | null>((acc, v) => {
        if (typeof v.version !== 'number' || v.version < 1) return acc
        const next = { version: v.version, optimizedPrompt: v.optimizedPrompt || '' }
        if (!acc || next.version > acc.version) return next
        return acc
    }, null)

    if (selection === 0) {
        return { text: v0, resolvedVersion: 0 }
    }

    if (selection === 'latest') {
        if (!latest) return { text: v0, resolvedVersion: 0 }
        return { text: latest.optimizedPrompt || '', resolvedVersion: latest.version }
    }

    const target = versions.find(v => v.version === selection)
    if (target) {
        return { text: target.optimizedPrompt || '', resolvedVersion: target.version }
    }

    if (!latest) return { text: v0, resolvedVersion: 0 }
    return { text: latest.optimizedPrompt || '', resolvedVersion: latest.version }
}

// Version options: only show "Original (v0)" and "Latest (latest)"; if intermediate versions exist, additionally show v1..v(n-1).
const versionOptions = computed(() => {
    const versions = contextUserOptimization.currentVersions || []

    const sortedVersions = versions
        .map(v => v.version)
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 1)
        .slice()
        .sort((a, b) => a - b)

    const latest = sortedVersions.length ? sortedVersions[sortedVersions.length - 1] : null
    const middle = latest ? sortedVersions.filter(v => v < latest) : []

    return [
        { label: t('test.layout.original'), value: 0 },
        ...middle.map(v => ({ label: `v${v}`, value: v })),
        { label: t('test.layout.latest'), value: 'latest' },
    ]
})

// Make sure the model selection of the test columns is always valid (automatic fallback when the model list changes)
watch(
    () => modelSelection.textModelOptions.value,
    (opts) => {
        const fallback = opts?.[0]?.value || ''
        if (!fallback) return
        const keys = new Set((opts || []).map(o => o.value))

        const seed = proVariableSession.selectedTestModelKey && keys.has(proVariableSession.selectedTestModelKey)
            ? proVariableSession.selectedTestModelKey
            : fallback

        for (const id of ALL_VARIANT_IDS) {
            const current = variantModelKeyModels[id].value
            if (!current || !keys.has(current)) {
                proVariableSession.updateTestVariant(id, { modelKey: seed })
            }
        }
    },
    { immediate: true },
)

const resolvedOriginalTestPrompt = computed(() => resolveTestPrompt(variantAVersionModel.value))
const resolvedOptimizedTestPrompt = computed(() => resolveTestPrompt(variantBVersionModel.value))

// The Pinia setup store unwraps refs automatically, so this is a directly mutable reactive object (not a Ref)
const variantResults = proVariableSession.testVariantResults
const variantLastRunFingerprint = proVariableSession.testVariantLastRunFingerprint

const variantRunning = reactive<Record<TestVariantId, boolean>>({
    a: false,
    b: false,
    c: false,
    d: false,
})

const isAnyVariantRunning = computed(() => activeVariantIds.value.some((id) => !!variantRunning[id]))

const getVariantLabel = (id: TestVariantId) => ({ a: 'A', b: 'B', c: 'C', d: 'D' }[id])

const getVariantVersionTestId = (id: TestVariantId) => {
    if (id === 'a') return 'pro-variable-test-original-version-select'
    if (id === 'b') return 'pro-variable-test-optimized-version-select'
    return `pro-variable-test-variant-${id}-version-select`
}

const getVariantModelTestId = (id: TestVariantId) => {
    if (id === 'a') return 'pro-variable-test-original-model-select'
    if (id === 'b') return 'pro-variable-test-optimized-model-select'
    return `pro-variable-test-variant-${id}-model-select`
}

const getVariantRunTestId = (id: TestVariantId) => `pro-variable-test-run-${id}`

const getVariantOutputTestId = (id: TestVariantId) => {
    if (id === 'a') return 'pro-variable-test-original-output'
    if (id === 'b') return 'pro-variable-test-optimized-output'
    return `pro-variable-test-variant-${id}-output`
}

const getVariantResult = (id: TestVariantId) => variantResults[id]
const hasVariantResult = (id: TestVariantId) => !!(variantResults[id]?.result || '').trim()

const getVariantFingerprint = (id: TestVariantId) => {
    const selection = variantVersionModels[id].value
    const resolved = resolveTestPrompt(selection)
    const modelKey = variantModelKeyModels[id].value || ''
    const promptHash = hashString((resolved.text || '').trim())
    const baseVars = variableManager?.allVariables.value || {}
    const varsForFingerprint = {
        ...baseVars,
        ...mergedTestVariables.value,
        currentPrompt: (resolved.text || '').trim(),
        userQuestion: (resolved.text || '').trim(),
    }
    const varsHash = hashVariables(varsForFingerprint)
    return `${String(selection)}:${resolved.resolvedVersion}:${modelKey}:${promptHash}:${varsHash}`
}

const isVariantStale = (id: TestVariantId) => {
    if (!hasVariantResult(id)) return false
    const prev = variantLastRunFingerprint[id]
    if (!prev) return false
    return prev !== getVariantFingerprint(id)
}

type VariantTestInput = {
    userPrompt: string
    modelKey: string
    resolvedVersion: number
}

const getVariantTestInput = (id: TestVariantId): VariantTestInput | null => {
    const modelKey = (variantModelKeyModels[id].value || '').trim()
    if (!modelKey) {
        toast.error(t('test.error.noModel'))
        return null
    }

    const resolved = resolveTestPrompt(variantVersionModels[id].value)
    const userPrompt = (resolved.text || '').trim()
    if (!userPrompt) {
        const key = resolved.resolvedVersion === 0 ? 'test.error.noOriginalPrompt' : 'test.error.noOptimizedPrompt'
        toast.error(t(key))
        return null
    }

    return { userPrompt, modelKey, resolvedVersion: resolved.resolvedVersion }
}

const runVariant = async (
    id: TestVariantId,
    opts?: {
        silentSuccess?: boolean
        silentError?: boolean
        skipClearEvaluation?: boolean
        persist?: boolean
        allowParallel?: boolean
    },
): Promise<boolean> => {
    if (variantRunning[id]) return false
    if (!opts?.allowParallel && isAnyVariantRunning.value) return false

    const promptService = servicesRef.value?.promptService
    if (!promptService) {
        toast.error(t('toast.error.serviceInit'))
        return false
    }

    const input = getVariantTestInput(id)
    if (!input) return false

    const userPrompt = input.userPrompt

    const baseVars = variableManager?.allVariables.value || {}
    const variables = {
        ...baseVars,
        ...mergedTestVariables.value,
        currentPrompt: userPrompt,
        userQuestion: userPrompt,
    }

    const ctx = buildPromptExecutionContext(userPrompt, variables)
    if (ctx.forbiddenTemplateSyntax.length > 0) {
        toast.error(t('test.error.forbiddenTemplateSyntax'))
        return false
    }
    if (ctx.missingVariables.length > 0) {
        toast.error(t('test.error.missingVariables', { vars: ctx.missingVariables.join(', ') }))
        return false
    }

    if (!opts?.skipClearEvaluation) {
        evaluationHandler.clearBeforeTest()
    }

    variantResults[id] = { result: '', reasoning: '' }
    variantRunning[id] = true

    try {
        const messages: ConversationMessage[] = [
            { role: 'user' as const, content: ctx.renderedContent },
        ]

        await promptService.testCustomConversationStream(
            {
                modelKey: input.modelKey,
                messages,
                variables,
                tools: [],
            },
            {
                onToken: (token: string) => {
                    const prev = variantResults[id]
                    variantResults[id] = { ...prev, result: (prev.result || '') + token }
                },
                onReasoningToken: (token: string) => {
                    const prev = variantResults[id]
                    variantResults[id] = { ...prev, reasoning: (prev.reasoning || '') + token }
                },
                onComplete: () => {
                    // Finalized uniformly by finally
                },
                onError: (error: Error) => {
                    throw error
                },
            },
        )

        if (!opts?.silentSuccess) {
            toast.success(t('toast.success.testComplete'))
        }
        return true
    } catch (_error) {
        if (!opts?.silentError) {
            toast.error(t('toast.error.testFailed'))
        }
        return false
    } finally {
        variantRunning[id] = false
        variantLastRunFingerprint[id] = getVariantFingerprint(id)
        if (opts?.persist !== false) {
            void proVariableSession.saveSession()
        }
    }
}

const runAllVariants = async () => {
    if (isAnyVariantRunning.value) return

    const ids = activeVariantIds.value
    for (const id of ids) {
        if (!getVariantTestInput(id)) return
    }

    evaluationHandler.clearBeforeTest()
    const results = await Promise.all(
        ids.map((id) =>
            runVariant(id, {
                silentSuccess: true,
                silentError: true,
                skipClearEvaluation: true,
                persist: false,
                allowParallel: true,
            }),
        ),
    )

    void proVariableSession.saveSession()

    if (results.every(Boolean)) {
        toast.success(t('toast.success.testComplete'))
    } else {
        toast.error(t('toast.error.testFailed'))
    }
}

// ========================
// Pro-user (variable mode) testing: changed to multi-column variants, with results and config persisted by the session store
// ========================
onMounted(() => {
    // ✅ Refresh the model list
    modelSelection.refreshTextModels()
});

const proContext = computed<ProUserEvaluationContext | undefined>(() => {
    const tempVars = temporaryVariables.value;
    const globalVars = globalVariables.value;
    const predefinedVars = predefinedVariables.value;
    const rawPrompt = resolvedOriginalTestPrompt.value.text;
    const resolvedPrompt = resolvedOptimizedTestPrompt.value.text;

    // Scan the variable names actually used in the prompts
    // Scan both the original prompt and the optimized prompt, to cover all used variables
    const usedVarNames = new Set<string>();

    // Use variableManager to scan the variables
    if (variableManager?.variableManager.value) {
        const vm = variableManager.variableManager.value;
        // Scan the variables in the original prompt
        if (rawPrompt) {
            vm.scanVariablesInContent(rawPrompt).forEach(name => usedVarNames.add(name));
        }
        // Scan the variables in the optimized prompt
        if (resolvedPrompt) {
            vm.scanVariablesInContent(resolvedPrompt).forEach(name => usedVarNames.add(name));
        }
    } else {
        // Fallback: use a regular expression to scan variables in the {{varName}} format
        // Spaces on both sides are allowed, but whitespace inside the variable name is not (Unicode variable names, such as Chinese ones, are supported)
        const varPattern = /\{\{\s*([^{}\s]+)\s*\}\}/gu;
        let match;
        if (rawPrompt) {
          while ((match = varPattern.exec(rawPrompt)) !== null) {
            const name = match[1]?.trim();
            if (name) usedVarNames.add(name);
          }
        }
        if (resolvedPrompt) {
          varPattern.lastIndex = 0; // Reset the regular expression
          while ((match = varPattern.exec(resolvedPrompt)) !== null) {
            const name = match[1]?.trim();
            if (name) usedVarNames.add(name);
          }
        }
    }

    // Only collect the variables actually used
    const usedVariables: ProUserEvaluationContext['variables'] = [];

    // Add variables in priority order (predefined > temporary > global)
    usedVarNames.forEach(name => {
        // Predefined variables have the highest priority (reserved names cannot be overridden)
        if (predefinedVars[name] !== undefined) {
            usedVariables.push({ name, value: predefinedVars[name], source: 'predefined' });
        }
        // Temporary variables next
        else if (tempVars[name] !== undefined) {
            usedVariables.push({ name, value: tempVars[name], source: 'temporary' });
        }
        // Global variables last
        else if (globalVars[name] !== undefined) {
            usedVariables.push({ name, value: globalVars[name], source: 'global' });
        }
        // When a variable is undefined, still record it, marked as a temporary variable with an empty value
        else {
            usedVariables.push({ name, value: '', source: 'temporary' });
        }
    });

    return {
        variables: usedVariables,
        rawPrompt: rawPrompt,
        resolvedPrompt: resolvedPrompt,
    };
});

// 🆕 Provide the Pro mode context to child components (such as PromptPanel), used to pass the variable resolution context during evaluation
provideProContext(proContext);

// 🆕 Test result data
const testResultsData = computed(() => ({
    originalResult: variantResults.a.result || undefined,
    optimizedResult: variantResults.b.result || undefined,
}));

// 🆕 Compute the current iteration requirement (used for the re-evaluate of prompt-iterate)
const currentIterateRequirement = computed(() => {
    const versions = contextUserOptimization.currentVersions;
    const versionId = contextUserOptimization.currentVersionId;
    if (!versions || versions.length === 0 || !versionId) return '';
    const currentVersion = versions.find((v) => v.id === versionId);
    return currentVersion?.iterationNote || '';
});

// 🆕 Initialize the evaluation handler (uses the global evaluation instance to avoid two sets of state)
const evaluationHandler = useEvaluationHandler({
    services: servicesRef,
    originalPrompt: computed(() => resolvedOriginalTestPrompt.value.text),
    optimizedPrompt: computed(() => resolvedOptimizedTestPrompt.value.text),
    testContent: computed(() => ''), // Variable mode needs no separate test content; it is managed through the variable system
    testResults: testResultsData,
    evaluationModelKey: effectiveEvaluationModelKey,
    functionMode: computed(() => 'pro'),
    subMode: computed(() => 'variable'),
    proContext,
    currentIterateRequirement,
    persistedResults: toRef(proVariableSession, 'evaluationResults'),
});

provideEvaluation(evaluationHandler.evaluation)

const { evaluation, handleEvaluate: handleEvaluateInternal } = evaluationHandler
const testAreaProps = evaluationHandler.testAreaEvaluationProps
const panelProps = evaluationHandler.panelProps

const isEvaluatingOriginal = computed(() => testAreaProps.value.isEvaluatingOriginal)
const isEvaluatingOptimized = computed(() => testAreaProps.value.isEvaluatingOptimized)
const originalScore = computed(() => testAreaProps.value.originalScore ?? 0)
const optimizedScore = computed(() => testAreaProps.value.optimizedScore ?? 0)
const hasOriginalEvaluation = computed(() => testAreaProps.value.hasOriginalEvaluation)
const hasOptimizedEvaluation = computed(() => testAreaProps.value.hasOptimizedEvaluation)
const originalEvaluationResult = computed(() => testAreaProps.value.originalEvaluationResult)
const optimizedEvaluationResult = computed(() => testAreaProps.value.optimizedEvaluationResult)
const originalScoreLevel = computed(() => testAreaProps.value.originalScoreLevel)
const optimizedScoreLevel = computed(() => testAreaProps.value.optimizedScoreLevel)

// Compare evaluation state
const isEvaluatingCompare = evaluationHandler.compareEvaluation.isEvaluatingCompare
const compareScore = computed(() => evaluationHandler.compareEvaluation.compareScore.value ?? 0)
const hasCompareEvaluation = evaluationHandler.compareEvaluation.hasCompareResult
const compareEvaluationResult = computed(() => evaluation.state['compare'].result)
const compareScoreLevel = computed(() =>
    evaluation.getScoreLevel(evaluationHandler.compareEvaluation.compareScore.value ?? null)
)

const handleEvaluate = async (type: 'original' | 'optimized' | 'compare') => {
    await handleEvaluateInternal(type)
}

const handleEvaluateWithFeedback = async (payload: {
    type: EvaluationType
    feedback: string
}) => {
    await evaluationHandler.handleEvaluateWithFeedback(payload.type, payload.feedback)
}

const showDetail = (type: 'original' | 'optimized' | 'compare') => {
    evaluation.showDetail(type)
}

const handleApplyLocalPatch = (payload: { operation: PatchOperation }) => {
    if (!payload.operation) return
    const current = contextUserOptimization.optimizedPrompt || ''
    const result = applyPatchOperationsToText(current, payload.operation)
    if (!result.ok) {
        toast.warning(t('toast.warning.patchApplyFailed'))
        return
    }

    contextUserOptimization.optimizedPrompt = result.text
    toast.success(t('evaluation.diagnose.applyFix'))
}

const handleClearEvaluation = () => {
    evaluation.closePanel()
    evaluation.clearAllResults()
}

// ========================
// Variable-aware input (InputPanel variable extraction / missing variables)
// ========================
const {
    variableInputData: inputPanelVariableData,
    handleVariableExtracted,
    handleAddMissingVariable,
} = useVariableAwareInputBridge({
    enabled: computed(() => true),
    isReady: computed(() => variableManager?.isReady.value ?? true),
    globalVariables,
    temporaryVariables: computed(() => ({ ...temporaryVariables.value })),
    predefinedVariables,
    saveGlobalVariable: (name, value) => {
        if (variableManager?.isReady.value) {
            variableManager.addVariable(name, value)
        }
        emit('save-to-global', name, value)
    },
    saveTemporaryVariable: (name, value) => tempVarsManager.setVariable(name, value),
    afterVariableExtracted: (data) => emit('variable-extracted', data),
    logPrefix: 'ContextUserWorkspace',
})

const handleSaveToGlobalFromTest = (name: string, value: string) => {
    if (variableManager?.isReady.value) {
        variableManager.addVariable(name, value)
    }
    emit('save-to-global', name, value)
}

/** Variable hint text, including a double-curly-brace example to avoid template parsing misjudgment */
const doubleBraceToken = "{{}}";
const variableGuideInlineHint = computed(() =>
    t("variableGuide.inlineHint", { doubleBraces: doubleBraceToken }),
);

// ========================
// Component references
// ========================
/** TestAreaPanel component reference, used to get the test variables */
const testAreaPanelRef = ref<TestAreaPanelInstance | null>(null);

/** PromptPanel component reference, used to open the iterate dialog */
const promptPanelRef = ref<InstanceType<typeof PromptPanelUI> | null>(null);

// ========================
// Event handling
// ========================
// handleVariableExtracted / handleAddMissingVariable are provided by useVariableAwareInputBridge

/**
 * 🆕 Handle the AI variable extraction event
 *
 * Triggered when the user clicks the "AI extract variables" button
 *
 * Workflow:
 * 1. Validate the prompt content and the model selection
 * 2. Collect the existing variable names (global + temporary)
 * 3. Trigger the extract-variables event of the parent component
 * 4. The parent component calls the AI service and shows the result dialog
 */
const handleExtractVariables = () => {
    // Trigger the parent component event; the App layer handles the AI extraction logic
    emit('extract-variables');
};

/**
 * 🆕 Sync the test area's changes to the temporary variables
 *
 * Purpose:
 * - Make sure variables added/edited in the test area take part in the missing-variable detection of the left input box
 * - Forward the event to the parent component, keeping the existing external interface unchanged
 */
const handleTestVariableChange = (name: string, value: string) => {
    // 🆕 Set the variable using the composable method
    tempVarsManager.setVariable(name, value);
    emit("variable-change", name, value);
};

/**
 * 🆕 Handling when the test area removes a temporary variable
 */
const handleTestVariableRemove = (name: string) => {
    tempVarsManager.deleteVariable(name);
    emit("variable-change", name, "");
};

/**
 * 🆕 Handling when the test area clears the temporary variables
 */
const handleClearTemporaryVariables = () => {
    // 🆕 Clear all temporary variables using the composable method
    const removedNames = Object.keys(temporaryVariables.value);
    tempVarsManager.clearAll();
    removedNames.forEach((name) => emit("variable-change", name, ""));
};

/**
 * 🆕 Handle the optimize event
 */
const handleOptimize = () => {
    if (isAnalyzing.value) return;
    contextUserOptimization.optimize();
};

/**
 * Handle the analyze action
 * - Clear the version chain and create V0 (same level as optimization)
 * - Do not write history (analysis does not produce a new prompt)
 * - Trigger the prompt-only evaluation
 */
const handleAnalyze = async () => {
    const prompt = contextUserOptimization.prompt;
    if (!prompt?.trim()) return;
    if (contextUserOptimization.isOptimizing) return;

    isAnalyzing.value = true;

    // 1. Clear the version chain and create a virtual V0
    contextUserOptimization.handleAnalyze();

    // 2. Clear the old prompt evaluation results to avoid leftovers across prompts
    evaluationHandler.evaluation.clearResult('prompt-only');
    evaluationHandler.evaluation.clearResult('prompt-iterate');

    // 3. Collapse the input area
    isInputPanelCollapsed.value = true;

    await nextTick();

    // 4. Trigger the prompt-only evaluation
    try {
        await evaluationHandler.handleEvaluate('prompt-only');
    } finally {
        isAnalyzing.value = false;
    }
};

/**
 * 🆕 Handle the iterative optimization event
 */
const handleIterate = (payload: IteratePayload) => {
    contextUserOptimization.iterate({
        originalPrompt: contextUserOptimization.prompt,
        optimizedPrompt: contextUserOptimization.optimizedPrompt,
        iterateInput: payload.iterateInput
    });
};

/**
 * 🆕 Handle the version switch event
 */
const handleSwitchVersion = (version: PromptRecord) => {
    contextUserOptimization.switchVersion(version);
};

/**
 * 🆕 Handle the V0 switch event
 */
const handleSwitchToV0 = (version: PromptRecord) => {
    contextUserOptimization.switchToV0(version);
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const isContextUserHistoryPayload = (
    value: unknown,
): value is ContextUserHistoryPayload => {
    if (!isObjectRecord(value)) return false;

    const rootPrompt = value.rootPrompt;
    const record = value.record;
    const chain = value.chain;

    if (typeof rootPrompt !== "undefined" && typeof rootPrompt !== "string") return false;
    if (!isObjectRecord(record) || typeof record.id !== "string") return false;
    if (
        !isObjectRecord(chain) ||
        typeof chain.chainId !== "string" ||
        !Array.isArray(chain.versions)
    ) {
        return false;
    }

    return true;
};

const restoreFromHistory = (payload: unknown) => {
    if (!isContextUserHistoryPayload(payload)) {
        console.warn(
            "[ContextUserWorkspace] Invalid history payload, ignored:",
            payload,
        );
        return;
    }
    contextUserOptimization.loadFromHistory(payload);
};

// 🆕 Handle the apply-improvement-suggestion event (using the factory method provided by evaluationHandler)
const handleApplyImprovement = evaluationHandler.createApplyImprovementHandler(promptPanelRef);

// Handle saving local edits
const handleSaveLocalEdit = async (payload: { note?: string }) => {
    await contextUserOptimization.saveLocalEdit({
        optimizedPrompt: contextUserOptimization.optimizedPrompt || '',
        note: payload.note,
        source: 'manual',
    });
};

// Expose the TestAreaPanel reference to the parent component (for advanced features such as tool calls)
defineExpose({
    testAreaPanelRef,
    restoreFromHistory,
    contextUserOptimization,  // 🆕 Expose the optimizer state for the parent component to access (such as AI variable extraction)
    temporaryVariables,        // 🆕 Expose the temporary variables for the parent component to access
    // 🆕 Provide a minimal usable public API so the parent does not depend on internal implementation details (no more unsafe type casting to access internal state)
    setPrompt: (prompt: string) => {
        contextUserOptimization.prompt = prompt;
    },
    getPrompt: () => contextUserOptimization.prompt || '',
    getOptimizedPrompt: () => contextUserOptimization.optimizedPrompt || '',
    getTemporaryVariableNames: () => Object.keys(temporaryVariables.value || {}),
    openIterateDialog: (initialContent?: string) => {
        promptPanelRef.value?.openIterateDialog?.(initialContent);
    },
    applyLocalPatch: (operation: PatchOperation) => {
        handleApplyLocalPatch({ operation })
    },
    reEvaluateActive: async () => {
        await evaluationHandler.handleReEvaluate();
    },
});
</script>

<style scoped>
.context-user-workspace {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

.context-user-split {
    display: grid;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
}

.split-pane {
    min-height: 0;
}

.split-divider {
    cursor: col-resize;
    background: var(--n-divider-color, rgba(0, 0, 0, 0.08));
    border-radius: 999px;
    margin: 6px 0;
    transition: background 120ms ease;
}

.split-divider:hover,
.split-divider:focus-visible {
    background: var(--n-primary-color, rgba(59, 130, 246, 0.5));
    outline: none;
}

.test-area-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
}

.test-area-label {
    white-space: nowrap;
}

.variant-deck {
    display: grid;
    gap: 12px;
    width: 100%;
}

.variant-cell {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.variant-cell__controls {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.variant-cell__label {
    flex-shrink: 0;
}

.variant-cell__stale {
    flex-shrink: 0;
}

.variant-cell__model {
    /* Keep the model selection from stretching indefinitely: stay compact to avoid scattering the right-hand buttons/layout */
    flex: 0 1 220px;
    max-width: 220px;
    min-width: 0;
}

.output-evaluation-entry {
    display: flex;
    align-items: center;
    white-space: nowrap;
}

.variant-results-wrap {
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

.variant-results {
    display: grid;
    gap: 12px;
    height: 100%;
    min-height: 0;
}

.variant-result-card {
    height: 100%;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.variant-result-card :deep(.n-card__content) {
    height: 100%;
    max-height: 100%;
    overflow: hidden;
}
</style>
