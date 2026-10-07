<template>
    <NModal
        v-model:show="localVisible"
        :mask-closable="!showEditor && !showImporter"
        preset="card"
        :title="props.title || t('variables.management.title')"
        size="huge"
        :segmented="{ content: true }"
        :style="modalStyle"
        @after-leave="handleClose"
    >
        <!-- Toolbar -->
        <NSpace justify="space-between">
            <NButton
                type="primary"
                @click="showAddVariable"
                :disabled="props.disabled || loading"
                :loading="props.loading"
                :size="buttonSize"
            >
                <template #icon>
                    <NIcon>
                        <svg viewBox="0 0 16 16" fill="currentColor">
                            <path
                                d="M8 2a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5A.5.5 0 018 2z"
                            />
                        </svg>
                    </NIcon>
                </template>
                {{ t("variables.management.addVariable") }}
            </NButton>

            <NSpace v-if="props.showImportExport !== false">
                <NButton
                    @click="showImportModal"
                    :disabled="props.disabled || props.readonly || loading"
                    :size="buttonSize"
                >
                    {{ t("variables.management.import") }}
                </NButton>

                <NButton
                    @click="showExportModal = true"
                    :disabled="props.disabled || loading"
                    :size="buttonSize"
                >
                    {{ t("variables.management.export") }}
                </NButton>
            </NSpace>
        </NSpace>
        <NDivider />

        <!-- Variable list - grouped display -->
        <NSpace vertical :size="16">
            <!-- Predefined variable group (collapsed by default: generally only custom variables need editing) -->
            <NCard
                v-if="predefinedVariables.length > 0"
                size="small"
                :content-style="isPredefinedExpanded ? undefined : 'padding: 0'"
            >
                <template #header>
                    <NSpace align="center">
                        <NText strong>{{ t("variables.predefined") }}</NText>
                        <NTag size="small" type="info">{{
                            t("variables.readonly")
                        }}</NTag>
                        <NTag size="small" type="default">{{
                            predefinedVariables.length
                        }}</NTag>
                    </NSpace>
                </template>
                <template #header-extra>
                    <NButton
                        size="small"
                        quaternary
                        @click="isPredefinedExpanded = !isPredefinedExpanded"
                        :title="
                            isPredefinedExpanded
                                ? t('common.collapse')
                                : t('common.expand')
                        "
                        :aria-label="
                            isPredefinedExpanded
                                ? t('common.collapse')
                                : t('common.expand')
                        "
                    >
                        <template #icon>
                            <NIcon>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path
                                        v-if="isPredefinedExpanded"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M5 15l7-7 7 7"
                                    />
                                    <path
                                        v-else
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M19 9l-7 7-7-7"
                                    />
                                </svg>
                            </NIcon>
                        </template>
                    </NButton>
                </template>

                <NDataTable
                    v-if="isPredefinedExpanded"
                    :columns="predefinedTableColumns"
                    :data="predefinedVariables"
                    :max-height="200"
                    :bordered="false"
                    size="small"
                    :pagination="false"
                />
            </NCard>

            <!-- Custom variable group -->
            <NCard size="small">
                <template #header>
                    <NSpace align="center">
                        <NText strong>{{ t("variables.custom") }}</NText>
                        <NTag size="small" type="success">{{
                            customVariables.length
                        }}</NTag>
                    </NSpace>
                </template>

                <!-- Custom variable table or empty state -->
                <div v-if="customVariables.length === 0">
                    <NEmpty :description="t('variables.addFirstVariable')">
                        <template #icon>
                            <NIcon size="48">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="1"
                                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                                    />
                                </svg>
                            </NIcon>
                        </template>
                        <template #default>
                            <NText>{{
                                t("variables.noCustomVariables")
                            }}</NText>
                        </template>
                    </NEmpty>
                </div>

                <NDataTable
                    v-else
                    :columns="customTableColumns"
                    :data="customVariables"
                    :max-height="300"
                    :bordered="false"
                    size="small"
                    :pagination="false"
                    :loading="props.loading || loading"
                />

                <!-- Quick add form -->
                <template #footer>
                    <NDivider />
                    <div>
                        <NText
                            strong
                            depth="1"
                            style="display: block; margin-bottom: 12px"
                        >
                            {{ t("variables.addNew") }}
                        </NText>
                        <NGrid cols="12" :x-gap="12" :y-gap="8">
                            <NGridItem span="4">
                                <NInput
                                    v-model:value="quickAddForm.name"
                                    :placeholder="
                                        t('variables.namePlaceholder')
                                    "
                                    size="small"
                                    :disabled="props.readonly || loading"
                                    @keyup.enter="quickAddVariable"
                                />
                            </NGridItem>
                            <NGridItem span="6">
                                <NInput
                                    v-model:value="quickAddForm.value"
                                    :placeholder="
                                        t('variables.valuePlaceholder')
                                    "
                                    size="small"
                                    :disabled="props.readonly || loading"
                                    @keyup.enter="quickAddVariable"
                                />
                            </NGridItem>
                            <NGridItem span="2">
                                <NButton
                                    @click="quickAddVariable"
                                    type="primary"
                                    size="small"
                                    :disabled="
                                        !canQuickAdd ||
                                        props.readonly ||
                                        loading
                                    "
                                    :loading="loading"
                                    block
                                >
                                    {{ t("variables.add") }}
                                </NButton>
                            </NGridItem>
                        </NGrid>
                    </div>
                </template>
            </NCard>
        </NSpace>

        <template #footer>
            <NSpace justify="space-between">
                <NText depth="3">{{
                    t("variables.management.totalCount", {
                        count: allVariables.length,
                    })
                }}</NText>
                <NSpace>
                    <NButton
                        v-if="!props.readonly"
                        type="primary"
                        @click="handleConfirm"
                        :disabled="props.disabled"
                        :loading="loading"
                    >
                        {{ t("common.confirm") }}
                    </NButton>
                    <NButton @click="handleCancel">
                        {{
                            props.readonly
                                ? t("common.close")
                                : t("common.cancel")
                        }}
                    </NButton>
                </NSpace>
            </NSpace>
        </template>

        <!-- Add/edit variable sub-dialog -->
        <VariableEditor
            v-model:show="showEditor"
            :variable="editingVariable"
            :existing-names="existingVariableNames"
            @save="onVariableSave"
            @cancel="onEditorCancel"
        />

        <!-- Import dialog -->
        <VariableImporter
            v-model:show="showImporter"
            @import="onVariablesImport"
        />

        <!-- Export dialog -->
        <NModal
            v-model:show="showExportModal"
            preset="card"
            :title="t('variables.management.exportTitle')"
            size="large"
            :segmented="{ content: true }"
            :style="{ width: '600px', maxWidth: '90vw' }"
            :mask-closable="!loading"
        >
            <NSpace vertical>
                <!-- Export format selection -->
                <div>
                    <NText strong style="display: block; margin-bottom: 12px">
                        {{ t("variables.management.exportFormat") }}
                    </NText>
                    <NRadioGroup v-model:value="exportFormat">
                        <NSpace>
                            <NRadioButton value="csv">CSV</NRadioButton>
                            <NRadioButton value="txt">TXT</NRadioButton>
                        </NSpace>
                    </NRadioGroup>
                </div>

                <!-- Export statistics -->
                <NCard size="small" embedded>
                    <NSpace justify="space-between" align="center">
                        <NText depth="2">{{
                            t("variables.management.exportInfo")
                        }}</NText>
                        <NTag type="info"
                            >{{ customVariables.length }}
                            {{ t("variables.management.variables") }}</NTag
                        >
                    </NSpace>
                </NCard>

                <!-- Preview area -->
                <div>
                    <NText strong style="display: block; margin-bottom: 12px">
                        {{ t("variables.management.exportPreview") }}
                    </NText>
                    <NInput
                        :value="getExportPreview()"
                        readonly
                        type="textarea"
                        :autosize="{ minRows: 8, maxRows: 12 }"
                        :input-props="{
                            style: 'font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,\'Liberation Mono\',\'Courier New\',monospace; font-size: 12px;',
                        }"
                    />
                </div>
            </NSpace>

            <template #footer>
                <NSpace justify="end">
                    <NButton
                        @click="showExportModal = false"
                        :disabled="loading"
                    >
                        {{ t("common.cancel") }}
                    </NButton>
                    <NButton
                        type="primary"
                        @click="executeExport"
                        :disabled="customVariables.length === 0 || loading"
                        :loading="loading"
                    >
                        {{ t("variables.management.download") }}
                    </NButton>
                </NSpace>
            </template>
        </NModal>
    </NModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, h } from 'vue'

import { useI18n } from "vue-i18n";
import {
    NModal,
    NButton,
    NSpace,
    NTag,
    NDataTable,
    NGrid,
    NGridItem,
    NInput,
    NCard,
    NRadioGroup,
    NRadioButton,
    NText,
    NEmpty,
    NDivider,
    NIcon,
    type DataTableColumns,
} from "naive-ui";
import { useResponsive } from "../../composables/ui/useResponsive";
import { useClipboard } from "../../composables/ui/useClipboard";
import type {
    VariableManagerModalProps,
} from "../../types/components";
import type { VariableSource } from "../../types/variable";
import type { VariableManagerHooks } from '../../composables/prompt/useVariableManager';
import type { VariableExportData, VariableImportOptions } from '@prompt-optimizer/core';
import VariableEditor from "./VariableEditor.vue";
import VariableImporter from "./VariableImporter.vue";

const { t } = useI18n();
const { copyText } = useClipboard();

interface VariableRow {
    name: string;
    value: string;
    source: VariableSource;
}

// Responsive config
const {
    modalWidth,
    buttonSize: responsiveButtonSize,
    shouldUseCompactMode,
} = useResponsive();

// Use the standardized Props interface, but stay backward compatible
interface Props extends Partial<VariableManagerModalProps> {
    visible: boolean;
    variableManager: VariableManagerHooks | null;
    focusVariable?: string;
}

const props = withDefaults(defineProps<Props>(), {
    size: "medium",
    showImportExport: true,
    readonly: false,
    disabled: false,
    loading: false,
    title: undefined,
    width: "90vw",
});

// Use the standardized Events interface
const emit = defineEmits<{
    (event: "update:visible", visible: boolean): void;
    (event: "update:variables", variables: Record<string, string>): void;
    (
        event: "variableChange",
        name: string,
        value: string,
        action: "add" | "update" | "delete",
    ): void;
    (event: "import", data: VariableExportData, options?: VariableImportOptions): void;
    (event: "export"): void;
    (event: "confirm", variables: Record<string, string>): void;
    (event: "cancel"): void;
    (event: "close"): void;
    (event: "ready"): void;
    (event: "error", error: Error): void;
}>();

// Two-way binding of the local visible state
const localVisible = computed({
    get: () => props.visible,
    set: (value: boolean) => emit("update:visible", value),
});

// State management
const loading = ref(false);
const showEditor = ref(false);
const showImporter = ref(false);
const showExportModal = ref(false);
const editingVariable = ref<VariableRow | null>(null);
const exportFormat = ref<"csv" | "txt">("csv");

// Collapse the predefined variable list by default (rarely needs viewing/editing)
const isPredefinedExpanded = ref(false);

// Inline editing state
const editingRowKey = ref<string | null>(null);
const editingValue = ref("");
const quickAddForm = ref({
    name: "",
    value: "",
});

// Computed properties
const modalStyle = computed(() => ({
    width: modalWidth.value,
    maxWidth: shouldUseCompactMode.value ? "95vw" : "1200px",
}));

const buttonSize = computed(() => {
    return props.size === "small" || responsiveButtonSize.value === "small"
        ? "small"
        : responsiveButtonSize.value;
});

watch(
    () => localVisible.value,
    (visible) => {
        if (visible) {
            isPredefinedExpanded.value = false;
        }
    },
);

const allVariables = computed<VariableRow[]>(() => {
    const manager = props.variableManager?.variableManager.value;
    if (!manager) return [];

    // Get all variables and build Variable objects
    try {
        const variables = manager.resolveAllVariables();
        return Object.entries(variables).map(([name, value]) => ({
            name,
            value,
            source: manager.getVariableSource(name),
        }));
    } catch (error: unknown) {
        console.error(
            "[VariableManagerModal] Failed to resolve variables:",
            error,
        );
        return [];
    }
});

const existingVariableNames = computed(() => {
    return allVariables.value.map((v) => v.name);
});

// Group variables
const predefinedVariables = computed(() => {
    return allVariables.value.filter((v) => v.source === "predefined");
});

const customVariables = computed(() => {
    return allVariables.value.filter((v) => v.source === "custom");
});

// Predefined variable table column config (read-only)
const predefinedTableColumns = computed<DataTableColumns<VariableRow>>(() => [
    {
        title: t("variables.management.variableName"),
        key: "name",
        width: 200,
        render: (row: VariableRow) => {
            return h(
                NTag,
                { size: "small", type: "info" },
                { default: () => formatVariableName(row.name) },
            );
        },
    },
    {
        title: t("variables.management.description"),
        key: "description",
        ellipsis: {
            tooltip: true,
        },
        render: (row: VariableRow) => {
            const descriptionKey = `variables.predefinedDescriptions.${row.name}`;
            const description = t(descriptionKey);
            return h(
                NText,
                { depth: 2 },
                {
                    default: () =>
                        description !== descriptionKey
                            ? description
                            : row.name + " description",
                },
            );
        },
    },
    {
        title: t("common.actions"),
        key: "actions",
        width: 80,
        render: (row: VariableRow) => {
            return h(
                NButton,
                {
                    size: "small",
                    quaternary: true,
                    title: t("common.copy"),
                    onClick: () => copyVariableName(row.name),
                },
                {
                    icon: () =>
                        h(NIcon, null, {
                            default: () =>
                                h(
                                    "svg",
                                    {
                                        width: "16",
                                        height: "16",
                                        viewBox: "0 0 16 16",
                                        fill: "currentColor",
                                    },
                                    [
                                        h("path", {
                                            d: "M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z",
                                        }),
                                        h("path", {
                                            d: "M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z",
                                        }),
                                    ],
                                ),
                        }),
                },
            );
        },
    },
]);

// Custom variable table column config (supports inline editing)
const customTableColumns = computed<DataTableColumns<VariableRow>>(() => [
    {
        title: t("variables.management.variableName"),
        key: "name",
        width: 200,
        render: (row: VariableRow) => {
            return h(
                NTag,
                { size: "small", type: "success" },
                { default: () => formatVariableName(row.name) },
            );
        },
    },
    {
        title: t("variables.management.value"),
        key: "value",
        ellipsis: {
            tooltip: true,
        },
        render: (row: VariableRow) => {
            // If the current row is being edited
            if (editingRowKey.value === row.name) {
                return h(NInput, {
                    value: editingValue.value,
                    size: "small",
                    autofocus: true,
                    onUpdateValue: (val: string) => (editingValue.value = val),
                    onKeydown: (e: KeyboardEvent) => {
                        if (e.key === "Enter") {
                            saveInlineEdit(row.name);
                        } else if (e.key === "Escape") {
                            cancelInlineEdit();
                        }
                    },
                    onBlur: () => saveInlineEdit(row.name),
                });
            }

            // Normal display state; click to edit
            return h(
                "span",
                {
                    class: "cursor-pointer",
                    onClick: () => startInlineEdit(row.name, row.value),
                },
                truncateValue(row.value),
            );
        },
    },
    {
        title: t("common.actions"),
        key: "actions",
        width: 160,
        render: (row: VariableRow) => {
            return h(
                NSpace,
                { size: "small" },
                {
                    default: () => [
                        h(
                            NButton,
                            {
                                size: "small",
                                quaternary: true,
                                title: t("common.copy"),
                                onClick: () => copyVariableName(row.name),
                            },
                            {
                                icon: () =>
                                    h(NIcon, null, {
                                        default: () =>
                                            h(
                                                "svg",
                                                {
                                                    width: "16",
                                                    height: "16",
                                                    viewBox: "0 0 16 16",
                                                    fill: "currentColor",
                                                },
                                                [
                                                    h("path", {
                                                        d: "M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z",
                                                    }),
                                                    h("path", {
                                                        d: "M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z",
                                                    }),
                                                ],
                                            ),
                                    }),
                            },
                        ),
                        h(
                            NButton,
                            {
                                size: "small",
                                quaternary: true,
                                title: t("common.edit"),
                                onClick: () => editVariable(row),
                            },
                            {
                                icon: () =>
                                    h(NIcon, null, {
                                        default: () =>
                                            h(
                                                "svg",
                                                {
                                                    width: "16",
                                                    height: "16",
                                                    viewBox: "0 0 16 16",
                                                    fill: "currentColor",
                                                },
                                                [
                                                    h("path", {
                                                        d: "M12.146.146a.5.5 0 01.708 0l3 3a.5.5 0 010 .708L9.708 9.708a.5.5 0 01-.168.11l-5 2a.5.5 0 01-.65-.65l2-5a.5.5 0 01.11-.168L12.146.146z",
                                                    }),
                                                ],
                                            ),
                                    }),
                            },
                        ),
                        h(
                            NButton,
                            {
                                size: "small",
                                quaternary: true,
                                type: "error",
                                title: t("common.delete"),
                                onClick: () => deleteVariable(row.name),
                            },
                            {
                                icon: () =>
                                    h(NIcon, null, {
                                        default: () =>
                                            h(
                                                "svg",
                                                {
                                                    width: "16",
                                                    height: "16",
                                                    viewBox: "0 0 16 16",
                                                    fill: "currentColor",
                                                },
                                                [
                                                    h("path", {
                                                        d: "M6.5 1h3a.5.5 0 01.5.5v1H6v-1a.5.5 0 01.5-.5zM11 2.5v-1A1.5 1.5 0 009.5 0h-3A1.5 1.5 0 005 1.5v1H2.506a.58.58 0 000 1.152H3.5l.5 9A1.5 1.5 0 005.5 14h5a1.5 1.5 0 001.5-1.348l.5-9h.994a.58.58 0 000-1.152H11z",
                                                    }),
                                                ],
                                            ),
                                    }),
                            },
                        ),
                    ],
                },
            );
        },
    },
]);

// Utility functions
const truncateValue = (value: string, maxLength: number = 60): string => {
    if (value.length <= maxLength) return value;
    return value.substring(0, maxLength) + "...";
};

const formatVariableName = (name: string): string => {
    return `{{${name}}}`;
};

// Copy variable name feature
const copyVariableName = async (name: string) => {
    try {
        const formattedName = formatVariableName(name);
        await copyText(formattedName);
        console.log(
            `[VariableManagerModal] Copied variable name: ${formattedName}`,
        );
    } catch (error) {
        console.error(
            "[VariableManagerModal] Failed to copy variable name:",
            error,
        );
    }
};

const showAddVariable = () => {
    editingVariable.value = null;
    showEditor.value = true;
};

const editVariable = (variable: VariableRow) => {
    editingVariable.value = variable;
    showEditor.value = true;
};

// Inline editing handler functions
const startInlineEdit = (rowKey: string, currentValue: string) => {
    editingRowKey.value = rowKey;
    editingValue.value = currentValue;
};

const saveInlineEdit = async (rowKey: string) => {
    if (!props.variableManager?.variableManager.value) {
        cancelInlineEdit();
        return;
    }

    const trimmedValue = editingValue.value.trim();
    if (!trimmedValue) {
        cancelInlineEdit();
        return;
    }

    try {
        loading.value = true;
        props.variableManager.addVariable(rowKey, trimmedValue);

        // Clear the editing state
        editingRowKey.value = null;
        editingValue.value = "";

        // Trigger the change event
        handleVariableChange(rowKey, trimmedValue, "update");
    } catch (error: unknown) {
        console.error(
            "[VariableManagerModal] Failed to save inline edit:",
            error,
        );
        emit("error", error instanceof Error ? error : new Error(String(error)));
    } finally {
        loading.value = false;
    }
};

const cancelInlineEdit = () => {
    editingRowKey.value = null;
    editingValue.value = "";
};

// Quick add feature
const quickAddVariable = async () => {
    if (!props.variableManager?.variableManager.value) return;
    if (!quickAddForm.value.name.trim() || !quickAddForm.value.value.trim())
        return;

    try {
        loading.value = true;
        const name = quickAddForm.value.name.trim();
        const value = quickAddForm.value.value.trim();

        props.variableManager.addVariable(name, value);

        // Clear the form
        quickAddForm.value.name = "";
        quickAddForm.value.value = "";

        // Trigger the change event
        handleVariableChange(name, value, "add");
    } catch (error: unknown) {
        console.error(
            "[VariableManagerModal] Failed to quick add variable:",
            error,
        );
        emit("error", error instanceof Error ? error : new Error(String(error)));
    } finally {
        loading.value = false;
    }
};

// Validate the quick add form
const canQuickAdd = computed(() => {
    const name = quickAddForm.value.name.trim();
    const value = quickAddForm.value.value.trim();

    if (!name || !value) return false;

    // Validate the variable name format
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) return false;

    // Check whether it duplicates a predefined variable name (normalized)
    if (
        props.variableManager?.variableManager.value?.isPredefinedVariable(name)
    )
        return false;

    // Check whether it duplicates an existing variable name
    if (existingVariableNames.value.includes(name)) return false;

    return true;
});

const deleteVariable = async (name: string) => {
    if (!props.variableManager?.variableManager.value) return;
    if (props.readonly) return;

    if (confirm(t("variables.management.deleteConfirm", { name }))) {
        try {
            loading.value = true;
            props.variableManager.deleteVariable(name);

            // Send the delete event
            handleVariableChange(name, "", "delete");
        } catch (error: unknown) {
            console.error(
                "[VariableManagerModal] Failed to delete variable:",
                error,
            );
            emit("error", error instanceof Error ? error : new Error(String(error)));
        } finally {
            loading.value = false;
        }
    }
};

const onVariableSave = async (variable: { name: string; value: string }) => {
    if (!props.variableManager?.variableManager.value) return;

    try {
        loading.value = true;
        const isUpdate = allVariables.value.some(
            (v) => v.name === variable.name,
        );

        props.variableManager.addVariable(variable.name, variable.value);
        showEditor.value = false;
        editingVariable.value = null;

        // Send the standardized change event
        handleVariableChange(
            variable.name,
            variable.value,
            isUpdate ? "update" : "add",
        );
    } catch (error: unknown) {
        console.error("[VariableManagerModal] Failed to save variable:", error);
        emit("error", error instanceof Error ? error : new Error(String(error)));
    } finally {
        loading.value = false;
    }
};

const onEditorCancel = () => {
    showEditor.value = false;
    editingVariable.value = null;
};

const showImportModal = () => {
    showImporter.value = true;
};

const onVariablesImport = (variables: Record<string, string>) => {
    if (!props.variableManager) return;

    try {
        loading.value = true;
        Object.entries(variables).forEach(([name, value]) => {
            props.variableManager!.addVariable(name, value);
        });
        showImporter.value = false;

        // Send the standardized event
        emit("import", {
            version: "1.0",
            exportedAt: new Date().toISOString(),
            variables: Object.entries(variables).map(([name, value]) => ({
                name,
                value,
                type: "custom" as const,
                required: false,
            })),
        });
    } catch (error: unknown) {
        console.error(
            "[VariableManagerModal] Failed to import variables:",
            error,
        );
        emit("error", error instanceof Error ? error : new Error(String(error)));
    } finally {
        loading.value = false;
    }
};

// Newly added standardized event handler function
const handleClose = () => {
    emit("close");
    emit("cancel");
};

const handleConfirm = () => {
    if (!props.variableManager) return;

    const currentVariables =
        props.variableManager.variableManager.value?.resolveAllVariables() ||
        {};
    emit("confirm", currentVariables);
    emit("update:variables", currentVariables);
    localVisible.value = false;
};

const handleCancel = () => {
    emit("cancel");
    localVisible.value = false;
};

// Enhanced variable change event
const handleVariableChange = (
    name: string,
    value: string,
    action: "add" | "update" | "delete",
) => {
    emit("variableChange", name, value, action);

    // Also send the update:variables event
    if (props.variableManager) {
        const allVars =
            props.variableManager.variableManager.value?.resolveAllVariables() ||
            {};
        emit("update:variables", allVars);
    }
};

// Watch visible changes and handle the focused variable
watch(
    () => props.visible,
    (visible) => {
        if (visible && props.focusVariable) {
            // If a variable to focus is specified, open the editor automatically
            const targetVariable = allVariables.value.find(
                (v) => v.name === props.focusVariable,
            );
            if (targetVariable) {
                editingVariable.value = targetVariable;
                showEditor.value = true;
            } else {
                // If the variable does not exist, create a new variable
                editingVariable.value = {
                    name: props.focusVariable,
                    value: "",
                    source: "custom",
                };
                showEditor.value = true;
            }
        }

        // Send the ready event
        if (visible) {
            emit("ready");
        }
    },
);

// Export preview feature
const getExportPreview = (): string => {
    if (!props.variableManager?.variableManager.value) return "";

    // Use the existing customVariables computed property and convert it to an object format
    const customVarsObject = customVariables.value.reduce(
        (acc, variable) => {
            acc[variable.name] = variable.value;
            return acc;
        },
        {} as Record<string, string>,
    );

    switch (exportFormat.value) {
        case "csv": {
            const csvLines = ["name,value"];
            for (const [name, value] of Object.entries(customVarsObject)) {
                csvLines.push(`"${name}","${value.replace(/"/g, '""')}"`);
            }
            return csvLines.join("\n");
        }

        case "txt": {
            const txtLines: string[] = [];
            for (const [name, value] of Object.entries(customVarsObject)) {
                txtLines.push(`${name}=${value}`);
            }
            return txtLines.join("\n");
        }

        default: {
            return "";
        }
    }
};

// Perform the export
const executeExport = () => {
    if (!props.variableManager?.variableManager.value) return;

    try {
        loading.value = true;
        const content = getExportPreview();
        const timestamp = new Date()
            .toISOString()
            .replace(/[:.]/g, "-")
            .replace("T", "_")
            .split(".")[0];
        const fileName = `variables-${timestamp}.${exportFormat.value}`;

        let mimeType: string;
        switch (exportFormat.value) {
            case "csv": {
                mimeType = "text/csv";
                break;
            }
            case "txt": {
                mimeType = "text/plain";
                break;
            }
            default: {
                mimeType = "text/plain";
            }
        }

        // Send the export event
        emit("export");

        // Perform the actual export
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);

        // Close the dialog
        showExportModal.value = false;
    } catch (error: unknown) {
        console.error(
            "[VariableManagerModal] Failed to export variables:",
            error,
        );
        emit("error", error instanceof Error ? error : new Error(String(error)));
    } finally {
        loading.value = false;
    }
};

// Deleted the duplicate onVariableSave function to avoid conflicts
</script>

<style scoped>
/* Pure Naive UI implementation - no custom theme CSS needed */
</style>
