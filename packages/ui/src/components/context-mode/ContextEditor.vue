<template>
    <NModal
        v-model:show="localVisible"
        preset="card"
        :title="modalTitle"
        :style="modalStyle"
        size="huge"
        :bordered="false"
        :segmented="false"
        :mask-closable="true"
        :class="accessibilityClasses"
        role="dialog"
        :aria-label="aria.getLabel('contextEditor')"
        :aria-describedby="aria.getDescription('contextEditor')"
        aria-modal="true"
        @update:show="handleVisibilityChange"
        @after-enter="handleModalOpen"
        @after-leave="handleModalClose"
    >
        <!-- Top toolbar -->
        <template #header-extra>
            <NSpace
                v-if="!onlyShowTab"
                :size="buttonSize"
                role="toolbar"
                :aria-label="aria.getLabel('statisticsToolbar')"
            >
                <!-- Statistics -->
                <NTag
                    :size="tagSize"
                    type="info"
                    role="status"
                    :aria-label="
                        aria.getLabel(
                            'messageCount',
                            t('contextEditor.messageCount', { count: localState.messages.length }),
                        )
                    "
                >
                    {{ t('contextEditor.messageCount', { count: localState.messages.length }) }}
                </NTag>
                <NTag
                    v-if="variableCount > 0"
                    :size="tagSize"
                    type="success"
                    role="status"
                    :aria-label="
                        aria.getLabel('variableCount', t('contextEditor.variableCountLabel', { count: variableCount }))
                    "
                >
                    {{ t('contextEditor.variableCountLabel', { count: variableCount }) }}
                </NTag>
                <NTag
                    v-if="localState.tools.length > 0"
                    :size="tagSize"
                    type="primary"
                    role="status"
                    :aria-label="
                        aria.getLabel(
                            'toolCount',
                            t('contextEditor.toolCountLabel', { count: localState.tools.length }),
                        )
                    "
                >
                    {{ t('contextEditor.toolCountLabel', { count: localState.tools.length }) }}
                </NTag>
            </NSpace>
        </template>

        <!-- Empty state -->
        <NEmpty
            v-if="localState.messages.length === 0"
            :description="t('contextEditor.noMessages')"
            role="status"
            :aria-label="aria.getLabel('emptyMessages')"
        >
            <template #icon>
                <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1"
                    role="img"
                    :aria-label="aria.getLabel('messageIcon')"
                >
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
            </template>
            <template #extra>
                <NButton
                    @click="addMessage"
                    :size="buttonSize"
                    type="primary"
                    :aria-label="aria.getLabel('addFirstMessage')"
                    :aria-describedby="aria.getDescription('addFirstMessage')"
                >
                    {{ t("contextEditor.addFirstMessage") }}
                </NButton>
            </template>
        </NEmpty>

        <!-- Message list -->
        <NScrollbar v-else :style="scrollbarStyle">
            <NSpace vertical :size="12" style="padding-right: 12px;">
                <NCard
                    v-for="(message, index) in localState.messages"
                    :key="`message-${index}`"
                    :size="cardSize"
                    embedded
                    :class="{ 'focused-card': focusedIndex === index }"
                    :ref="messageCardRef(index)"
                >
                    <template #header>
                        <NSpace justify="space-between" align="center">
                            <NSpace align="center" :size="4">
                                <NTag :size="tagSize" round>{{ index + 1 }}</NTag>
                                <NSelect
                                    v-model:value="message.role"
                                    :size="size"
                                    style="width: 100px"
                                    :options="roleOptions"
                                    :disabled="disabled"
                                    @update:value="handleMessageUpdate(index, message)"
                                />
                                <NTag
                                    v-if="getMessageVariables(message.content).detected.length > 0"
                                    :size="tagSize"
                                    type="info"
                                >
                                    {{ t('contextEditor.variableDetected', { count: getMessageVariables(message.content).detected.length }) }}
                                </NTag>
                                <NTag
                                    v-if="getMessageVariables(message.content).missing.length > 0"
                                    :size="tagSize"
                                    type="warning"
                                >
                                    {{ t('contextEditor.missingVariableLabel', { count: getMessageVariables(message.content).missing.length }) }}
                                </NTag>
                            </NSpace>
                            <NSpace :size="4">
                                <NButton
                                    @click="togglePreview(index)"
                                    :size="buttonSize"
                                    :type="previewMode.get(index) ? 'primary' : 'default'"
                                    quaternary
                                    circle
                                    :title="previewMode.get(index) ? t('common.edit') : t('common.preview')"
                                >
                                    <template #icon>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    </template>
                                </NButton>
                                <NButton
                                    v-if="index > 0"
                                    @click="moveMessage(index, -1)"
                                    :size="buttonSize"
                                    quaternary
                                    circle
                                    :title="t('common.moveUp')"
                                    :disabled="disabled"
                                >
                                    <template #icon>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                                        </svg>
                                    </template>
                                </NButton>
                                <NButton
                                    v-if="index < localState.messages.length - 1"
                                    @click="moveMessage(index, 1)"
                                    :size="buttonSize"
                                    quaternary
                                    circle
                                    :title="t('common.moveDown')"
                                    :disabled="disabled"
                                >
                                    <template #icon>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </template>
                                </NButton>
                                <NButton
                                    @click="deleteMessage(index)"
                                    :size="buttonSize"
                                    quaternary
                                    circle
                                    type="error"
                                    :title="t('common.delete')"
                                    :disabled="disabled || localState.messages.length <= 1"
                                >
                                    <template #icon>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </template>
                                </NButton>
                            </NSpace>
                        </NSpace>
                    </template>
                    <VariableAwareInput
                        v-if="!previewMode.get(index)"
                        :model-value="message.content"
                        @update:model-value="handleMessageUpdate(index, { ...message, content: $event })"
                        :placeholder="getPlaceholderText(message.role)"
                        :autosize="{ minRows: 1, maxRows: 20 }"
                        :disabled="disabled"
                        :existing-global-variables="Object.keys(aggregatedVars.variablesBySource.value.global)"
                        :existing-temporary-variables="Object.keys(aggregatedVars.variablesBySource.value.temporary)"
                        :predefined-variables="Object.keys(aggregatedVars.variablesBySource.value.predefined)"
                        :global-variable-values="aggregatedVars.variablesBySource.value.global"
                        :temporary-variable-values="aggregatedVars.variablesBySource.value.temporary"
                        :predefined-variable-values="aggregatedVars.variablesBySource.value.predefined"
                        @variable-extracted="handleVariableExtracted"
                        @add-missing-variable="handleCreateVariableAndOpenManager"
                    />
                    <NText v-else style="white-space: pre-wrap; word-break: break-word;">
                        {{ replaceVariables(message.content) }}
                    </NText>
                </NCard>

                <!-- Add message button -->
                <NButton
                    @click="addMessage"
                    :size="buttonSize"
                    dashed
                    type="primary"
                    :disabled="disabled"
                >
                    <template #icon>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                    </template>
                    {{ t("contextEditor.addMessage") }}
                </NButton>
            </NSpace>
        </NScrollbar>

        <!-- Bottom action bar -->
        <template #action>
            <NSpace justify="space-between">
                <NSpace>
                    <!-- Import/export buttons -->
                    <NButton
                        @click="handleImport"
                        :size="buttonSize"
                        secondary
                        :disabled="disabled || loading"
                    >
                        <template #icon>
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                                />
                            </svg>
                        </template>
                        {{ t("common.import") }}
                    </NButton>

                    <NButton
                        @click="handleExport"
                        :size="buttonSize"
                        secondary
                        :disabled="
                            disabled ||
                            loading ||
                            (localState.messages.length === 0 &&
                                localState.tools.length === 0)
                        "
                    >
                        <template #icon>
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                />
                            </svg>
                        </template>
                        {{ t("common.export") }}
                    </NButton>
                </NSpace>

                <NSpace>
                    <NButton
                        @click="handleCancel"
                        :size="buttonSize"
                        :disabled="loading"
                    >
                        {{ t("common.cancel") }}
                    </NButton>
                    <NButton
                        @click="handleSave"
                        :size="buttonSize"
                        type="primary"
                        :loading="loading"
                    >
                        {{ t("common.save") }}
                    </NButton>
                </NSpace>
            </NSpace>
        </template>
    </NModal>

    <!-- Import dialog -->
    <ImportExportDialog
        v-model:visible="showImportDialog"
        mode="import"
        :messages="[]"
        @import-success="handleImportSuccess"
        @export-error="handleExportError"
    />

    <!-- Export dialog -->
    <ImportExportDialog
        v-model:visible="showExportDialog"
        mode="export"
        :messages="localState.messages"
        :tools="localState.tools"
        @export-success="handleExportSuccess"
        @export-error="handleExportError"
    />

    <!-- Variable edit dialog -->
    <NModal
        v-model:show="variableEditState.show"
        preset="card"
        :title="
            variableEditState.isEditing
                ? t('contextEditor.editVariable')
                : t('contextEditor.addVariable')
        "
        style="width: 500px"
        :mask-closable="false"
    >
        <NSpace vertical>
            <!-- Variable name -->
            <div>
                <label class="block text-sm font-medium mb-2">{{
                    t("contextEditor.variableName")
                }}</label>
                <NInput
                    v-model:value="variableEditState.name"
                    :placeholder="t('contextEditor.variableNamePlaceholder')"
                    :disabled="
                        variableEditState.isEditing ||
                        variableEditState.isFromMissing
                    "
                    @keydown.enter="saveVariable"
                />
                <NText
                    depth="3"
                    class="text-xs mt-1"
                    v-if="isPredefinedVariable(variableEditState.name)"
                >
                    <span class="text-red-500">{{
                        t("contextEditor.predefinedVariableWarning")
                    }}</span>
                </NText>
            </div>

            <!-- Variable type -->
            <div>
                <label class="block text-sm font-medium mb-2">{{
                    t("contextEditor.variableType")
                }}</label>
                <NRadioGroup v-model:value="variableEditState.type">
                    <NSpace>
                        <NRadio value="temporary">
                            <NSpace :size="4" align="center">
                                <span>{{ t("contextEditor.variableSourceLabels.temporary") }}</span>
                                <NText depth="3" class="text-xs">
                                    {{ t("contextEditor.temporaryVariableHint") }}
                                </NText>
                            </NSpace>
                        </NRadio>
                        <NRadio value="global">
                            <NSpace :size="4" align="center">
                                <span>{{ t("contextEditor.variableSourceLabels.global") }}</span>
                                <NText depth="3" class="text-xs">
                                    {{ t("contextEditor.globalVariableHint") }}
                                </NText>
                            </NSpace>
                        </NRadio>
                    </NSpace>
                </NRadioGroup>
            </div>

            <!-- Variable value -->
            <div>
                <label class="block text-sm font-medium mb-2">{{
                    t("contextEditor.variableValue")
                }}</label>
                <NInput
                    ref="variableValueInputRef"
                    v-model:value="variableEditState.value"
                    type="textarea"
                    :placeholder="t('contextEditor.variableValuePlaceholder')"
                    :autosize="{ minRows: 3, maxRows: 8 }"
                    @keydown.ctrl.enter="saveVariable"
                />
            </div>
        </NSpace>

        <template #action>
            <NSpace justify="end">
                <NButton @click="cancelVariableEdit" :size="buttonSize">
                    {{ t("common.cancel") }}
                </NButton>
                <NButton
                    @click="saveVariable"
                    type="primary"
                    :size="buttonSize"
                    :disabled="
                        !variableEditState.name.trim() ||
                        isPredefinedVariable(variableEditState.name)
                    "
                >
                    {{
                        variableEditState.isEditing
                            ? t("common.save")
                            : t("common.add")
                    }}
                </NButton>
            </NSpace>
        </template>
    </NModal>

    <!-- Live region for screen readers -->
    <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        class="sr-only"
        v-if="liveRegionMessage"
    >
        {{ liveRegionMessage }}
    </div>

    <!-- Assertive live region -->
    <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        class="sr-only"
        v-if="isAccessibilityMode && announcements.length > 0"
    >
        {{ announcements[announcements.length - 1] }}
    </div>
</template>

<script setup lang="ts">
import {
    ref,
    computed,
    watch,
    shallowRef,
    nextTick,
    type ComponentPublicInstance,
    type VNodeRef,
} from 'vue'

import { useI18n } from "vue-i18n";
import {
    NModal,
    NCard,
    NButton,
    NSpace,
    NTag,
    NEmpty,
    NScrollbar,
    NInput,
    NSelect,
    NText,
    NRadioGroup,
    NRadio,
} from "naive-ui";
import { useResponsive } from "../../composables/ui/useResponsive";
import { usePerformanceMonitor } from "../../composables/performance/usePerformanceMonitor";
import { useDebounceThrottle } from '../../composables/performance/useDebounceThrottle';
import { useAccessibility } from "../../composables/accessibility/useAccessibility";
import { useToast } from "../../composables/ui/useToast";
import { useTemporaryVariables } from '../../composables/variable/useTemporaryVariables';
import { VariableAwareInput } from "../variable-extraction";
import ImportExportDialog from './ImportExportDialog.vue';
import { useAggregatedVariables } from '../../composables/variable/useAggregatedVariables';
import type {
    ContextEditorProps,
} from "../../types/components";
import type {
    ContextEditorState,
    ConversationMessage,
    ToolDefinition,
} from "@prompt-optimizer/core";
import {
    PREDEFINED_VARIABLES,
    type PredefinedVariable,
} from "../../types/variable";

const { t } = useI18n();
const toast = useToast();

// Performance monitoring
const { recordUpdate } = usePerformanceMonitor("ContextEditor");

// Debounce/throttle
const { debounce, throttle, batchExecute } = useDebounceThrottle();

// Accessibility support
const {
    aria,
    announce,
    accessibilityClasses,
    isAccessibilityMode,
    liveRegionMessage,
    announcements,
} = useAccessibility("ContextEditor");

// Props and Events (must be defined first because later code uses them)
const props = withDefaults(
    defineProps<ContextEditorProps>(),
    {
        disabled: false,
        readonly: false,
        size: "medium",
        visible: false,
        showToolManager: true,
        optimizationMode: "system",
        title: "",
        width: "90vw",
        height: "85vh",
        defaultTab: "messages",
        onlyShowTab: undefined,
    },
);

const emit = defineEmits({
    "update:visible": (visible: boolean) => typeof visible === "boolean",
    "update:state": (state: ContextEditorState) => !!state,
    "update:tools": (tools: ToolDefinition[]) => Array.isArray(tools),
    contextChange: (messages: ConversationMessage[], variables: Record<string, string>) =>
        Array.isArray(messages) && !!variables,
    toolChange: (tools: ToolDefinition[], action: "add" | "update" | "delete", index?: number) =>
        Array.isArray(tools) &&
        (action === "add" || action === "update" || action === "delete") &&
        (index === undefined || typeof index === "number"),
    save: (context: { messages: ConversationMessage[]; variables: Record<string, string>; tools: ToolDefinition[] }) =>
        !!context,
    cancel: () => true,
    previewToggle: (enabled: boolean) => typeof enabled === "boolean",
    openVariableManager: (focusVariable?: string) =>
        focusVariable === undefined || typeof focusVariable === "string",
    createVariable: (name: string, defaultValue?: string) =>
        typeof name === "string" && (defaultValue === undefined || typeof defaultValue === "string"),
});

// Temporary variable management
const tempVars = useTemporaryVariables();

// Global variable management
// Receive the variableManager instance from props to keep data in sync with the global variable manager
if (!props.variableManager) {
    throw new Error('[ContextEditor] Missing required prop: variableManager. ContextEditor must receive a variableManager instance from parent component.');
}

const variableManager = props.variableManager;

// Aggregated variables (including the three layers: predefined, global, temporary)
const aggregatedVars = useAggregatedVariables(variableManager);

// Responsive config
const {
    modalWidth,
    buttonSize: responsiveButtonSize,
    isMobile,
} = useResponsive();

// State management - use performance optimizations
const loading = ref(false);
const activeTab = ref("messages");
const localVisible = ref(props.visible);

// Import/export dialog state
const showImportDialog = ref(false);
const showExportDialog = ref(false);

// Variable value input ref (used for auto-focus)
type FocusableInput = { focus: () => void };
const variableValueInputRef = ref<FocusableInput | null>(null);

const isPredefinedVariable = (name: string): name is PredefinedVariable => {
    return (PREDEFINED_VARIABLES as readonly string[]).includes(name);
};

// Use shallowRef to optimize deep objects
// Note: variables have been migrated to the management of useTemporaryVariables() and useVariableManager()
const localState = shallowRef<ContextEditorState>({
    messages: [],
    tools: [],
    showVariablePreview: true,
    showToolManager: props.showToolManager,
    mode: "edit",
});

// Preview mode control - use a Map to optimize
const previewMode = shallowRef<Map<number, boolean>>(new Map());

// Batch state updates
const batchStateUpdate = batchExecute((updates: Array<() => void>) => {
    updates.forEach((update) => update());
    recordUpdate();
}, 16); // Use 16ms batching to match 60fps

// Computed properties
const buttonSize = computed(() => {
    return responsiveButtonSize.value;
});

const tagSize = computed(() => {
    const sizeMap = {
        small: "small",
        medium: "small",
        large: "medium",
    } as const;
    return sizeMap[responsiveButtonSize.value] || "small";
});

// Tab display control logic - config-driven
type TabName = 'messages' | 'variables' | 'tools';

// Default tab visibility config (ContextEditor is only used in Context System mode)
// Variable management was removed; the standalone VariableManagerModal is used
// Tool management was removed; the standalone ToolManagerModal is used
const TAB_VISIBILITY_CONFIG: Record<TabName, () => boolean> = {
    messages: () => true,
    variables: () => false, // Variables tab removed
    tools: () => false, // Tools tab removed; the standalone ToolManagerModal is used
};

// Generic tab visibility computation function
const createTabVisibility = (tabName: TabName) => computed(() => {
    // If onlyShowTab is specified, only show when the value matches
    if (props.onlyShowTab) {
        return props.onlyShowTab === tabName;
    }
    // Otherwise use the configured default visibility rules
    return TAB_VISIBILITY_CONFIG[tabName]();
});

// Visibility of each tab
const showMessagesTab = createTabVisibility('messages');
const showVariablesTab = createTabVisibility('variables');
const showToolsTab = createTabVisibility('tools');

const resolveDefaultTab = (): string => {
    const candidate = props.onlyShowTab || props.defaultTab;
    const visibilityMap: Record<string, boolean> = {
        messages: showMessagesTab.value,
        variables: showVariablesTab.value,
        tools: showToolsTab.value,
    };
    if (candidate && visibilityMap[candidate]) {
        return candidate;
    }
    const preferenceOrder: Array<keyof typeof visibilityMap> = [
        "messages",
        "variables",
        "tools",
    ];
    for (const key of preferenceOrder) {
        if (visibilityMap[key]) return key;
    }
    return "messages";
};

activeTab.value = resolveDefaultTab();

const cardSize = computed(() => {
    const sizeMap = {
        small: "small",
        medium: "small",
        large: "medium",
    } as const;
    return sizeMap[responsiveButtonSize.value] || "small";
});

const modalStyle = computed(() => ({
    width: modalWidth.value,
    height: isMobile.value ? "95vh" : props.height || "85vh",
}));

const scrollbarStyle = computed(() => ({
    maxHeight: isMobile.value ? "40vh" : "60vh",
}));

const modalTitle = computed(() => props.title || t("contextEditor.title"));

const size = computed(() => responsiveButtonSize.value);

const variableCount = computed(() => {
    const variables = new Set<string>();
    localState.value.messages.forEach((message) => {
        const detected = props.scanVariables(message.content || "");
        detected.forEach((v) => variables.add(v));
    });
    return variables.size;
});


const roleOptions = computed(() => [
    { label: t("conversation.roles.system"), value: "system" },
    { label: t("conversation.roles.user"), value: "user" },
    { label: t("conversation.roles.assistant"), value: "assistant" },
    { label: t("conversation.roles.tool"), value: "tool" },
]);

// Utility functions (use the injected functions uniformly)
const getMessageVariables = (content: string) => {
    const detected = props.scanVariables(content || "") || [];
    const missing = detected.filter(
        (varName) => aggregatedVars.allVariables.value[varName] === undefined,
    );
    return { detected, missing };
};

const replaceVariables = (content: string): string => {
    return props.replaceVariables(content || "", aggregatedVars.allVariables.value);
};

const getPlaceholderText = (role: string) => {
    switch (role) {
        case "system":
            return t("conversation.placeholders.system");
        case "user":
            return t("conversation.placeholders.user");
        case "assistant":
            return t("conversation.placeholders.assistant");
        case "tool":
            return t("conversation.placeholders.tool");
        default:
            return t("conversation.placeholders.default");
    }
};

// Accessibility event handling (keyboard focus trap not enabled, to avoid intercepting arrow keys)
const handleModalOpen = () => {
    nextTick(() => {
        announce(aria.getLiveRegionText("modalOpened"), "assertive");
    });
};

const handleModalClose = () => {
    announce(aria.getLiveRegionText("modalClosed"), "polite");
};

// Message handling methods
const addMessage = () => {
    const newMessage: ConversationMessage = {
        role: "user",
        content: "",
    };
    localState.value.messages.push(newMessage);
    handleStateChange();
};

const deleteMessage = (index: number) => {
    if (localState.value.messages.length > 1) {
        localState.value.messages.splice(index, 1);
        handleStateChange();
    }
};

const moveMessage = (index: number, direction: number) => {
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < localState.value.messages.length) {
        const temp = localState.value.messages[index];
        localState.value.messages[index] = localState.value.messages[newIndex];
        localState.value.messages[newIndex] = temp;
        handleStateChange();
    }
};

const handleMessageUpdate = debounce(
    (index: number, message: ConversationMessage) => {
        batchStateUpdate(() => {
            localState.value.messages[index] = { ...message };
        });
        handleStateChange();
    },
    300,
    false,
    "messageUpdate",
);

// Variable extraction handling
const handleVariableExtracted = (data: {
    variableName: string;
    variableValue: string;
    variableType: "global" | "temporary";
}) => {
    if (data.variableType === "global") {
        props.variableManager.addVariable(data.variableName, data.variableValue);
        toast.success(
            t("variableExtraction.savedToGlobal", { name: data.variableName }),
        );
    } else {
        tempVars.setVariable(data.variableName, data.variableValue);
        toast.success(
            t("variableExtraction.savedToTemporary", { name: data.variableName }),
        );
    }
};

const togglePreview = throttle(
    (index: number) => {
        const currentMode = previewMode.value.get(index) || false;
        previewMode.value.set(index, !currentMode);
        recordUpdate();
    },
    100,
    "togglePreview",
);

// Tool management methods - the actual implementation is further below

// Event handling methods
const handleVisibilityChange = (visible: boolean) => {
    localVisible.value = visible;
    emit("update:visible", visible);
};

const handleStateChange = () => {
    emit("update:state", { ...localState.value });
    // Pass a snapshot of the temporary variables for the parent component to use
    // Note: global variables are managed by useVariableManager and are not included in this event
    emit("contextChange", [...localState.value.messages], tempVars.listVariables());
};

const handleImport = () => {
    showImportDialog.value = true;
};

const handleExport = () => {
    showExportDialog.value = true;
};

const handleSave = () => {
    const context = {
        messages: [...localState.value.messages],
        variables: {}, // Temporary variables are no longer saved into the context
        tools: [...localState.value.tools],
    };
    emit("save", context);
};

const handleCancel = () => {
    emit("cancel");
    handleVisibilityChange(false);
};

// Variable management-related state
const variableEditState = ref<{
    show: boolean;
    isEditing: boolean;
    isFromMissing: boolean;
    editingName: string;
    name: string;
    value: string;
    type: "temporary" | "global";
    originalType?: "temporary" | "global";
}>({
    show: false,
    isEditing: false,
    isFromMissing: false,
    editingName: "",
    name: "",
    value: "",
    type: "temporary",
});

const saveVariable = () => {
    const { isEditing, editingName, name, value, type, originalType } = variableEditState.value;

    // Validate the variable name
    if (!name.trim()) {
        return;
    }

    // Check whether it is a predefined variable name
    if (isPredefinedVariable(name)) {
        announce(t("contextEditor.predefinedVariableError"), "assertive");
        return;
    }

    // In edit mode, if the variable name changed, the old variable must be deleted
    if (isEditing && editingName !== name && originalType) {
        if (originalType === "temporary") {
            tempVars.deleteVariable(editingName);
        } else if (originalType === "global") {
            variableManager.deleteVariable(editingName);
        }
    }

    // Save the variable by type
    if (type === "temporary") {
        tempVars.setVariable(name, value);
    } else if (type === "global") {
        // Save a global variable - check whether it has been initialized
        if (!variableManager.isReady.value) {
            announce(t("contextEditor.variableManagerNotReady"), "assertive");
            return;
        }

        try {
            if (isEditing) {
                variableManager.updateVariable(name, value);
            } else {
                variableManager.addVariable(name, value);
            }
        } catch (error) {
            console.error('[ContextEditor] Failed to save global variable:', error);
            announce(t("contextEditor.variableSaveFailed"), "assertive");
            return;
        }
    }

    // Close the editor
    variableEditState.value.show = false;

    // Trigger a state update
    handleStateChange();

    // Notify the user
    const action = isEditing ? t("common.edit") : t("common.add");
    const typeLabel = type === "temporary" ? t("contextEditor.variableSourceLabels.temporary") : t("contextEditor.variableSourceLabels.global");
    announce(t("contextEditor.variableSaved", { action, name, type: typeLabel }), "polite");
};

const cancelVariableEdit = () => {
    variableEditState.value.show = false;
};

// Variable quick action (changed behavior: create a temporary variable directly in the context)
const handleCreateVariableAndOpenManager = (name: string) => {
    if (!name) return;
    // Create a temporary variable directly in the context, marked as coming from a missing variable
    variableEditState.value = {
        show: true,
        isEditing: false,
        isFromMissing: true,
        editingName: "",
        name,
        value: "",
        type: "temporary",
    };
    // After the dialog opens, auto-focus the variable value input
    nextTick(() => {
        variableValueInputRef.value?.focus();
    });
};

// Message focus (scroll and highlight)
const focusedIndex = ref<number | null>(null);
const messageRefs = new Map<number, HTMLElement>();

const resolveHtmlElementFromVNodeRef = (
    refEl: Element | ComponentPublicInstance | null,
): HTMLElement | null => {
    if (!refEl) return null;
    if (refEl instanceof HTMLElement) return refEl;
    if (refEl instanceof Element) return null;
    if (typeof refEl === "object" && "$el" in refEl) {
        const maybeEl = (refEl as { $el?: unknown }).$el;
        return maybeEl instanceof HTMLElement ? maybeEl : null;
    }
    return null;
};

const setMessageRef = (
    index: number,
    refEl: Element | ComponentPublicInstance | null,
) => {
    const element = resolveHtmlElementFromVNodeRef(refEl);
    if (element) messageRefs.set(index, element);
};

const messageCardRef = (index: number): VNodeRef => {
    return (refEl) => setMessageRef(index, refEl);
};
// Lifecycle
watch(
    () => props.visible,
    (newVisible) => {
        localVisible.value = newVisible;
        activeTab.value = resolveDefaultTab();
    },
);

watch(
    () => props.onlyShowTab,
    (tab) => {
        if (tab) {
            activeTab.value = resolveDefaultTab();
        }
    },
);

watch(
    () => props.defaultTab,
    () => {
        activeTab.value = resolveDefaultTab();
    },
);

watch(
    [showMessagesTab, showVariablesTab, showToolsTab],
    () => {
        const visibilityMap: Record<string, boolean> = {
            messages: showMessagesTab.value,
            variables: showVariablesTab.value,
            tools: showToolsTab.value,
        };
        if (!visibilityMap[activeTab.value]) {
            activeTab.value = resolveDefaultTab();
        }
    },
);

watch(
    () => props.state,
    (newState) => {
        if (newState) {
            localState.value = { ...newState };
        }
    },
    { deep: true },
);

watch(
    () => props.showToolManager,
    (show) => {
        localState.value.showToolManager = show;
    },
);

// Import/export event handling
interface ImportSuccessData {
    messages: ConversationMessage[];
    tools?: ToolDefinition[];
}

const handleImportSuccess = (data: ImportSuccessData) => {
    // Sync the imported data to the local state
    localState.value.messages = data.messages;
    localState.value.tools = data.tools || [];

    handleStateChange();

    // Switch to the message editing tab
    activeTab.value = "messages";
    announce(t("contextEditor.importSuccess"), "polite");
};

const handleExportSuccess = () => {
    announce(t("contextEditor.exportSuccess"), "polite");
};

const handleExportError = (message?: string) => {
    const fallbackMessage = message || t("contextEditor.exportFailed");
    console.error(fallbackMessage);
    announce(fallbackMessage, "assertive");
};
</script>

<style scoped>
/* Accessibility: screen-reader-only */
.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}

/* Highlight the focused card */
.focused-card {
    box-shadow: 0 0 0 2px var(--n-color-target, #18a058) inset;
    transition: box-shadow 0.2s ease;
}
</style>
