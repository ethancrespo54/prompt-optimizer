<template>
    <div class="image-text2image-workspace" data-testid="workspace" data-mode="image-text2image">
        <div
            ref="splitRootRef"
            class="image-text2image-split"
            :style="{ gridTemplateColumns: `${mainSplitLeftPct}% 12px 1fr` }"
        >
            <!-- Left: prompt optimization area (text model) -->
            <div class="split-pane" style="min-width: 0; height: 100%; overflow: hidden;">
                <NFlex
                    vertical
                    :style="{ overflow: 'auto', height: '100%', minHeight: 0 }"
                    size="medium"
                >
            <!-- Input control area - aligned with the InputPanel layout -->
            <NCard :style="{ flexShrink: 0 }">
                <!-- Collapsed state: only show the title bar -->
                <NFlex
                    v-if="isInputPanelCollapsed"
                    justify="space-between"
                    align="center"
                >
                    <NFlex align="center" :size="8">
                        <NText :depth="1" style="font-size: 18px; font-weight: 500">
                            {{ t('imageWorkspace.input.originalPrompt') }}
                        </NText>
                        <NText
                            v-if="originalPrompt"
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
                <NSpace v-else vertical :size="16">
                    <!-- Title area -->
                    <NFlex justify="space-between" align="center" :wrap="false">
                        <NText
                            :depth="1"
                            style="font-size: 18px; font-weight: 500"
                            >{{
                                t("imageWorkspace.input.originalPrompt")
                            }}</NText
                        >
                        <NFlex align="center" :size="12">
                            <NButton
                                type="tertiary"
                                size="small"
                                @click="openFullscreen"
                                :title="t('common.expand')"
                                ghost
                                round
                            >
                                <template #icon>
                                    <NIcon>
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            stroke-width="2"
                                        >
                                            <path
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                                            />
                                        </svg>
                                    </NIcon>
                                </template>
                            </NButton>
                            <!-- Collapse button -->
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
                        </NFlex>
                    </NFlex>

                    <!-- Input box -->
                    <VariableAwareInput
                        v-if="variableInputData"
                        data-testid="image-text2image-input"
                        :model-value="originalPrompt"
                        @update:model-value="handleOriginalPromptInput"
                        :readonly="isOptimizing"
                        :placeholder="t('imageWorkspace.input.originalPromptPlaceholder')"
                        :autosize="true"
                        v-bind="variableInputData"
                        clearable
                        show-count
                        @variable-extracted="handleVariableExtracted"
                        @add-missing-variable="handleAddMissingVariable"
                    />
                    <NInput
                        v-else
                        v-model:value="originalPrompt"
                        type="textarea"
                        data-testid="image-text2image-input"
                        :placeholder="
                            t('imageWorkspace.input.originalPromptPlaceholder')
                        "
                        :rows="4"
                        :autosize="{ minRows: 4, maxRows: 12 }"
                        clearable
                        show-count
                        :disabled="isOptimizing"
                    />

                    <!-- Control panel - uses a grid layout -->
                    <NGrid :cols="24" :x-gap="8" responsive="screen">
                        <!-- Text model selection -->
                        <NGridItem :span="7" :xs="24" :sm="7">
                            <NSpace vertical :size="8">
                                <NText
                                    :depth="2"
                                    style="font-size: 14px; font-weight: 500"
                                    >{{
                                        t("imageWorkspace.input.textModel")
                                    }}</NText
                                >
                                <template v-if="appOpenModelManager">
                                    <SelectWithConfig
                                        v-model="selectedTextModelKey"
                                        :options="textModelOptions"
                                        :getPrimary="OptionAccessors.getPrimary"
                                        :getSecondary="
                                            OptionAccessors.getSecondary
                                        "
                                        :getValue="OptionAccessors.getValue"
                                        :placeholder="
                                            t(
                                                'imageWorkspace.input.modelPlaceholder',
                                            )
                                        "
                                        size="medium"
                                        :disabled="isOptimizing"
                                        filterable
                                        :show-config-action="true"
                                        :show-empty-config-c-t-a="true"
                                        @focus="handleTextModelSelectFocus"
                                        @config="
                                            () =>
                                                appOpenModelManager &&
                                                appOpenModelManager('text')
                                        "
                                    />
                                </template>
                                <template v-else>
                                    <SelectWithConfig
                                        v-model="selectedTextModelKey"
                                        :options="textModelOptions"
                                        :getPrimary="OptionAccessors.getPrimary"
                                        :getSecondary="
                                            OptionAccessors.getSecondary
                                        "
                                        :getValue="OptionAccessors.getValue"
                                        :placeholder="
                                            t(
                                                'imageWorkspace.input.modelPlaceholder',
                                            )
                                        "
                                        size="medium"
                                        :disabled="isOptimizing"
                                        filterable
                                        @focus="handleTextModelSelectFocus"
                                    />
                                </template>
                            </NSpace>
                        </NGridItem>

                        <!-- Optimization template selection -->
                        <NGridItem :span="11" :xs="24" :sm="11">
                            <NSpace vertical :size="8">
                                <NText
                                    :depth="2"
                                    style="font-size: 14px; font-weight: 500"
                                    >{{
                                        t(
                                            "imageWorkspace.input.optimizeTemplate",
                                        )
                                    }}</NText
                                >
                                <template
                                    v-if="services && services.templateManager"
                                >
                                    <SelectWithConfig
                                        v-model="selectedTemplateIdForSelect"
                                        :options="templateOptions"
                                        :getPrimary="OptionAccessors.getPrimary"
                                        :getSecondary="
                                            OptionAccessors.getSecondary
                                        "
                                        :getValue="OptionAccessors.getValue"
                                        :placeholder="
                                            t(
                                                'imageWorkspace.input.templatePlaceholder',
                                            )
                                        "
                                        size="medium"
                                        :disabled="isOptimizing"
                                        filterable
                                        :show-config-action="true"
                                        :show-empty-config-c-t-a="true"
                                        @focus="handleTemplateSelectFocus"
                                        @config="
                                            () =>
                                                onOpenTemplateManager(
                                                    templateType,
                                                )
                                        "
                                    />
                                </template>
                                <NText
                                    v-else
                                    depth="3"
                                    style="padding: 0; font-size: 14px"
                                >
                                    {{ t("common.loading") }}
                                </NText>
                            </NSpace>
                        </NGridItem>

                        <!-- Analyze and optimize buttons -->
                        <NGridItem :span="6" :xs="24" :sm="6" class="flex items-end justify-end">
                            <NSpace :size="8">
                                <!-- Analyze button (same level as optimize) -->
                                <NButton
                                    type="default"
                                    size="medium"
                                    data-testid="image-text2image-analyze-button"
                                    :loading="isAnalyzing"
                                    @click="handleAnalyze"
                                    :disabled="
                                        isAnalyzing ||
                                        isOptimizing ||
                                        !originalPrompt.trim()
                                    "
                                >
                                    {{
                                        isAnalyzing
                                            ? t('promptOptimizer.analyzing')
                                            : t('promptOptimizer.analyze')
                                    }}
                                </NButton>
                                <!-- Optimize button -->
                                <NButton
                                    type="primary"
                                    size="medium"
                                    data-testid="image-text2image-optimize-button"
                                    :loading="isOptimizing"
                                    @click="handleOptimizePrompt"
                                    :disabled="
                                        isAnalyzing ||
                                        isOptimizing ||
                                        !originalPrompt.trim() ||
                                        !selectedTextModelKey ||
                                        !selectedTemplate
                                    "
                                >
                                    {{
                                        isOptimizing
                                            ? t("common.loading")
                                            : t("promptOptimizer.optimize")
                                    }}
                                </NButton>
                            </NSpace>
                        </NGridItem>
                    </NGrid>
                </NSpace>
            </NCard>

            <!-- Optimization result area - uses the same card container as basic mode -->
            <NCard
                :style="{ flex: 1, minHeight: '200px', overflow: 'hidden' }"
                content-style="height: 100%; max-height: 100%; overflow: hidden;"
            >
                <PromptPanelUI
                    v-if="services && services.templateManager"
                    test-id="image-text2image"
                    ref="promptPanelRef"
                    v-model:optimized-prompt="optimizedPrompt"
                    :reasoning="optimizedReasoning"
                    :original-prompt="originalPrompt"
                    :is-optimizing="isOptimizing"
                    :is-iterating="isIterating"
                    v-model:selected-iterate-template="selectedIterateTemplate"
                    :versions="currentVersions"
                    :current-version-id="currentVersionId"
                    :optimization-mode="optimizationMode"
                    :advanced-mode-enabled="advancedModeEnabled"
                    :show-preview="true"
                    iterate-template-type="imageIterate"
                    @iterate="handleIteratePrompt"
                    @openTemplateManager="onOpenTemplateManager"
                    @switchVersion="handleSwitchVersion"
                    @save-favorite="handleSaveFavorite"
                    @save-local-edit="handleSaveLocalEdit"
                    @open-preview="handleOpenPromptPreview"
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

            <!-- Right: image generation test area (image models, multi-column variants) -->
            <div ref="testPaneRef" class="split-pane" style="min-width: 0; height: 100%; overflow: hidden;">
                <NFlex vertical :style="{ height: '100%', gap: '12px' }">
                    <TemporaryVariablesPanel
                        :manager="temporaryVariablePanelManager"
                        :disabled="isOptimizing"
                        :show-generate-values="true"
                        :is-generating="isGenerating"
                        @generate-values="handleGenerateValues"
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
                                    :data-testid="'image-text2image-test-run-all'"
                                >
                                    {{ t('test.layout.runAll') }}
                                </NButton>
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
                                        :disabled="variantRunning[id]"
                                        :data-testid="getVariantVersionTestId(id)"
                                        @update:value="(value) => { variantVersionModels[id].value = value }"
                                        style="width: 92px"
                                    />

                                    <div class="variant-cell__model">
                                        <SelectWithConfig
                                            :data-testid="getVariantModelTestId(id)"
                                            :model-value="variantModelKeyModels[id].value"
                                            @update:model-value="(value) => { variantModelKeyModels[id].value = String(value ?? '') }"
                                            :options="imageModelOptions"
                                            :getPrimary="OptionAccessors.getPrimary"
                                            :getSecondary="OptionAccessors.getSecondary"
                                            :getValue="OptionAccessors.getValue"
                                            :placeholder="t('imageWorkspace.generation.imageModelPlaceholder')"
                                            size="small"
                                            :disabled="variantRunning[id]"
                                            filterable
                                            :show-config-action="!!appOpenModelManager"
                                            :show-empty-config-c-t-a="true"
                                            @config="() => appOpenModelManager && appOpenModelManager('image')"
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
                                                     :disabled="variantRunning[id]"
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
                                <div class="result-container">
                                    <div class="result-body">
                                        <template v-if="hasVariantResult(id)">
                                            <NSpace vertical :size="12" style="padding: 12px;">
                                                <NImage
                                                    :data-testid="getVariantImageTestId(id)"
                                                    :src="getImageSrc(getVariantResult(id)?.images?.[0])"
                                                    object-fit="contain"
                                                    :img-props="{
                                                        style: {
                                                            width: '100%',
                                                            height: 'auto',
                                                            display: 'block',
                                                        },
                                                    }"
                                                />

                                                <template v-if="getVariantResult(id)?.text">
                                                    <NCard
                                                        size="small"
                                                        :title="t('imageWorkspace.results.textOutput')"
                                                    >
                                                        <NText
                                                            :depth="2"
                                                            style="white-space: pre-wrap; line-height: 1.5;"
                                                        >
                                                            {{ getVariantResult(id)?.text }}
                                                        </NText>
                                                    </NCard>
                                                </template>

                                                <ImageTokenUsage :metadata="getVariantResult(id)?.metadata" :image="getVariantResult(id)?.images?.[0]" />

                                                <NSpace justify="center" :size="8">
                                                    <NButton
                                                        size="small"
                                                        @click="downloadImageFromResult(getVariantResult(id)?.images?.[0], `variant-${id}`)"
                                                    >
                                                        <template #icon>
                                                            <NIcon>
                                                                <svg
                                                                    xmlns="http://www.w3.org/2000/svg"
                                                                    viewBox="0 0 24 24"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    stroke-width="2"
                                                                >
                                                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                                                                </svg>
                                                            </NIcon>
                                                        </template>
                                                        {{ t('imageWorkspace.results.download') }}
                                                    </NButton>

                                                    <NButton
                                                        v-if="getVariantResult(id)?.text"
                                                        size="small"
                                                        secondary
                                                        @click="copyImageText(String(getVariantResult(id)?.text || ''))"
                                                    >
                                                        <template #icon>
                                                            <NIcon>
                                                                <svg
                                                                    xmlns="http://www.w3.org/2000/svg"
                                                                    viewBox="0 0 24 24"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    stroke-width="2"
                                                                >
                                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                                                                </svg>
                                                            </NIcon>
                                                        </template>
                                                        {{ t('imageWorkspace.results.copyText') }}
                                                    </NButton>
                                                </NSpace>
                                            </NSpace>
                                        </template>
                                        <template v-else>
                                            <NEmpty
                                                :description="t('imageWorkspace.results.noGenerationResult')"
                                                style="padding: 24px 12px;"
                                            />
                                        </template>
                                    </div>
                                </div>
                            </NCard>
                        </div>
                    </div>
                </NFlex>
            </div>
        </div>

        <!-- Original prompt - fullscreen editor -->
        <FullscreenDialog
            v-model="isFullscreen"
            :title="t('imageWorkspace.input.originalPrompt')"
        >
            <NInput
                v-model:value="fullscreenValue"
                type="textarea"
                :placeholder="t('imageWorkspace.input.originalPromptPlaceholder')"
                :autosize="{ minRows: 20 }"
                clearable
                show-count
                :disabled="isOptimizing"
            />
        </FullscreenDialog>

        <VariableValuePreviewDialog
            v-model:show="showPreviewDialog"
            :result="generationResult"
            @confirm="confirmBatchApply"
        />

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
            @apply-local-patch="handleApplyPatch"
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

        <!-- The template manager is managed uniformly by the App and is no longer rendered here -->
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, inject, ref, reactive, computed, watch, nextTick, toRef, type Ref } from 'vue'

import {
    NCard,
    NButton,
    NInput,
    NEmpty,
    NSpace,
    NImage,
    NText,
    NFlex,
    NGrid,
    NGridItem,
    NIcon,
    NTag,
    NSelect,
    NRadioGroup,
    NRadioButton,
    NTooltip,
} from "naive-ui";
import { useI18n } from "vue-i18n";
import PromptPanelUI from "../PromptPanel.vue";
import PromptPreviewPanel from "../PromptPreviewPanel.vue";
import SelectWithConfig from "../SelectWithConfig.vue";
import { EvaluationPanel } from '../evaluation'
import { provideEvaluation } from '../../composables/prompt/useEvaluationContext';
import { useLocalPromptPreviewPanel } from '../../composables/prompt/useLocalPromptPreviewPanel'
import { OptionAccessors } from "../../utils/data-transformer";
import type { AppServices } from "../../types/services";
import { useFullscreen } from "../../composables/ui/useFullscreen";
import FullscreenDialog from "../FullscreenDialog.vue";
import type { SelectOption } from "../../types/select-options";
import { useToast } from "../../composables/ui/useToast";
import { getI18nErrorMessage } from '../../utils/error'
import { VariableAwareInput } from '../variable-extraction'
import TemporaryVariablesPanel from '../variable/TemporaryVariablesPanel.vue'
import VariableValuePreviewDialog from '../variable/VariableValuePreviewDialog.vue'
import { useTemporaryVariables } from '../../composables/variable/useTemporaryVariables'
import { useVariableAwareInputBridge } from '../../composables/variable/useVariableAwareInputBridge'
import { useTestVariableManager } from '../../composables/variable/useTestVariableManager'
import { useSmartVariableValueGeneration } from '../../composables/variable/useSmartVariableValueGeneration'
import type { VariableManagerHooks } from '../../composables/prompt/useVariableManager'
import {
    buildPromptExecutionContext,
    hashString,
    hashVariables,
} from '../../utils/prompt-variables'
import {
    useImageText2ImageSession,
    type TestColumnCount,
    type TestPanelVersionValue,
    type TestVariantConfig,
    type TestVariantId,
} from '../../stores/session/useImageText2ImageSession'
import { useImageGeneration } from '../../composables/image/useImageGeneration'
import ImageTokenUsage from './ImageTokenUsage.vue'
import { useEvaluationHandler, type TestResultsData } from '../../composables/prompt/useEvaluationHandler'
import { useWorkspaceTemplateSelection } from '../../composables/workspaces/useWorkspaceTemplateSelection'
import { useWorkspaceTextModelSelection } from '../../composables/workspaces/useWorkspaceTextModelSelection'
import { useElementSize } from '@vueuse/core'
import {
    applyPatchOperationsToText,
    type ContextMode,
    type ImageModelConfig,
    type Text2ImageRequest,
    type ImageResult,
    type ImageResultItem,
    type OptimizationMode,
    type OptimizationRequest,
    type PromptRecordChain,
    type PromptRecordType,
    type PatchOperation,
    type Template,
} from '@prompt-optimizer/core'
import { v4 as uuidv4 } from 'uuid'

// Internationalization
const { t } = useI18n();

// Toast
const toast = useToast();

// Service injection
const services = inject<Ref<AppServices | null>>("services", ref(null));

// Variable system (global variables + temporary variables)
// - Global variables are created and provided by PromptOptimizerApp
// - Temporary variables are held by the Pinia store (lost on refresh)
const variableManager = inject<VariableManagerHooks | null>('variableManager', null)
const tempVarsManager = useTemporaryVariables()

const {
    variableInputData,
    predefinedVariableValues: purePredefinedVariables,
    handleVariableExtracted,
    handleAddMissingVariable,
} = useVariableAwareInputBridge({
    enabled: computed(() => true),
    // Only enable variable-aware input when the global variable manager is ready (avoids "variables not loaded but the editor already replaces/extracts")
    isReady: computed(() => variableManager?.isReady.value ?? false),
    globalVariables: computed(() => variableManager?.customVariables.value || {}),
    temporaryVariables: tempVarsManager.temporaryVariables,
    allVariables: computed(() => variableManager?.allVariables.value || {}),
    saveGlobalVariable: (name, value) => variableManager?.addVariable(name, value),
    saveTemporaryVariable: (name, value) => tempVarsManager.setVariable(name, value),
    logPrefix: 'ImageText2ImageWorkspace',
})

const temporaryVariablePanelManager = useTestVariableManager({
    globalVariables: computed(() => variableManager?.customVariables.value || {}),
    predefinedVariables: purePredefinedVariables,
    temporaryVariables: computed(() => tempVarsManager.temporaryVariables.value),
    onVariableChange: (name, value) => {
        tempVarsManager.setVariable(name, value)
    },
    onVariableRemove: (name) => {
        tempVarsManager.deleteVariable(name)
    },
    onVariablesClear: () => {
        tempVarsManager.clearAll()
    },
    onSaveToGlobal: (name, value) => {
        if (!variableManager || !variableManager.isReady.value) {
            throw new Error('variable manager not ready')
        }
        variableManager.addVariable(name, value)
    },
})

const {
    isGenerating,
    generationResult,
    showPreviewDialog,
    handleGenerateValues,
    confirmBatchApply,
} = useSmartVariableValueGeneration({
    services,
    promptContent: computed(() => optimizedPrompt.value || originalPrompt.value),
    variableNames: computed(() => temporaryVariablePanelManager.sortedVariables.value),
    getVariableValue: (name: string) => temporaryVariablePanelManager.getVariableDisplayValue(name),
    getVariableSource: (name: string) => temporaryVariablePanelManager.getVariableSource(name),
    applyValue: (name: string, value: string) => {
        temporaryVariablePanelManager.handleVariableValueChange(name, value)
    },
})

const handleOriginalPromptInput = (value: string) => {
    originalPrompt.value = value
}

// handleVariableExtracted / handleAddMissingVariable are provided by useVariableAwareInputBridge

// Session store (single source of truth)
const session = useImageText2ImageSession()

// Image generation-related
const {
    imageModels,
    generateText2Image,
    validateText2ImageRequest,
    loadImageModels,
} = useImageGeneration()

// Service references
const historyManager = computed(() => services.value?.historyManager)
const promptService = computed(() => services.value?.promptService)

// Transient state (local, not persisted)
const isOptimizing = ref(false)
const isIterating = ref(false)

// Ref dedicated to history management (not written to the session store)
const currentChainId = ref('')
const currentVersions = ref<PromptRecordChain['versions']>([])
const currentVersionId = ref('')

// Field-level accessors (from the session state)
const originalPrompt = computed<string>({
    get: () => session.originalPrompt || '',
    set: (value) => session.updatePrompt(value || ''),
})

const optimizedPrompt = computed<string>({
    get: () => session.optimizedPrompt || '',
    set: (value) => {
        session.updateOptimizedResult({
            optimizedPrompt: value || '',
            reasoning: session.reasoning || '',
            chainId: session.chainId || '',
            versionId: session.versionId || '',
        })
    },
})

const optimizedReasoning = computed<string>({
    get: () => session.reasoning || '',
    set: (value) => {
        session.updateOptimizedResult({
            optimizedPrompt: session.optimizedPrompt || '',
            reasoning: value || '',
            chainId: session.chainId || '',
            versionId: session.versionId || '',
        })
    },
})

// Text model selection (aligned with template selection: auto refresh + fallback write-back to the session store)
const modelSelection = useWorkspaceTextModelSelection(services, session)
const selectedTextModelKey = modelSelection.selectedTextModelKey

const selectedImageModelKey = computed<string>({
    get: () => session.selectedImageModelKey || '',
    set: (value) => session.updateImageModel(value || ''),
})

const templateSelection = useWorkspaceTemplateSelection(
    services,
    session,
    'text2imageOptimize',
    'imageIterate',
)

const selectedTemplateId = templateSelection.selectedTemplateId
const templateOptions = templateSelection.templateOptions

const isCompareMode = computed<boolean>({
    get: () => !!session.isCompareMode,
    set: (value) => session.toggleCompareMode(!!value),
})

// Fixed template type
const templateType = computed(() => "text2imageOptimize" as const)

// Image mode uniformly uses user mode
const optimizationMode = 'user' as OptimizationMode
const advancedModeEnabled = false

const selectedTemplate = templateSelection.selectedTemplate

// PromptPanel needs a v-model of a Template object; use a wrapper to sync back to iterateTemplateId
const selectedIterateTemplate = computed<Template | null>({
    get: () => templateSelection.selectedIterateTemplate.value,
    set: (template) => {
        templateSelection.selectedIterateTemplateId.value = template?.id ?? ''
        templateSelection.selectedIterateTemplate.value = template ?? null
    },
})

// Model options
const textModelOptions = modelSelection.textModelOptions
const imageModelOptions = ref<SelectOption<ImageModelConfig>[]>([])

// ==================== Main layout: draggable split pane (left 25%~50%) ====================

const splitRootRef = ref<HTMLElement | null>(null)
const testPaneRef = ref<HTMLElement | null>(null)

const clampLeftPct = (pct: number) => Math.min(50, Math.max(25, pct))

// Use a local draft to avoid frequent writes to persistent storage while dragging
const mainSplitLeftPct = ref<number>(50)
watch(
    () => session.layout.mainSplitLeftPct,
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

    session.setMainSplitLeftPct(mainSplitLeftPct.value)
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

    session.setMainSplitLeftPct(mainSplitLeftPct.value)
}

onUnmounted(() => {
    endSplitDrag()
})

// ==================== Test area: multi-column variants (by prompt version + image model) ====================

const getVariant = (id: TestVariantId): TestVariantConfig | undefined => {
    const list = session.testVariants as unknown as TestVariantConfig[]
    return Array.isArray(list) ? list.find((v) => v.id === id) : undefined
}

const testColumnCountModel = computed<TestColumnCount>({
    get: () => {
        const raw = session.layout.testColumnCount
        return raw === 2 || raw === 3 || raw === 4 ? raw : 2
    },
    set: (value) => session.setTestColumnCount(value),
})

const variantAVersionModel = computed<TestPanelVersionValue>({
    get: () => getVariant('a')?.version ?? 0,
    set: (value) => session.updateTestVariant('a', { version: value }),
})

const variantBVersionModel = computed<TestPanelVersionValue>({
    get: () => getVariant('b')?.version ?? 'latest',
    set: (value) => session.updateTestVariant('b', { version: value }),
})

const variantCVersionModel = computed<TestPanelVersionValue>({
    get: () => getVariant('c')?.version ?? 'latest',
    set: (value) => session.updateTestVariant('c', { version: value }),
})

const variantDVersionModel = computed<TestPanelVersionValue>({
    get: () => getVariant('d')?.version ?? 'latest',
    set: (value) => session.updateTestVariant('d', { version: value }),
})

const variantAModelKeyModel = computed<string>({
    get: () => getVariant('a')?.modelKey ?? '',
    set: (value) => session.updateTestVariant('a', { modelKey: value }),
})

const variantBModelKeyModel = computed<string>({
    get: () => getVariant('b')?.modelKey ?? '',
    set: (value) => session.updateTestVariant('b', { modelKey: value }),
})

const variantCModelKeyModel = computed<string>({
    get: () => getVariant('c')?.modelKey ?? '',
    set: (value) => session.updateTestVariant('c', { modelKey: value }),
})

const variantDModelKeyModel = computed<string>({
    get: () => getVariant('d')?.modelKey ?? '',
    set: (value) => session.updateTestVariant('d', { modelKey: value }),
})

const ALL_VARIANT_IDS: TestVariantId[] = ['a', 'b', 'c', 'd']
const activeVariantIds = computed<TestVariantId[]>(() =>
    ALL_VARIANT_IDS.slice(0, testColumnCountModel.value),
)

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

const testGridTemplateColumns = computed(
    () => `repeat(${testColumnCountModel.value}, minmax(0, 1fr))`,
)

// Version options: original (v0) + intermediate versions (v1..v(n-1)) + latest (latest)
const versionOptions = computed(() => {
    const versions = currentVersions.value || []

    const sortedVersions = versions
        .map((v) => v.version)
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 1)
        .slice()
        .sort((a, b) => a - b)

    const latest = sortedVersions.length ? sortedVersions[sortedVersions.length - 1] : null
    const middle = latest ? sortedVersions.filter((v) => v < latest) : []

    return [
        { label: t('test.layout.original'), value: 0 },
        ...middle.map((v) => ({ label: `v${v}`, value: v })),
        { label: t('test.layout.latest'), value: 'latest' },
    ]
})

// Make sure the model selection of the test columns is always valid (automatic fallback when the model list changes)
watch(
    () => imageModelOptions.value,
    (opts) => {
        const fallback = opts?.[0]?.value || ''
        if (!fallback) return
        const keys = new Set((opts || []).map((o) => o.value))

        const legacy = session.selectedImageModelKey
        const seed = legacy && keys.has(legacy) ? legacy : fallback

        for (const id of ALL_VARIANT_IDS) {
            const current = variantModelKeyModels[id].value
            if (!current || !keys.has(current)) {
                session.updateTestVariant(id, { modelKey: seed })
            }
        }
    },
    { immediate: true },
)

type ResolvedPrompt = { text: string; resolvedVersion: number }

const resolvePromptForSelection = (selection: TestPanelVersionValue): ResolvedPrompt => {
    const v0 = originalPrompt.value || ''
    const versions = currentVersions.value || []

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
        if (!latest) return { text: optimizedPrompt.value || v0, resolvedVersion: 0 }
        return { text: latest.optimizedPrompt || '', resolvedVersion: latest.version }
    }

    const target = versions.find((v) => v.version === selection)
    if (target) {
        return { text: target.optimizedPrompt || '', resolvedVersion: target.version }
    }

    if (latest) return { text: latest.optimizedPrompt || '', resolvedVersion: latest.version }
    return { text: optimizedPrompt.value || v0, resolvedVersion: 0 }
}

// Note: the Pinia setup store unwraps refs automatically; assigning directly would lose reactivity.
// Read via computed here, to make sure the UI follows along when the store replaces the object reference.
const variantResults = computed(
    () => session.testVariantResults as unknown as Record<TestVariantId, ImageResult | null>,
)
const variantLastRunFingerprint = computed(
    () => session.testVariantLastRunFingerprint as unknown as Record<TestVariantId, string>,
)

const variantRunning = reactive<Record<TestVariantId, boolean>>({
    a: false,
    b: false,
    c: false,
    d: false,
})

const isAnyVariantRunning = computed(() =>
    activeVariantIds.value.some((id) => !!variantRunning[id]),
)

const getVariantLabel = (id: TestVariantId) => ({ a: 'A', b: 'B', c: 'C', d: 'D' }[id])

const getVariantVersionTestId = (id: TestVariantId) => {
    if (id === 'a') return 'image-text2image-test-original-version-select'
    if (id === 'b') return 'image-text2image-test-optimized-version-select'
    return `image-text2image-test-variant-${id}-version-select`
}

const getVariantModelTestId = (id: TestVariantId) => {
    if (id === 'a') return 'image-text2image-test-original-model-select'
    if (id === 'b') return 'image-text2image-test-optimized-model-select'
    return `image-text2image-test-variant-${id}-model-select`
}

const getVariantRunTestId = (id: TestVariantId) => `image-text2image-test-run-${id}`

const getVariantImageTestId = (id: TestVariantId) => {
    if (id === 'a') return 'image-text2image-original-image'
    if (id === 'b') return 'image-text2image-optimized-image'
    return `image-text2image-variant-${id}-image`
}

const getVariantResult = (id: TestVariantId) => variantResults.value[id]
const hasVariantResult = (id: TestVariantId) => !!(variantResults.value[id]?.images?.length)

// image mode variable priority: global < temporary < predefined
// - predefined acts as a read-only "system variable" with the highest priority during substitution
const mergedGenerationVariables = computed<Record<string, string>>(() => ({
    ...(variableManager?.customVariables.value || {}),
    ...(tempVarsManager.temporaryVariables.value || {}),
    ...(purePredefinedVariables.value || {}),
}))

// ========================
// Sub-mode local prompt preview (does not go through PromptOptimizerApp)
// ========================
const previewContextMode = computed<ContextMode>(() => 'user')

// Keep runtime predefined values aligned with buildRuntimePredefinedVariables used for execution.
const runtimePredefinedVariablesForPreview = computed<Record<string, string>>(() => {
    const current = (optimizedPrompt.value || '').trim()
    return {
        originalPrompt: (originalPrompt.value || '').trim(),
        lastOptimizedPrompt: (optimizedPrompt.value || '').trim(),
        currentPrompt: current,
        userQuestion: current,
    }
})

const previewVariables = computed<Record<string, string>>(() => ({
    ...mergedGenerationVariables.value,
    ...runtimePredefinedVariablesForPreview.value,
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

const handleOpenPromptPreview = () => {
    openPromptPreview(optimizedPrompt.value || '', { renderPhase: 'test' })
}

const buildRuntimePredefinedVariables = (resolved: ResolvedPrompt): Record<string, string> => {
    const current = (resolved.text || '').trim()
    return {
        // Align with core PREDEFINED_VARIABLES (packages/core/src/services/context/constants.ts)
        originalPrompt: (originalPrompt.value || '').trim(),
        lastOptimizedPrompt: (optimizedPrompt.value || '').trim(),
        currentPrompt: current,
        userQuestion: current,
    }
}

const getVariantFingerprint = (id: TestVariantId) => {
    const selection = variantVersionModels[id].value
    const resolved = resolvePromptForSelection(selection)
    const modelKey = (variantModelKeyModels[id].value || '').trim()
    const promptHash = hashString((resolved.text || '').trim())
    const varsForFingerprint = {
        ...mergedGenerationVariables.value,
        ...buildRuntimePredefinedVariables(resolved),
    }
    const varsHash = hashVariables(varsForFingerprint)
    return `${String(selection)}:${resolved.resolvedVersion}:${modelKey}:${promptHash}:${varsHash}`
}

const isVariantStale = (id: TestVariantId) => {
    if (!hasVariantResult(id)) return false
    const prev = variantLastRunFingerprint.value[id]
    if (!prev) return false
    return prev !== getVariantFingerprint(id)
}

const getVariantRequest = (id: TestVariantId): Text2ImageRequest | null => {
    const modelKey = (variantModelKeyModels[id].value || '').trim()
    if (!modelKey) {
        toast.error(t('imageWorkspace.generation.missingRequiredFields'))
        return null
    }

    const resolved = resolvePromptForSelection(variantVersionModels[id].value)
    if (!resolved.text?.trim()) {
        toast.error(t('imageWorkspace.generation.missingRequiredFields'))
        return null
    }

    const varsForRequest = {
        ...mergedGenerationVariables.value,
        ...buildRuntimePredefinedVariables(resolved),
    }

    const ctx = buildPromptExecutionContext(resolved.text, varsForRequest)
    if (ctx.forbiddenTemplateSyntax.length > 0) {
        toast.error(t('imageWorkspace.generation.forbiddenTemplateSyntax'))
        return null
    }
    if (ctx.missingVariables.length > 0) {
        toast.error(t('imageWorkspace.generation.missingVariables', { vars: ctx.missingVariables.join(', ') }))
        return null
    }

    const prompt = ctx.renderedContent
    if (!prompt.trim()) {
        toast.error(t('imageWorkspace.generation.missingRequiredFields'))
        return null
    }

    return {
        prompt,
        configId: modelKey,
        count: 1,
        paramOverrides: { outputMimeType: 'image/png' },
    }
}

// Avoid saveSession race conditions during parallel generation: serialize saves, and the last write should contain the latest state.
let sessionSaveChain: Promise<void> = Promise.resolve()
const queueSessionSave = () => {
    sessionSaveChain = sessionSaveChain
        .then(() => session.saveSession())
        .catch((e) => {
            console.error('[ImageText2ImageWorkspace] Failed to persist image session:', e)
        })
}

const runVariant = async (
    id: TestVariantId,
    opts?: {
        silentSuccess?: boolean
        silentError?: boolean
        persist?: boolean
        allowParallel?: boolean
    },
): Promise<boolean> => {
    if (variantRunning[id]) return false

    const request = getVariantRequest(id)
    if (!request) return false

    variantRunning[id] = true
    try {
        try {
            await validateText2ImageRequest(request)
        } catch (e) {
            if (!opts?.silentError) {
                toast.error(getI18nErrorMessage(e, t('imageWorkspace.generation.validationFailed')))
            }
            return false
        }

        const res = await generateText2Image(request)
        session.updateTestVariantResult(id, res)
        session.setTestVariantLastRunFingerprint(id, getVariantFingerprint(id))

        if (!opts?.silentSuccess) {
            toast.success(t('imageWorkspace.generation.generationCompleted'))
        }
        return true
    } catch (error) {
        if (!opts?.silentError) {
            toast.error(getI18nErrorMessage(error, t('imageWorkspace.generation.generateFailed')))
        }
        return false
    } finally {
        variantRunning[id] = false
        if (opts?.persist !== false) {
            queueSessionSave()
        }
    }
}

const runAllVariants = async () => {
    if (isAnyVariantRunning.value) return

    const ids = activeVariantIds.value
    for (const id of ids) {
        if (!getVariantRequest(id)) return
    }

    const results = await Promise.all(
        ids.map((id) => runVariant(id, { silentSuccess: true, silentError: true, persist: false })),
    )

    queueSessionSave()

    if (results.every(Boolean)) {
        toast.success(t('imageWorkspace.generation.generationCompleted'))
    } else {
        toast.error(t('imageWorkspace.generation.generateFailed'))
    }
}

// Evaluation handler (image mode only: testResults is not involved)
const evaluationHandler = useEvaluationHandler({
    services,
    originalPrompt,
    optimizedPrompt,
    testContent: computed(() => ''),
    testResults: ref<TestResultsData | null>(null),
    evaluationModelKey: selectedTextModelKey,
    functionMode: computed(() => 'image'),
    subMode: computed(() => 'text2image'),
    persistedResults: toRef(session, 'evaluationResults'),
})

// Provide the evaluation context to PromptPanel (private to the sub-mode; results persisted in the session store)
provideEvaluation(evaluationHandler.evaluation)

const { evaluation } = evaluationHandler
const panelProps = evaluationHandler.panelProps

const handleApplyImprovement = (payload: { improvement: string }) => {
    evaluation.closePanel()
    promptPanelRef.value?.openIterateDialog?.(payload.improvement)
}

const handleApplyPatch = (payload: { operation: PatchOperation }) => {
    if (!payload.operation) return
    const current = optimizedPrompt.value || ''
    const result = applyPatchOperationsToText(current, payload.operation)
    if (!result.ok) {
        toast.warning(t('toast.warning.patchApplyFailed'))
        return
    }
    optimizedPrompt.value = result.text
    toast.success(t('evaluation.diagnose.applyFix'))
}

// Save local edits
const handleSaveLocalEdit = async (payload: { note?: string }) => {
    if (!historyManager.value) {
        toast.error(t('toast.error.historyUnavailable'))
        return
    }

    const newPrompt = optimizedPrompt.value || ''
    if (!newPrompt.trim()) return

    try {
        const chainId = currentChainId.value || session.chainId || ''
        const currentRecord = currentVersions.value.find((v) => v.id === currentVersionId.value)

        const modelKey = currentRecord?.modelKey || selectedTextModelKey.value || 'local-edit'
        const templateId =
            currentRecord?.templateId ||
            selectedIterateTemplate.value?.id ||
            selectedTemplate.value?.id ||
            'local-edit'

        const chain = chainId
            ? await historyManager.value.addIteration({
                  chainId,
                  originalPrompt: originalPrompt.value,
                  optimizedPrompt: newPrompt,
                  modelKey,
                  templateId,
                  iterationNote: payload.note,
                  metadata: {
                      optimizationMode: 'user' as OptimizationMode,
                      functionMode: 'image',
                      localEdit: true,
                      localEditSource: 'manual',
                      imageModelKey: selectedImageModelKey.value,
                      hasInputImage: false,
                      compareMode: isCompareMode.value,
                  },
              })
            : await historyManager.value.createNewChain({
                  id: uuidv4(),
                  originalPrompt: originalPrompt.value,
                  optimizedPrompt: newPrompt,
                  type: 'text2imageOptimize' as PromptRecordType,
                  modelKey,
                  templateId,
                  timestamp: Date.now(),
                  metadata: {
                      optimizationMode: 'user' as OptimizationMode,
                      functionMode: 'image',
                      localEdit: true,
                      localEditSource: 'manual',
                      imageModelKey: selectedImageModelKey.value,
                      hasInputImage: false,
                      compareMode: isCompareMode.value,
                  },
              })

        currentChainId.value = chain.chainId
        currentVersions.value = chain.versions
        currentVersionId.value = chain.currentRecord.id

        session.updateOptimizedResult({
            optimizedPrompt: newPrompt,
            reasoning: '',
            chainId: chain.chainId,
            versionId: chain.currentRecord.id,
        })

        window.dispatchEvent(new CustomEvent('prompt-optimizer:history-refresh'))
        toast.success(t('toast.success.localEditSaved'))
    } catch (e) {
        console.error('[ImageText2ImageWorkspace] Failed to save local edit:', e)
        toast.warning(t('toast.warning.saveHistoryFailed'))
    }
}

const handleClearEvaluation = () => {
    evaluation.closePanel()
    evaluation.clearAllResults()
}

// PromptPanel reference, used to refresh the iterate template selection after a language switch
const promptPanelRef = ref<InstanceType<typeof PromptPanelUI> | null>(null);

// Input area collapsed state (expanded initially)
const isInputPanelCollapsed = ref(false);

// Prompt summary (shown in the collapsed state)
const promptSummary = computed(() => {
    if (!originalPrompt.value) return '';
    return originalPrompt.value.length > 50
        ? originalPrompt.value.slice(0, 50) + '...'
        : originalPrompt.value;
});

/** Whether an analysis is running */
const isAnalyzing = ref(false);

/**
 * Handle the analyze action
 */
const handleAnalyze = async () => {
    if (!originalPrompt.value?.trim()) return;
    if (isOptimizing.value) return;

    isAnalyzing.value = true;

    // 1. Clear the version chain and create a virtual V0
    const virtualV0Id = uuidv4()
    const virtualV0: PromptRecordChain['versions'][number] = {
        id: virtualV0Id,
        chainId: '',
        version: 0,
        originalPrompt: originalPrompt.value,
        optimizedPrompt: originalPrompt.value,
        type: 'imageOptimize',
        timestamp: Date.now(),
        modelKey: '',
        templateId: '',
    }

    currentChainId.value = ''
    currentVersions.value = [virtualV0]
    currentVersionId.value = virtualV0Id
    optimizedPrompt.value = originalPrompt.value
    session.updateOptimizedResult({
        optimizedPrompt: originalPrompt.value,
        reasoning: '',
        chainId: '',
        versionId: '',
    })

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

// Inject the App layer's unified openTemplateManager / openModelManager / handleSaveFavorite interfaces
type TemplateEntryType =
    | "optimize"
    | "userOptimize"
    | "iterate"
    | "contextIterate"
    | "text2imageOptimize"
    | "image2imageOptimize"
    | "imageIterate";

const appOpenTemplateManager = inject<
    ((type?: TemplateEntryType) => void) | null
>("openTemplateManager", null);
const appOpenModelManager = inject<
    ((tab?: "text" | "image" | "function") => void) | null
>("openModelManager", null);
const appHandleSaveFavorite = inject<
    ((data: { content: string; originalContent?: string }) => void) | null
>("handleSaveFavorite", null);

// Map the iteration type to image iteration and call the App entry
const onOpenTemplateManager = (type: TemplateEntryType) => {
    const target: TemplateEntryType =
        type === "iterate" || type === "contextIterate" ? "imageIterate" : type;
    appOpenTemplateManager?.(target);
};

// Fullscreen editing: reuse the useFullscreen pattern to edit originalPrompt
const { isFullscreen, fullscreenValue, openFullscreen } = useFullscreen(
    computed(() => originalPrompt.value),
    (value) => {
        originalPrompt.value = value;
    },
);

// ========== Template SelectWithConfig selection binding ==========
const selectedTemplateIdForSelect = computed<string>({
    get() {
        const id = selectedTemplateId.value || "";
        if (!id) return "";
        const existsInList = (templateOptions.value || []).some(
            (opt) => opt.value === id,
        );
        return existsInList ? id : "";
    },
    set(id: string) {
        selectedTemplateId.value = id || "";
    },
});

// Handle the save favorite request - calls the unified interface provided by App.vue
const handleSaveFavorite = (data: {
    content: string;
    originalContent?: string;
}) => {
    console.log("[ImageText2ImageWorkspace] handleSaveFavorite triggered:", data);

    if (appHandleSaveFavorite) {
        appHandleSaveFavorite(data);
    } else {
        console.warn(
            "[ImageText2ImageWorkspace] handleSaveFavorite not available from App.vue",
        );
    }
};

// Copy the image text output
const copyImageText = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(t("imageWorkspace.results.copySuccess"));
    } catch (error) {
        console.error("Failed to copy text:", error);
        toast.error(t("imageWorkspace.results.copyError"));
    }
};

// Handle favorite backfill - restore a prompt from favorites to the image workspace
interface RestoreFavoriteDetail {
    content: string;
    imageSubMode?: "text2image" | "image2image";
}

const handleRestoreFavorite = async (event: Event) => {
    if (!(event instanceof CustomEvent)) {
        return;
    }
    console.log(
        "[ImageText2ImageWorkspace] handleRestoreFavorite triggered:",
        event.detail,
    );
    const { content } = event.detail as RestoreFavoriteDetail;

    // Set the original prompt
    originalPrompt.value = content;

    console.log("[ImageText2ImageWorkspace] Favorite restored successfully");
};

type ImageWorkspaceRestoreDetail = {
    originalPrompt?: unknown;
    optimizedPrompt?: unknown;
    metadata?: unknown;
    chainId?: unknown;
    versions?: unknown;
    currentVersionId?: unknown;
    imageMode?: unknown;
    templateId?: unknown;
};

const handleRestoreHistory = async (event: Event) => {
    if (!(event instanceof CustomEvent)) {
        return;
    }

    const detail = event.detail as ImageWorkspaceRestoreDetail;
    if (detail?.imageMode !== "text2image") return;

    const versions = Array.isArray(detail.versions)
        ? (detail.versions as PromptRecordChain["versions"])
        : [];

    const requestedVersionId =
        typeof detail.currentVersionId === "string" ? detail.currentVersionId : "";
    const record =
        (requestedVersionId &&
            versions.find((v) => v.id === requestedVersionId)) ||
        versions[versions.length - 1] ||
        null;

    const original =
        (record?.originalPrompt && record.originalPrompt) ||
        (typeof detail.originalPrompt === "string" ? detail.originalPrompt : "");
    const optimized =
        (record?.optimizedPrompt && record.optimizedPrompt) ||
        (typeof detail.optimizedPrompt === "string" ? detail.optimizedPrompt : "");

    // 1) Restore local history refs (PromptPanel versions list)
    currentChainId.value = typeof detail.chainId === "string" ? detail.chainId : "";
    currentVersions.value = versions;
    currentVersionId.value = record?.id || requestedVersionId || "";

    // 2) Restore session store (single source of truth for fields)
    originalPrompt.value = original;
    session.updateOptimizedResult({
        optimizedPrompt: optimized,
        reasoning: "",
        chainId: currentChainId.value || session.chainId || "",
        versionId: currentVersionId.value || session.versionId || "",
    });

    if (record?.modelKey) {
        session.updateTextModel(record.modelKey);
    }

    if (record?.templateId) {
        session.updateTemplate(record.templateId);
    } else if (typeof detail.templateId === "string") {
        session.updateTemplate(detail.templateId);
    }

    const meta =
        (record?.metadata as unknown as Record<string, unknown> | undefined) ||
        (typeof detail.metadata === "object" && detail.metadata
            ? (detail.metadata as Record<string, unknown>)
            : undefined);

    const imageModelKey = meta?.imageModelKey;
    if (typeof imageModelKey === "string") {
        session.updateImageModel(imageModelKey);
    }

    const compareMode = meta?.compareMode;
    if (typeof compareMode === "boolean") {
        session.toggleCompareMode(compareMode);
    }
};

// Register the favorite backfill event listener immediately when the component is created
if (typeof window !== "undefined") {
    window.addEventListener(
        "image-workspace-restore-favorite",
        handleRestoreFavorite as EventListener,
    );
    window.addEventListener(
        "image-workspace-restore",
        handleRestoreHistory as EventListener,
    );
    console.log(
        "[ImageText2ImageWorkspace] Favorite restore event listener registered immediately on component creation",
    );
}

const refreshImageModels = async () => {
    try {
        await loadImageModels()
        imageModelOptions.value = imageModels.value.map(m => ({
            label: `${m.name} (${m.provider?.name || m.providerId || 'Unknown'} - ${m.model?.name || m.modelId || 'Unknown'})`,
            primary: m.name,
            secondary: `${m.provider?.name || m.providerId || 'Unknown'} · ${m.model?.name || m.modelId || 'Unknown'}`,
            value: m.id,
            raw: m,
        }))

        if (!imageModels.value.length) {
            return
        }

        const current = selectedImageModelKey.value
        const exists = imageModels.value.some(m => m.id === current)
        if (!exists) {
            selectedImageModelKey.value = imageModels.value[0]?.id || ''
        }
    } catch (e) {
        console.error('[ImageText2ImageWorkspace] Failed to refresh image models:', e)
    }
}

// Create a history record (and sync chain/version to the session store)
const createHistoryRecord = async () => {
    if (!selectedTemplate.value || !historyManager.value) return

    try {
        const recordData = {
            id: uuidv4(),
            originalPrompt: originalPrompt.value,
            optimizedPrompt: optimizedPrompt.value,
            type: 'text2imageOptimize' as PromptRecordType,
            modelKey: selectedTextModelKey.value,
            templateId: selectedTemplate.value.id,
            timestamp: Date.now(),
            metadata: {
                optimizationMode: 'user' as OptimizationMode,
                functionMode: 'image',
                imageModelKey: selectedImageModelKey.value,
                hasInputImage: false,
                compareMode: isCompareMode.value,
            },
        }

        const newRecord = await historyManager.value.createNewChain(recordData)
        currentChainId.value = newRecord.chainId
        currentVersions.value = newRecord.versions
        currentVersionId.value = newRecord.currentRecord.id

        session.updateOptimizedResult({
            optimizedPrompt: optimizedPrompt.value,
            reasoning: optimizedReasoning.value,
            chainId: newRecord.chainId,
            versionId: newRecord.currentRecord.id,
        })

        window.dispatchEvent(new CustomEvent('prompt-optimizer:history-refresh'))
    } catch (e) {
        console.error('[ImageText2ImageWorkspace] Failed to create history record:', e)
        toast.warning(t('toast.error.optimizeCompleteButHistoryFailed'))
    }
}

// Optimize the prompt (streaming writes to store.state)
const handleOptimizePrompt = async () => {
    if (!originalPrompt.value.trim() || isOptimizing.value) return
    if (!selectedTemplate.value) {
        toast.error(t('toast.error.noOptimizeTemplate'))
        return
    }
    if (!selectedTextModelKey.value) {
        toast.error(t('toast.error.noOptimizeModel'))
        return
    }
    if (!promptService.value) {
        toast.error(t('toast.error.serviceInit'))
        return
    }

    isOptimizing.value = true
    session.optimizedPrompt = ''
    session.reasoning = ''

    await nextTick()

    try {
        const request: OptimizationRequest = {
            optimizationMode: 'user',
            targetPrompt: originalPrompt.value,
            templateId: selectedTemplate.value.id,
            modelKey: selectedTextModelKey.value,
        }

        await promptService.value.optimizePromptStream(request, {
            onToken: token => {
                session.optimizedPrompt += token
            },
            onReasoningToken: token => {
                session.reasoning += token
            },
            onComplete: async () => {
                await createHistoryRecord()
                        toast.success(t('toast.success.optimizeSuccess'))
            },
            onError: (error: Error) => {
                throw error
            },
        })
    } catch (error) {
        toast.error(getI18nErrorMessage(error, t('toast.error.optimizeFailed')))
    } finally {
        isOptimizing.value = false
    }
}

// Iterative optimization (streaming writes to store.state)
const handleIteratePrompt = async (payload: {
    originalPrompt: string
    optimizedPrompt: string
    iterateInput: string
}) => {
    if (!selectedIterateTemplate.value || !promptService.value) {
        console.error('[ImageText2ImageWorkspace] Missing iterate dependencies')
        return
    }

    isIterating.value = true
    const previousOptimizedPrompt = optimizedPrompt.value

    session.optimizedPrompt = ''
    session.reasoning = ''

    try {
        await promptService.value.iteratePromptStream(
            payload.originalPrompt,
            payload.optimizedPrompt,
            payload.iterateInput,
            selectedTextModelKey.value,
            {
                onToken: token => {
                    session.optimizedPrompt += token
                },
                onReasoningToken: token => {
                    session.reasoning += token
                },
                onComplete: async () => {
                    try {
                        if (historyManager.value && currentChainId.value) {
                            const updatedChain = await historyManager.value.addIteration({
                                chainId: currentChainId.value,
                                originalPrompt: payload.originalPrompt,
                                optimizedPrompt: optimizedPrompt.value,
                                iterationNote: payload.iterateInput,
                                modelKey: selectedTextModelKey.value,
                                templateId: selectedIterateTemplate.value!.id,
                            })
                            currentVersions.value = updatedChain.versions
                            currentVersionId.value = updatedChain.currentRecord.id
                            session.updateOptimizedResult({
                                optimizedPrompt: optimizedPrompt.value,
                                reasoning: optimizedReasoning.value,
                                chainId: updatedChain.chainId,
                                versionId: updatedChain.currentRecord.id,
                            })
                            window.dispatchEvent(new CustomEvent('prompt-optimizer:history-refresh'))
                        } else {
                            await createHistoryRecord()
                        }
                        toast.success(t('toast.success.iterateComplete'))
                    } catch (e) {
                        console.error('[ImageText2ImageWorkspace] Failed to persist iteration:', e)
                        toast.warning(t('toast.error.iterateCompleteButHistoryFailed'))
                    }
                },
                onError: (error: Error) => {
                    throw error
                },
            },
            selectedIterateTemplate.value.id,
        )
    } catch (error) {
        toast.error(getI18nErrorMessage(error, t('toast.error.iterateFailed')))
        optimizedPrompt.value = previousOptimizedPrompt
    } finally {
        isIterating.value = false
    }
}

// Switch versions (only affects the current UI display, versions are not persisted)
const handleSwitchVersion = async (version: PromptRecordChain['versions'][number]) => {
    optimizedPrompt.value = version.optimizedPrompt
    currentVersionId.value = version.id
    session.updateOptimizedResult({
        optimizedPrompt: version.optimizedPrompt || '',
        reasoning: optimizedReasoning.value || '',
        chainId: currentChainId.value || session.chainId || '',
        versionId: version.id || '',
    })
    await nextTick()
}

// Get the image display source address
const getImageSrc = (imageItem: ImageResultItem | null | undefined) => {
    if (!imageItem) return ''
    if (imageItem.url) return imageItem.url
    if (imageItem.b64) {
        const mime = imageItem.mimeType ?? 'image/png'
        return `data:${mime};base64,${imageItem.b64}`
    }
    return ''
}

// Download the image
const downloadImageFromResult = async (imageItem: ImageResultItem | null | undefined, prefix: string) => {
    if (!imageItem) return

    const ext = (imageItem.mimeType?.replace('image/', '') || 'png').replace('jpeg', 'jpg')
    const filename = `${prefix}-image.${ext}`

    if (imageItem.url) {
        try {
            const response = await fetch(imageItem.url)
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            a.click()
            window.URL.revokeObjectURL(url)
        } catch {
            toast.error(t('imageWorkspace.results.downloadFailed'))
        }
        return
    }

    if (imageItem.b64) {
        const a = document.createElement('a')
        const mime = imageItem.mimeType ?? 'image/png'
        a.href = `data:${mime};base64,${imageItem.b64}`
        a.download = filename
        a.click()
    }
}

// Initialize
const initialize = async () => {
    try {
        await modelSelection.refreshTextModels()
        await refreshImageModels()
        await templateSelection.refreshOptimizeTemplates()
        await templateSelection.refreshIterateTemplates()
    } catch (e) {
        console.error('[ImageText2ImageWorkspace] Failed to initialize:', e)
    }
}

// Initialization and language-switch event handler
const refreshIterateHandler = async () => {
    await templateSelection.refreshIterateTemplates()
    promptPanelRef.value?.refreshIterateTemplateSelect?.();
};

// Text model refresh event handler (refresh synchronously after the model manager closes)
const refreshTextModelsHandler = async () => {
    try {
        await modelSelection.refreshTextModels();
    } catch (e) {
        console.warn(
            "[ImageText2ImageWorkspace] Failed to refresh text models after manager close:",
            e,
        );
    }
};

// Image model refresh event handler (refresh synchronously after the model manager closes)
const refreshImageModelsHandler = async () => {
    try {
        await refreshImageModels();
    } catch (e) {
        console.warn(
            "[ImageText2ImageWorkspace] Failed to refresh image models after manager close:",
            e,
        );
    }
};

// Refresh the current template list after the template manager closes (keeping the current selection where possible)
const refreshTemplatesHandler = async () => {
    try {
        await templateSelection.refreshOptimizeTemplates()
        await templateSelection.refreshIterateTemplates()
        await nextTick();
        promptPanelRef.value?.refreshIterateTemplateSelect?.();
    } catch (e) {
        console.warn(
            "[ImageText2ImageWorkspace] Failed to refresh template list after manager close:",
            e,
        );
    }
};

// Actively refresh the template list when the dropdown gets focus, to make sure newly created/edited templates are visible
const handleTemplateSelectFocus = async () => {
    await refreshTemplatesHandler();
};

// Refresh when the text model dropdown gets focus, to make sure newly created/edited models are available immediately
const handleTextModelSelectFocus = async () => {
    await refreshTextModelsHandler();
};

onMounted(async () => {
    console.log("[ImageText2ImageWorkspace] Starting initialization...");
    console.log("[ImageText2ImageWorkspace] Services available:", !!services?.value);
    try {
        await initialize();
        console.log("[ImageText2ImageWorkspace] Initialization completed successfully");
    } catch (error) {
        console.error("[ImageText2ImageWorkspace] Initialization failed:", error);
    }

    // Listen for the template language switch event and refresh the iterate template selection
    if (typeof window !== "undefined") {
        window.addEventListener(
            "image-workspace-refresh-iterate-select",
            refreshIterateHandler,
        );
        window.addEventListener(
            "image-workspace-refresh-text-models",
            refreshTextModelsHandler,
        );
        window.addEventListener(
            "image-workspace-refresh-image-models",
            refreshImageModelsHandler,
        );
        window.addEventListener(
            "image-workspace-refresh-templates",
            refreshTemplatesHandler,
        );
    }

    await templateSelection.refreshOptimizeTemplates()
    await templateSelection.refreshIterateTemplates()
});

// Cleanup
onUnmounted(() => {
    console.log("[ImageText2ImageWorkspace] Cleaning up...");
    if (typeof window !== "undefined") {
        window.removeEventListener(
            "image-workspace-refresh-iterate-select",
            refreshIterateHandler,
        );
        window.removeEventListener(
            "image-workspace-refresh-text-models",
            refreshTextModelsHandler,
        );
        window.removeEventListener(
            "image-workspace-refresh-image-models",
            refreshImageModelsHandler,
        );
        window.removeEventListener(
            "image-workspace-refresh-templates",
            refreshTemplatesHandler,
        );
        window.removeEventListener(
            "image-workspace-restore-favorite",
            handleRestoreFavorite as EventListener,
        );
        window.removeEventListener(
            "image-workspace-restore",
            handleRestoreHistory as EventListener,
        );
    }
});
</script>

<style scoped>
.image-text2image-workspace {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

.image-text2image-split {
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
    flex: 0 1 260px;
    max-width: 260px;
    min-width: 0;
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
</style>
