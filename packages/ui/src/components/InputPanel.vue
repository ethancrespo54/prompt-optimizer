<!-- Input panel component - pure Naive UI implementation -->
<template>
    <NSpace vertical :size="16">
        <!-- Title area -->
        <NFlex justify="space-between" align="center" :wrap="false">
            <NFlex align="center" :size="8">
                <NText :depth="1" style="font-size: 18px; font-weight: 500">{{
                    label
                }}</NText>
                <!-- 🆕 Help tooltip icon -->
                <NPopover
                    v-if="helpText"
                    trigger="hover"
                    placement="right"
                    :show-arrow="true"
                >
                    <template #trigger>
                        <NButton
                            text
                            size="tiny"
                            :focusable="false"
                            style="cursor: help; opacity: 0.6"
                        >
                            <template #icon>
                                <NIcon :size="16">
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
                                            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                </NIcon>
                            </template>
                        </NButton>
                    </template>
                    <div style="max-width: 320px; line-height: 1.6">
                        {{ helpText }}
                    </div>
                </NPopover>
            </NFlex>
            <NFlex align="center" :size="12">
                <!-- 🆕 AI extract variables button (with text) -->
                <NButton
                    v-if="enableVariableExtraction && showExtractButton"
                    type="tertiary"
                    size="small"
                    @click="$emit('extract-variables')"
                    :loading="extracting"
                    :disabled="extracting || !modelValue.trim()"
                    ghost
                    round
                >
                    <template #icon>
                        <NIcon>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/>
                            </svg>
                        </NIcon>
                    </template>
                    {{ extracting ? $t('evaluation.variableExtraction.extracting') : $t('evaluation.variableExtraction.extractButton') }}
                </NButton>
                <!-- Preview button -->
                <NButton
                    v-if="showPreview"
                    type="tertiary"
                    size="small"
                    @click="$emit('open-preview')"
                    :title="$t('common.preview')"
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
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                            </svg>
                        </NIcon>
                    </template>
                </NButton>
                <!-- Fullscreen button -->
                <NButton
                    type="tertiary"
                    size="small"
                    @click="openFullscreen"
                    :title="$t('common.expand')"
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
                <!-- Extra button slot in the title bar -->
                <slot name="header-extra"></slot>
            </NFlex>
        </NFlex>

        <!-- Input box - uses the variable-aware input (supports variable extraction) -->
        <VariableAwareInput
            v-if="enableVariableExtraction"
            :model-value="modelValue"
            @update:model-value="$emit('update:modelValue', $event)"
            :placeholder="placeholder"
            :autosize="{ minRows: 4, maxRows: 12 }"
            clearable
            show-count
            :data-testid="`${testIdPrefix}-input`"
            :existing-global-variables="existingGlobalVariables"
            :existing-temporary-variables="existingTemporaryVariables"
            :predefined-variables="predefinedVariables"
            :global-variable-values="globalVariableValues"
            :temporary-variable-values="temporaryVariableValues"
            :predefined-variable-values="predefinedVariableValues"
            @variable-extracted="handleVariableExtracted"
            @add-missing-variable="handleAddMissingVariable"
        />

        <!-- Native input box (does not support variable extraction) -->
        <NInput
            v-else
            :value="modelValue"
            @update:value="$emit('update:modelValue', $event)"
            type="textarea"
            :placeholder="placeholder"
            :rows="4"
            :autosize="{ minRows: 4, maxRows: 12 }"
            clearable
            show-count
            :data-testid="`${testIdPrefix}-input`"
        />

        <!-- Control panel -->
        <NGrid :cols="24" :x-gap="8" responsive="screen">
            <!-- Model selection -->
            <NGridItem :span="6" :xs="24" :sm="6">
                <NSpace vertical :size="8">
                    <NText
                        :depth="2"
                        style="font-size: 14px; font-weight: 500"
                        >{{ modelLabel }}</NText
                    >
                    <slot name="model-select"></slot>
                </NSpace>
            </NGridItem>

            <!-- Prompt template selection -->
            <NGridItem v-if="templateLabel" :span="11" :xs="24" :sm="11">
                <NSpace vertical :size="8">
                    <NText
                        :depth="2"
                        style="font-size: 14px; font-weight: 500"
                        >{{ templateLabel }}</NText
                    >
                    <slot name="template-select"></slot>
                </NSpace>
            </NGridItem>

            <!-- Control button group -->
            <NGridItem
                :span="templateLabel ? 2 : 13"
                :xs="24"
                :sm="templateLabel ? 2 : 13"
            >
                <NSpace vertical :size="8" align="end">
                    <slot name="control-buttons"></slot>
                </NSpace>
            </NGridItem>

            <!-- Submit button area -->
            <NGridItem :span="5" :xs="24" :sm="5" class="flex items-end">
                <NSpace :size="8" justify="end" style="width: 100%">
                    <!-- Analyze button (same level as optimize) -->
                    <NButton
                        v-if="showAnalyzeButton"
                        type="default"
                        size="medium"
                        :data-testid="`${testIdPrefix}-analyze-button`"
                        @click="$emit('analyze')"
                        :loading="analyzeLoading"
                        :disabled="analyzeLoading || loading || disabled || !modelValue.trim()"
                    >
                        {{ analyzeLoading ? $t('promptOptimizer.analyzing') : $t('promptOptimizer.analyze') }}
                    </NButton>
                    <!-- Optimize button -->
                    <NButton
                        type="primary"
                        size="medium"
                        :data-testid="`${testIdPrefix}-optimize-button`"
                        @click="$emit('submit')"
                        :loading="loading"
                        :disabled="analyzeLoading || loading || disabled || !modelValue.trim()"
                    >
                        {{ loading ? loadingText : buttonText }}
                    </NButton>
                </NSpace>
            </NGridItem>
        </NGrid>
    </NSpace>

    <!-- Fullscreen dialog -->
    <FullscreenDialog v-model="isFullscreen" :title="label">
        <NInput
            v-model:value="fullscreenValue"
            type="textarea"
            :placeholder="placeholder"
            :autosize="{ minRows: 20 }"
            clearable
            show-count
        />
    </FullscreenDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import {
    NInput,
    NButton,
    NText,
    NSpace,
    NFlex,
    NGrid,
    NGridItem,
    NIcon,
    NPopover,
} from "naive-ui";
import { useFullscreen } from '../composables/ui/useFullscreen';
import FullscreenDialog from "./FullscreenDialog.vue";
import { VariableAwareInput } from "./variable-extraction";

/**
 * Input panel component
 *
 * Features:
 * 1. Provides an input box for user input
 * 2. Supports fullscreen editing mode
 * 3. Supports variable extraction (optional)
 * 4. Provides a control panel for model selection, template selection, etc.
 */

interface Props {
    /** Input box value */
    modelValue: string;
    /** Selected model */
    selectedModel: string;
    /** Panel title */
    label: string;
    /** Placeholder text */
    placeholder?: string;
    /** Model selection label */
    modelLabel: string;
    /** Template selection label */
    templateLabel?: string;
    /** Submit button text */
    buttonText: string;
    /** Loading text */
    loadingText: string;
    /** Whether loading */
    loading?: boolean;
    /** Whether disabled */
    disabled?: boolean;
    /** Whether to show the preview button */
    showPreview?: boolean;
    /** 🆕 Help tooltip text (shown on hover of the question mark icon next to the title) */
    helpText?: string;

    /** Whether to show the analyze button */
    showAnalyzeButton?: boolean;
    /** Whether the analyze button is loading */
    analyzeLoading?: boolean;

    /** 🆕 Whether to show the AI extract variables button */
    showExtractButton?: boolean;
    /** 🆕 Whether AI variable extraction is in progress */
    extracting?: boolean;

    /** 🆕 Whether to enable variable extraction */
    enableVariableExtraction?: boolean;
    /** 🆕 List of existing global variable names */
    existingGlobalVariables?: string[];
    /** 🆕 List of existing temporary variable names */
    existingTemporaryVariables?: string[];
    /** 🆕 List of system predefined variable names */
    predefinedVariables?: string[];
    /** 🆕 Map of global variable names to values */
    globalVariableValues?: Record<string, string>;
    /** 🆕 Map of temporary variable names to values */
    temporaryVariableValues?: Record<string, string>;
    /** 🆕 Map of predefined variable names to values */
    predefinedVariableValues?: Record<string, string>;

    /** 🆕 Test ID prefix (used to distinguish modes, such as 'basic-system', 'basic-user') */
    testIdPrefix?: string;
}

const props = withDefaults(defineProps<Props>(), {
    placeholder: "",
    templateLabel: "",
    loading: false,
    disabled: false,
    showPreview: false,
    helpText: "",
    showAnalyzeButton: false,
    analyzeLoading: false,
    showExtractButton: false,
    extracting: false,
    enableVariableExtraction: false,
    existingGlobalVariables: () => [],
    existingTemporaryVariables: () => [],
    predefinedVariables: () => [],
    globalVariableValues: () => ({}),
    temporaryVariableValues: () => ({}),
    predefinedVariableValues: () => ({}),
    testIdPrefix: "input-panel",
});

const emit = defineEmits<{
    "update:modelValue": [value: string];
    "update:selectedModel": [value: string];
    submit: [];
    analyze: [];
    configModel: [];
    "open-preview": [];
    /** 🆕 AI extract variables event */
    "extract-variables": [];
    /** 🆕 Variable extraction event */
    "variable-extracted": [
        data: {
            variableName: string;
            variableValue: string;
            variableType: "global" | "temporary";
        },
    ];
    /** 🆕 Add missing variable event */
    "add-missing-variable": [varName: string];
}>();

// Use the fullscreen composable
const { isFullscreen, fullscreenValue, openFullscreen } = useFullscreen(
    computed(() => props.modelValue),
    (value) => emit("update:modelValue", value),
);

// Handle the variable extraction event
const handleVariableExtracted = (data: {
    variableName: string;
    variableValue: string;
    variableType: "global" | "temporary";
}) => {
    emit("variable-extracted", data);
};

// Handle the add missing variable event
const handleAddMissingVariable = (varName: string) => {
    emit("add-missing-variable", varName);
};
</script>
