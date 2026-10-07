<template>
    <div
        class="variable-aware-input-wrapper"
        :style="completionColorVars"
    >
        <!-- CodeMirror editor container (appearance aligned with the Naive UI NInput textarea) -->
        <div class="codemirror-container" :class="codemirrorContainerClass">
            <div ref="editorRef" class="codemirror-editor"></div>

            <!-- Clear button (only shown when clearable is enabled and there is content) -->
            <button
                v-if="showClearButton"
                class="vai-clear"
                type="button"
                :title="t('common.clear')"
                :aria-label="t('common.clear')"
                @mousedown.prevent
                @click="handleClear"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M18 6L6 18" />
                    <path d="M6 6l12 12" />
                </svg>
            </button>

            <!-- Character count (consistent with NInput show-count) -->
            <div v-if="showCount" class="vai-count" aria-hidden="true">
                {{ countText }}
            </div>
        </div>

        <!-- Floating "Extract as variable" button -->
        <NPopover
            v-model:show="showExtractionButton"
            :x="popoverPosition.x"
            :y="popoverPosition.y"
            placement="top"
            trigger="manual"
            :show-arrow="false"
            :style="{ padding: '4px' }"
        >
            <template #trigger>
                <div
                    :style="{
                        position: 'fixed',
                        left: popoverPosition.x + 'px',
                        top: popoverPosition.y + 'px',
                        pointerEvents: 'none',
                        width: '1px',
                        height: '1px',
                    }"
                />
            </template>
            <NButton size="small" type="primary" @click="handleExtractVariable">
                {{ t("variableExtraction.extractButton") }}
            </NButton>
        </NPopover>

        <!-- Variable extraction dialog -->
        <VariableExtractionDialog
            v-model:show="showExtractionDialog"
            :selected-text="currentSelection.displayText"
            :existing-global-variables="existingGlobalVariables"
            :existing-temporary-variables="existingTemporaryVariables"
            :predefined-variables="predefinedVariables"
            :occurrence-count="occurrenceCount"
            @confirm="handleExtractionConfirm"
            @cancel="handleExtractionCancel"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'

import { EditorView, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { history, historyKeymap, defaultKeymap, indentWithTab } from "@codemirror/commands";
import { foldGutter, foldKeymap, indentOnInput, bracketMatching, defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { closeBrackets, completionKeymap } from "@codemirror/autocomplete";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { lintKeymap } from "@codemirror/lint";

import { NPopover, NButton, useThemeVars } from "naive-ui";
import { useI18n } from "vue-i18n";
import { useToast } from "../../composables/ui/useToast";
import { useVariableDetection } from "./useVariableDetection";
import VariableExtractionDialog from "./VariableExtractionDialog.vue";
import {
    variableHighlighter,
    variableAutocompletion,
    missingVariableTooltip,
    existingVariableTooltip,
    createThemeExtension,
    type VariableDetectionLabels,
} from "./codemirror-extensions";

/**
 * Input component supporting variable highlighting and smart management
 *
 * Implemented on top of CodeMirror 6, providing:
 * 1. Real-time variable highlighting (global / temporary / predefined / missing)
 * 2. Variable autocomplete (triggered by typing {{)
 * 3. Quick add of missing variables
 * 4. Extracting variables from selected text (original feature kept)
 */

// Props definition
interface Props {
    /** Input box value */
    modelValue: string;
    /** Placeholder text */
    placeholder?: string;
    /** 🆕 Whether read-only */
    readonly?: boolean;
    /** Auto-adjust height */
    autosize?: boolean | { minRows?: number; maxRows?: number };

    /** Whether to show the clear button (aligned with NInput clearable) */
    clearable?: boolean;
    /** Whether to show the character count (aligned with NInput show-count) */
    showCount?: boolean;
    /** Maximum input length (aligned with NInput maxLength/maxlength) */
    maxLength?: number;

    /** List of existing global variable names */
    existingGlobalVariables?: string[];
    /** List of existing temporary variable names */
    existingTemporaryVariables?: string[];
    /** List of system predefined variable names */
    predefinedVariables?: string[];
    /** Map of global variable names to values */
    globalVariableValues?: Record<string, string>;
    /** Map of temporary variable names to values */
    temporaryVariableValues?: Record<string, string>;
    /** Map of predefined variable names to values */
    predefinedVariableValues?: Record<string, string>;
}

const props = withDefaults(defineProps<Props>(), {
    placeholder: "",
    readonly: false,
    autosize: () => ({ minRows: 4, maxRows: 12 }),
    clearable: false,
    showCount: false,
    existingGlobalVariables: () => [],
    existingTemporaryVariables: () => [],
    predefinedVariables: () => [],
    globalVariableValues: () => ({}),
    temporaryVariableValues: () => ({}),
    predefinedVariableValues: () => ({}),
});

// Emits definition
interface Emits {
    /** Update the input box value */
    (e: "update:modelValue", value: string): void;
    /** Variable extraction event */
    (
        e: "variable-extracted",
        data: {
            variableName: string;
            variableValue: string;
            variableType: "global" | "temporary";
        },
    ): void;
    /** Add missing variable event */
    (e: "add-missing-variable", varName: string): void;
}

const emit = defineEmits<Emits>();

const { t } = useI18n();
const message = useToast();
const themeVars = useThemeVars();
const completionColorVars = computed(() => ({
    "--variable-completion-temporary-color":
        themeVars.value.successColor || "#18a058",
    "--variable-completion-global-color":
        themeVars.value.infoColor || "#2080f0",
    "--variable-completion-predefined-color":
        themeVars.value.warningColor || "#8a63d2",
    "--variable-completion-selected-bg":
        themeVars.value.primaryColorSuppl || "rgba(32, 128, 240, 0.12)",
    "--variable-completion-selected-color":
        themeVars.value.primaryColor || "#2080f0",
}));

const showClearButton = computed(
    () => props.clearable && !props.readonly && props.modelValue.length > 0,
);

const showCount = computed(() => props.showCount);

const countText = computed(() => {
    const length = props.modelValue.length;

    if (
        typeof props.maxLength === "number" &&
        Number.isFinite(props.maxLength) &&
        props.maxLength >= 0
    ) {
        return `${length}/${props.maxLength}`;
    }

    return String(length);
});

const codemirrorContainerClass = computed(() => ({
    'vai-has-clear': props.clearable,
    'vai-has-count': props.showCount,
    'vai-readonly': props.readonly,
}));

const editorRef = ref<HTMLElement>();
let editorView: EditorView | null = null;

const handleClear = () => {
    if (props.readonly) return;
    if (!editorView) {
        emit("update:modelValue", "");
        return;
    }

    editorView.dispatch({
        changes: { from: 0, to: editorView.state.doc.length, insert: "" },
        selection: { anchor: 0 },
    });
    editorView.focus();
};

// Prevent the loop "external props sync -> CodeMirror dispatch -> updateListener emit -> sync again"
const isSyncingFromModel = ref(false);

// Create a Compartment for dynamically updating extensions
const autocompletionCompartment = new Compartment();
const highlighterCompartment = new Compartment();
const missingVariableTooltipCompartment = new Compartment();
const existingVariableTooltipCompartment = new Compartment();
const placeholderCompartment = new Compartment();
const themeCompartment = new Compartment();
const readOnlyCompartment = new Compartment();
const lineWrappingCompartment = new Compartment();

const buildVariableMap = (
    names: string[] | undefined,
    values: Record<string, string> | undefined,
): Record<string, string> => {
    const map: Record<string, string> = { ...(values || {}) };
    (names || []).forEach((name) => {
        if (!(name in map)) {
            map[name] = "";
        }
    });
    return map;
};

// Convert variable names to a Record format (including variable values, used for detection and completion)
const globalVariablesMap = computed(() =>
    buildVariableMap(props.existingGlobalVariables, props.globalVariableValues),
);

const temporaryVariablesMap = computed(() =>
    buildVariableMap(
        props.existingTemporaryVariables,
        props.temporaryVariableValues,
    ),
);

const predefinedVariablesMap = computed(() =>
    buildVariableMap(
        props.predefinedVariables,
        props.predefinedVariableValues,
    ),
);

// Variable detection
const { extractVariables } = useVariableDetection(
    globalVariablesMap,
    temporaryVariablesMap,
    predefinedVariablesMap,
);

// Variable-related i18n copy
const variableDetectionLabels = computed<VariableDetectionLabels>(() => {
    return {
        sourceGlobal: t("variableDetection.sourceGlobal"),
        sourceTemporary: t("variableDetection.sourceTemporary"),
        sourcePredefined: t("variableDetection.sourcePredefined"),
        missingVariable: t("variableDetection.missingVariable"),
        addToTemporary: t("variableDetection.addToTemporary"),
        emptyValue: t("variableDetection.emptyValue"),
        valuePreview: (value: string) =>
            t("variableDetection.valuePreview", { value }),
    };
});

/** Determine whether the given position is inside a variable placeholder */
const isInsideVariablePlaceholder = (text: string, index: number): boolean => {
    const beforeText = text.substring(0, index);
    const openBraces = (beforeText.match(/\{\{/g) || []).length;
    const closeBraces = (beforeText.match(/\}\}/g) || []).length;
    return openBraces > closeBraces;
};

/** Validate that the selected text is legal (must not cross a variable boundary) */
const validateSelection = (
    fullText: string,
    start: number,
    end: number,
    selectedText: string,
): { isValid: boolean; reason?: string } => {
    // Whether there is a valid selection
    if (start === end || !selectedText.trim()) {
        return { isValid: false, reason: "No text selected" };
    }

    // Check whether it crosses a variable boundary
    const beforeSelection = fullText.substring(0, start);
    const afterSelection = fullText.substring(end);

    const openBracesBefore = (beforeSelection.match(/\{\{/g) || []).length;
    const closeBracesBefore = (beforeSelection.match(/\}\}/g) || []).length;
    if (openBracesBefore > closeBracesBefore) {
        return { isValid: false, reason: "Cannot cross a variable boundary" };
    }

    const openBracesAfter = (afterSelection.match(/\{\{/g) || []).length;
    const closeBracesAfter = (afterSelection.match(/\}\}/g) || []).length;
    if (closeBracesAfter > openBracesAfter) {
        return { isValid: false, reason: "Cannot cross a variable boundary" };
    }

    const openBracesInSelection = (selectedText.match(/\{\{/g) || []).length;
    const closeBracesInSelection = (selectedText.match(/\}\}/g) || []).length;
    if (openBracesInSelection !== closeBracesInSelection) {
        return { isValid: false, reason: "Cannot cross a variable boundary" };
    }

    return { isValid: true };
};

/** Count the occurrences of the target string in the text (ignoring those inside variable placeholders) */
const isOutsideVariableRange = (
    fullText: string,
    start: number,
    length: number,
): boolean => {
    if (length <= 0) return false;
    if (isInsideVariablePlaceholder(fullText, start)) {
        return false;
    }
    const endIndex = start + length - 1;
    return !isInsideVariablePlaceholder(fullText, endIndex);
};

const countOccurrencesOutsideVariables = (
    fullText: string,
    searchText: string,
): number => {
    if (!searchText || !searchText.trim()) return 0;

    let count = 0;
    let position = 0;

    while (position < fullText.length) {
        const index = fullText.indexOf(searchText, position);
        if (index === -1) break;

        if (isOutsideVariableRange(fullText, index, searchText.length)) {
            count += 1;
            position = index + searchText.length;
        } else {
            position = index + 1;
        }
    }

    return count;
};

/** Replace all occurrences of the target string in the text (ignoring those inside variable placeholders) */
const replaceAllOccurrencesOutsideVariables = (
    fullText: string,
    searchText: string,
    replaceWith: string,
): string => {
    if (!searchText || !searchText.trim()) return fullText;

    let result = fullText;
    let position = 0;

    while (position < result.length) {
        const index = result.indexOf(searchText, position);
        if (index === -1) break;

        if (isOutsideVariableRange(result, index, searchText.length)) {
            result =
                result.substring(0, index) +
                replaceWith +
                result.substring(index + searchText.length);
            position = index + replaceWith.length;
        } else {
            position = index + 1;
        }
    }

    return result;
};

// Variable extraction-related state
const showExtractionButton = ref(false);
const showExtractionDialog = ref(false);
const popoverPosition = ref({ x: 0, y: 0 });
const currentSelection = ref({
    rawText: "",
    displayText: "",
    start: 0,
    end: 0,
});
const occurrenceCount = ref(1);

// Handle adding a missing variable
const handleAddMissingVariable = (varName: string) => {
    emit("add-missing-variable", varName);

    // Show a success message
    message.success(t("variableDetection.addSuccess", { name: varName }));
};

// Compute the editor height
const editorHeight = computed(() => {
    const autosize = props.autosize;
    if (typeof autosize === "boolean") {
        // When autosize === true, fully adapt to the container height (100%)
        // When autosize === false, use a fixed height
        return autosize
            ? { min: '100%', max: 'none' }
            : { min: '200px', max: '200px' };
    }
    const minRows = autosize.minRows || 4;
    const maxRows = autosize.maxRows || 12;
    return {
        min: `${minRows * 1.5}em`,
        max: `${maxRows * 1.5}em`,
    };
});

// Check the selected text
const checkSelection = () => {
    if (!editorView) return;

    // 🔒 Disable the variable extraction feature in read-only mode
    if (props.readonly) {
        showExtractionButton.value = false;
        return;
    }

    const { from, to } = editorView.state.selection.main;
    const selectedText = editorView.state.sliceDoc(from, to);

    const text = editorView.state.doc.toString();
    const validation = validateSelection(text, from, to, selectedText);

    if (!validation.isValid) {
        showExtractionButton.value = false;
        occurrenceCount.value = 0;

        if (
            validation.reason &&
            validation.reason !== "No text selected"
        ) {
            message.warning(validation.reason);
        }
        return;
    }

    const trimmedSelection = selectedText.trim();
    occurrenceCount.value = Math.max(
        1,
        countOccurrencesOutsideVariables(text, selectedText),
    );

    currentSelection.value = {
        rawText: selectedText,
        displayText: trimmedSelection,
        start: from,
        end: to,
    };

    calculatePopoverPosition();
    showExtractionButton.value = true;
};

// Compute the floating box position
const calculatePopoverPosition = () => {
    if (!editorView) return;

    const { from } = editorView.state.selection.main;
    const coords = editorView.coordsAtPos(from);

    if (coords) {
        popoverPosition.value = {
            x: coords.left,
            y: coords.top - 40,
        };
    }
};

// Handle the extract variable button click
const handleExtractVariable = () => {
    showExtractionButton.value = false;
    showExtractionDialog.value = true;
};

// Handle variable extraction confirmation
const handleExtractionConfirm = (data: {
    variableName: string;
    variableValue: string;
    variableType: "global" | "temporary";
    replaceAll: boolean;
}) => {
    if (!editorView) return;

    // 🔒 Prevent text modification in read-only mode (double protection)
    if (props.readonly) {
        message.warning(t("variableExtraction.readonlyWarning"));
        showExtractionDialog.value = false;
        return;
    }

    const placeholder = `{{${data.variableName}}}`;
    const text = editorView.state.doc.toString();
    let newValue = text;

    if (data.replaceAll && occurrenceCount.value > 1) {
        // Replace all
        newValue = replaceAllOccurrencesOutsideVariables(
            text,
            currentSelection.value.rawText,
            placeholder,
        );
    } else {
        // Only replace the currently selected text
        newValue =
            text.substring(0, currentSelection.value.start) +
            placeholder +
            text.substring(currentSelection.value.end);
    }

    // Update the editor content
    editorView.dispatch({
        changes: {
            from: 0,
            to: editorView.state.doc.length,
            insert: newValue,
        },
        selection: {
            anchor: currentSelection.value.start + placeholder.length,
        },
    });

    // Emit the variable extraction event
    emit("variable-extracted", {
        variableName: data.variableName,
        variableValue: data.variableValue,
        variableType: data.variableType,
    });

    // Show a success message
    if (data.replaceAll && occurrenceCount.value > 1) {
        message.success(
            t("variableExtraction.extractSuccessAll", {
                count: occurrenceCount.value,
                variableName: data.variableName,
            }),
        );
    } else {
        message.success(
            t("variableExtraction.extractSuccess", {
                variableName: data.variableName,
            }),
        );
    }

    // Close the dialog
    showExtractionDialog.value = false;
};

// Handle variable extraction cancellation
const handleExtractionCancel = () => {
    showExtractionDialog.value = false;
};

// Initialize CodeMirror
onMounted(() => {
    if (!editorRef.value) return;

    const startState = EditorState.create({
        doc: props.modelValue,
        extensions: [
            highlightSpecialChars(),
            history(),
            foldGutter(),
            drawSelection(),
            dropCursor(),
            EditorState.allowMultipleSelections.of(true),
            indentOnInput(),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            bracketMatching(),
            closeBrackets(),
            autocompletionCompartment.of(
                variableAutocompletion(
                    globalVariablesMap.value,
                    temporaryVariablesMap.value,
                    predefinedVariablesMap.value,
                    variableDetectionLabels.value,
                )
            ),
            rectangularSelection(),
            crosshairCursor(),
            highlightSelectionMatches(),
            keymap.of([
                ...defaultKeymap,
                ...searchKeymap,
                ...historyKeymap,
                ...foldKeymap,
                ...completionKeymap,
                ...lintKeymap,
                indentWithTab
            ]),
            // Variable highlighting (using a Compartment)
            highlighterCompartment.of(variableHighlighter(extractVariables)),
            // Missing variable hint
            missingVariableTooltipCompartment.of(
                missingVariableTooltip(
                    handleAddMissingVariable,
                    variableDetectionLabels.value,
                    {
                        backgroundColor: themeVars.value.cardColor,
                        borderColor: themeVars.value.borderColor,
                        borderRadius: themeVars.value.borderRadius,
                        textColor: themeVars.value.textColor2,
                        primaryColor: themeVars.value.primaryColor,
                        primaryColorHover: themeVars.value.primaryColorHover,
                    },
                ),
            ),
            // Existing variable hint
            existingVariableTooltipCompartment.of(
                existingVariableTooltip(
                    variableDetectionLabels.value,
                    {
                        backgroundColor: themeVars.value.cardColor,
                        borderColor: themeVars.value.borderColor,
                        borderRadius: themeVars.value.borderRadius,
                        textColor: themeVars.value.textColor2,
                        shadow: themeVars.value.boxShadow2,
                        sourceGlobalColor: themeVars.value.infoColor,
                        sourceTemporaryColor: themeVars.value.successColor,
                        sourcePredefinedColor: themeVars.value.warningColor,
                        surfaceOverlay: themeVars.value.popoverColor,
                    },
                ),
            ),
            // Theme adaptation
            themeCompartment.of(
                createThemeExtension(themeVars.value, {
                    readonly: props.readonly,
                }),
            ),
            // 🆕 Read-only state
            readOnlyCompartment.of(EditorState.readOnly.of(props.readonly)),
            // 🆕 Line wrapping feature
            lineWrappingCompartment.of(EditorView.lineWrapping),
            // Watch document changes
            EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    const newValue = update.state.doc.toString();

                    // Align with the NInput maxlength behavior: limit the length first and then sync outward, to avoid emitting an over-long value in a short time.
                    if (
                        !isSyncingFromModel.value &&
                        typeof props.maxLength === "number" &&
                        Number.isFinite(props.maxLength) &&
                        props.maxLength >= 0 &&
                        newValue.length > props.maxLength
                    ) {
                        const trimmed = newValue.slice(0, props.maxLength);
                        const anchor = Math.min(
                            update.state.selection.main.anchor,
                            trimmed.length,
                        );

                        update.view.dispatch({
                            changes: {
                                from: 0,
                                to: update.state.doc.length,
                                insert: trimmed,
                            },
                            selection: { anchor },
                        });
                        return;
                    }

                    // Changes caused by external sync are not written back (avoids loops / duplicate writes)
                    if (!isSyncingFromModel.value) {
                        emit("update:modelValue", newValue);
                    }
                }

                // Watch selection changes
                if (update.selectionSet) {
                    checkSelection();
                }
            }),
            // Placeholder (using the official placeholder extension)
            placeholderCompartment.of(
                props.placeholder ? cmPlaceholder(props.placeholder) : []
            ),
        ],
    });

    editorView = new EditorView({
        state: startState,
        parent: editorRef.value,
    });
});

// Watch external value changes
watch(
    () => props.modelValue,
    (newValue) => {
        if (editorView && newValue !== editorView.state.doc.toString()) {
            isSyncingFromModel.value = true;
            editorView.dispatch({
                changes: {
                    from: 0,
                    to: editorView.state.doc.length,
                    insert: newValue,
                },
            });
            queueMicrotask(() => {
                isSyncingFromModel.value = false;
            });
        }
    },
);

// Watch the variable lists and language changes and update the extensions dynamically
watch(
    [
        () => globalVariablesMap.value,
        () => temporaryVariablesMap.value,
        () => predefinedVariablesMap.value,
        () => variableDetectionLabels.value,
    ],
    () => {
        if (!editorView) return;

        editorView.dispatch({
            effects: [
                autocompletionCompartment.reconfigure(
                    variableAutocompletion(
                        globalVariablesMap.value,
                        temporaryVariablesMap.value,
                        predefinedVariablesMap.value,
                        variableDetectionLabels.value,
                    ),
                ),
                highlighterCompartment.reconfigure(
                    variableHighlighter(extractVariables),
                ),
                missingVariableTooltipCompartment.reconfigure(
                    missingVariableTooltip(
                        handleAddMissingVariable,
                        variableDetectionLabels.value,
                        {
                            backgroundColor: themeVars.value.cardColor,
                            borderColor: themeVars.value.borderColor,
                            borderRadius: themeVars.value.borderRadius,
                            textColor: themeVars.value.textColor2,
                            primaryColor: themeVars.value.primaryColor,
                            primaryColorHover: themeVars.value.primaryColorHover,
                        },
                    ),
                ),
                existingVariableTooltipCompartment.reconfigure(
                    existingVariableTooltip(
                        variableDetectionLabels.value,
                        {
                            backgroundColor: themeVars.value.cardColor,
                            borderColor: themeVars.value.borderColor,
                            borderRadius: themeVars.value.borderRadius,
                            textColor: themeVars.value.textColor2,
                            shadow: themeVars.value.boxShadow2,
                            sourceGlobalColor: themeVars.value.infoColor,
                            sourceTemporaryColor: themeVars.value.successColor,
                            sourcePredefinedColor: themeVars.value.warningColor,
                            surfaceOverlay: themeVars.value.popoverColor,
                        },
                    ),
                ),
            ],
        });
    },
);

// Watch placeholder changes and update the editor attributes dynamically
watch(
    () => props.placeholder,
    (placeholder) => {
        if (!editorView) return;

        editorView.dispatch({
            effects: [
                placeholderCompartment.reconfigure(
                    placeholder ? cmPlaceholder(placeholder) : []
                ),
            ],
        });
    },
);

// 🆕 Watch readonly changes and update the editor read-only state dynamically
watch(
    () => props.readonly,
    (readonly) => {
        if (!editorView) return;

        editorView.dispatch({
            effects: [
                readOnlyCompartment.reconfigure(EditorState.readOnly.of(readonly)),
                themeCompartment.reconfigure(
                    createThemeExtension(themeVars.value, {
                        readonly,
                    }),
                ),
            ],
        });
    },
);

// Watch theme changes and update the CodeMirror theme dynamically
watch(
    themeVars,
    (vars) => {
        if (!editorView) return;

        editorView.dispatch({
            effects: [
                themeCompartment.reconfigure(
                    createThemeExtension(vars, {
                        readonly: props.readonly,
                    }),
                ),
                missingVariableTooltipCompartment.reconfigure(
                    missingVariableTooltip(
                        handleAddMissingVariable,
                        variableDetectionLabels.value,
                        {
                            backgroundColor: vars.cardColor,
                            borderColor: vars.borderColor,
                            borderRadius: vars.borderRadius,
                            textColor: vars.textColor2,
                            primaryColor: vars.primaryColor,
                            primaryColorHover: vars.primaryColorHover,
                        },
                    ),
                ),
                existingVariableTooltipCompartment.reconfigure(
                    existingVariableTooltip(
                        variableDetectionLabels.value,
                        {
                            backgroundColor: vars.cardColor,
                            borderColor: vars.borderColor,
                            borderRadius: vars.borderRadius,
                            textColor: vars.textColor2,
                            shadow: vars.boxShadow2,
                            sourceGlobalColor: vars.infoColor,
                            sourceTemporaryColor: vars.successColor,
                            sourcePredefinedColor: vars.warningColor,
                            surfaceOverlay: vars.popoverColor,
                        },
                    ),
                ),
            ],
        });
    },
    { deep: true },
);

// Cleanup
onBeforeUnmount(() => {
    if (editorView) {
        editorView.destroy();
        editorView = null;
    }
});

// Expose methods for the parent component to call
defineExpose({
    // Get the editor instance
    getEditorView: () => editorView,
    // Get the current value
    getValue: () => editorView?.state.doc.toString() || "",
    // Set the value
    setValue: (value: string) => {
        if (editorView) {
            editorView.dispatch({
                changes: {
                    from: 0,
                    to: editorView.state.doc.length,
                    insert: value,
                },
            });
        }
    },
    // Get the selected text
    getSelection: () => {
        if (!editorView) return { text: "", from: 0, to: 0 };
        const { from, to } = editorView.state.selection.main;
        return {
            text: editorView.state.sliceDoc(from, to),
            from,
            to,
        };
    },
    // Replace the selected text
    replaceSelection: (text: string) => {
        if (!editorView) return;
        const { from, to } = editorView.state.selection.main;
        editorView.dispatch({
            changes: { from, to, insert: text },
            selection: { anchor: from + text.length },
        });
    },
    // Focus the editor
    focus: () => {
        editorView?.focus();
    },
});
</script>

<style scoped>
.variable-aware-input-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
}

.codemirror-container {
    position: relative;
    border: 1px solid var(--n-border-color);
    border-radius: var(--n-border-radius);
    overflow: hidden;
    transition: border-color 0.3s var(--n-bezier);
    flex: 1;
    min-height: 0;
}

.codemirror-editor {
    height: 100%;
    width: 100%;
}

.codemirror-container:hover {
    border-color: var(--n-border-color-hover);
}

.codemirror-container:focus-within {
    border-color: var(--n-primary-color);
    box-shadow: 0 0 0 2px var(--n-primary-color-suppl);
}

/* CodeMirror internal style adjustments */
.codemirror-container :deep(.cm-editor) {
    height: 100%;
}

.codemirror-container :deep(.cm-scroller) {
    overflow: auto;
    min-height: v-bind("editorHeight.min");
    max-height: v-bind("editorHeight.max");
}

.codemirror-container :deep(.cm-content) {
    min-height: v-bind("editorHeight.min");
    /* 🆕 Support automatic text wrapping */
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
}

/* 🆕 Make sure long lines wrap correctly */
.codemirror-container :deep(.cm-line) {
    white-space: pre-wrap;
    word-break: break-word;
}

/* Reserve space for the top-right clear button and the bottom-right counter, to avoid obscuring the content */
.codemirror-container.vai-has-clear :deep(.cm-content) {
    padding-right: 36px;
}

.codemirror-container.vai-has-count :deep(.cm-content) {
    padding-right: 56px;
    padding-bottom: 28px;
}

.vai-clear {
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 2;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--n-text-color-3);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0.8;
    transition:
        background-color 0.2s var(--n-bezier),
        color 0.2s var(--n-bezier),
        opacity 0.2s var(--n-bezier);
}

.vai-clear:hover {
    background-color: var(--n-hover-color);
    color: var(--n-text-color-1);
    opacity: 1;
}

.vai-clear:active {
    background-color: var(--n-hover-color);
}

.vai-clear:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--n-primary-color-suppl);
}

.vai-count {
    position: absolute;
    right: 10px;
    bottom: 6px;
    z-index: 1;
    font-size: 12px;
    line-height: 1;
    color: var(--n-text-color-3);
    pointer-events: none;
    user-select: none;
}

/* Placeholder styles (using the official CodeMirror placeholder extension) */
.codemirror-container :deep(.cm-placeholder) {
    color: var(--n-placeholder-color);
    pointer-events: none;
    font-style: normal;
}

/* Autocomplete panel styles */
.codemirror-container :deep(.cm-tooltip-autocomplete) {
    background: var(--n-color);
    border: 1px solid var(--n-border-color);
    border-radius: var(--n-border-radius);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.codemirror-container
    :deep(.cm-tooltip-autocomplete ul li[aria-selected="true"]) {
    background: var(--variable-completion-selected-bg, rgba(32, 128, 240, 0.12));
}

.codemirror-container
    :deep(
        .cm-tooltip-autocomplete ul li[aria-selected="true"] .cm-completionLabel
    ) {
    color: var(--variable-completion-selected-color, #2080f0);
}

.codemirror-container :deep(.cm-completionLabel) {
    color: var(--n-text-color-1);
}

.codemirror-container :deep(.variable-completion-temporary .cm-completionLabel) {
    color: var(--variable-completion-temporary-color, #18a058);
}

.codemirror-container :deep(.variable-completion-global .cm-completionLabel) {
    color: var(--variable-completion-global-color, #2080f0);
}

.codemirror-container :deep(.variable-completion-predefined .cm-completionLabel) {
    color: var(--variable-completion-predefined-color, #8a63d2);
}

.codemirror-container :deep(.cm-completionDetail) {
    color: var(--n-text-color-3);
    font-style: normal;
}

.codemirror-container :deep(.cm-completionInfo) {
    background: var(--n-color);
    border: 1px solid var(--n-border-color);
    color: var(--n-text-color-2);
}

.codemirror-container
    :deep(.cm-tooltip.cm-completionInfo.cm-completionInfo-right) {
    margin-left: 4px;
}
</style>
