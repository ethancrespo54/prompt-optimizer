/**
 * App-level history restore composable
 *
 * Responsible for the smart mode switching and state restore logic when restoring from history.
 * Includes:
 * - Automatically switching the function mode (basic/pro/image) based on the record type
 * - Automatically switching the sub-mode (system/user)
 * - Restoring session snapshots and message-level optimization state
 */

import { nextTick, type Ref } from 'vue'
import { useToast } from '../ui/useToast'
import type { ConversationMessage } from '../../types'
import type { ProMultiMessageSessionApi } from '../../stores/session/useProMultiMessageSession'
import type {
    ContextMode,
    PromptRecord,
    PromptRecordChain,
    IHistoryManager,
    OptimizationMode,
} from '@prompt-optimizer/core'

const isRecord = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object'

/**
 * History record context
 */
export interface HistoryContext {
    record: PromptRecord
    chainId: string
    rootPrompt: string
    chain: PromptRecordChain
}

/**
 * Workspace component reference type
 */
interface WorkspaceRef {
    restoreFromHistory?: (payload: unknown) => void
}

/**
 * Config options for useAppHistoryRestore
 */
export interface AppHistoryRestoreOptions {
    /** Service instance */
    services: Ref<{ historyManager: IHistoryManager } | null>
    /** 🔧 Step D: route navigation function (replaces setFunctionMode/set*SubMode) */
    navigateToSubModeKey: (toKey: string, opts?: { replace?: boolean }) => void
    /** Handle context mode changes */
    handleContextModeChange: (mode: ContextMode) => Promise<void>
    /** Handle history record selection */
    handleSelectHistory: (context: HistoryContext) => Promise<void>
    /** Pro-multi session (multi-message session: the message list is persisted here, avoiding writes to optimizationContext) */
    proMultiMessageSession: ProMultiMessageSessionApi
    /** System workspace component reference */
    systemWorkspaceRef: Ref<WorkspaceRef | null>
    /** User workspace component reference */
    userWorkspaceRef: Ref<WorkspaceRef | null>
    /** i18n translation function */
    t: (key: string, params?: Record<string, unknown>) => string
    /** Flag for external data loading (prevents the automatic restore on mode switch from overwriting external data) */
    isLoadingExternalData: Ref<boolean>
}

type ConversationSnapshotMessage = {
    id: string
    role: ConversationMessage['role']
    content: string
    originalContent?: string
    chainId?: string
    appliedVersion?: number
}

/**
 * Return value of useAppHistoryRestore
 */
export interface AppHistoryRestoreReturn {
    /** Handle history restore (with error handling) */
    handleHistoryReuse: (context: HistoryContext) => Promise<void>
}

/**
 * App-level history restore composable
 */
export function useAppHistoryRestore(options: AppHistoryRestoreOptions): AppHistoryRestoreReturn {
    const {
        services,
        navigateToSubModeKey,
        handleContextModeChange,
        handleSelectHistory,
        proMultiMessageSession,
        systemWorkspaceRef,
        userWorkspaceRef,
        t,
        isLoadingExternalData,
    } = options

    const toast = useToast()

    /**
     * Handle using a history record - smart mode switching (internal implementation)
     */
    const handleHistoryReuseImpl = async (context: HistoryContext) => {
        const { record, chain } = context
        // rootRecord.type may contain old-version type names; explicitly convert it to string for compatibility with historical data
        const rt = chain.rootRecord.type as unknown as string

        // 🆕 Extended mode switching logic - supports image mode
        if (
            rt === 'imageOptimize' ||
            rt === 'contextImageOptimize' ||
            rt === 'imageIterate' ||
            rt === 'text2imageOptimize' ||
            rt === 'image2imageOptimize'
        ) {
            // Image mode: navigate using navigateToSubModeKey
            // Set the correct image sub-mode based on the record type
            const meta = (isRecord(record.metadata) ? record.metadata : null) ??
                (isRecord(chain.rootRecord.metadata) ? chain.rootRecord.metadata : null)
            const hasInputImage = isRecord(meta) && meta.hasInputImage === true
            const imageMode =
                rt === 'text2imageOptimize'
                    ? 'text2image'
                    : rt === 'image2imageOptimize'
                      ? 'image2image'
                      : hasInputImage
                        ? 'image2image'
                        : 'text2image' // Defaults to text-to-image mode

            // 🔧 Step D: use navigateToSubModeKey instead of setImageSubMode
            navigateToSubModeKey(`image-${imageMode}`)
            toast.info(t('toast.info.switchedToImageMode'))

            // 🆕 Data backfill logic dedicated to image mode
            // Wait for the route switch to complete before backfilling the data
            await nextTick()

            // 🆕 Data backfill logic dedicated to image mode
            const imageHistoryData = {
                originalPrompt: record.originalPrompt || chain.rootRecord.originalPrompt,
                optimizedPrompt: record.optimizedPrompt,
                metadata: record.metadata || chain.rootRecord.metadata,
                chainId: chain.chainId,
                versions: chain.versions,
                currentVersionId: record.id,
                imageMode: imageMode, // Add the image mode info
                templateId: record.templateId || chain.rootRecord.templateId, // Add the template ID so the template selection can be restored
            }

            // Trigger the image workspace data restore event
            if (typeof window !== 'undefined') {
                window.dispatchEvent(
                    new CustomEvent('image-workspace-restore', {
                        detail: imageHistoryData,
                    }),
                )
            }

            toast.success(t('toast.success.imageHistoryRestored'))
            return // Image mode does not need the original history handling logic
        } else {
            // Automatically switch the function mode based on the root record type of the chain (supports new and old type names)
            const isContext =
                rt === 'conversationMessageOptimize' ||
                rt === 'contextSystemOptimize' || // Old type name (backward compatible)
                rt === 'contextUserOptimize' ||
                rt === 'contextIterate'
            const targetFunctionMode: 'basic' | 'pro' = isContext ? 'pro' : 'basic'

            // Determine the optimization mode to switch to based on the root record type
            let targetMode: OptimizationMode
            if (rt === 'optimize' || rt === 'conversationMessageOptimize') {
                targetMode = 'system'
            } else if (rt === 'userOptimize' || rt === 'contextUserOptimize') {
                targetMode = 'user'
            } else {
                // Fallback: get the optimization mode from the root record's metadata
                targetMode = chain.rootRecord.metadata?.optimizationMode || 'system'
            }

            // 🔧 Step D: use navigateToSubModeKey to navigate to the target route in one step
            // No longer two steps (switch functionMode first, then subMode)
            const targetKey =
                targetFunctionMode === 'pro'
                    ? `pro-${targetMode === 'system' ? 'multi' : 'variable'}`
                    : `basic-${targetMode}`
            navigateToSubModeKey(targetKey)

            // Wait for the route switch to complete
            await nextTick()

            // Update the toast message (if needed)
            toast.info(
                t('toast.info.optimizationModeAutoSwitched', {
                    mode: targetMode === 'system' ? t('common.system') : t('common.user'),
                }),
            )

            // ❶ Call the original history handling logic (update the global optimizer state)
            await handleSelectHistory(context)

            /**
             * ❷ Context User only: restore the component's internal state
             */
            if (
                rt === 'contextUserOptimize' ||
                (targetFunctionMode === 'pro' && targetMode === 'user')
            ) {
                await nextTick()
                userWorkspaceRef.value?.restoreFromHistory?.({
                    record,
                    chain,
                    rootPrompt: context.rootPrompt,
                })
            }

            // 🆕 Context multi-message mode only: restore the message-level optimization state
            if (rt === 'conversationMessageOptimize' || rt === 'contextSystemOptimize') {
                await nextTick() // Wait for the basic state restore to finish

                // 🆕 Prefer using the session snapshot to restore the full session (supports precise version restore)
                let conversationSnapshot:
                    | ConversationSnapshotMessage[]
                    | undefined
                const conversationSnapshotRaw: unknown =
                    record.metadata?.conversationSnapshot
                if (conversationSnapshotRaw && Array.isArray(conversationSnapshotRaw)) {
                    conversationSnapshot =
                        conversationSnapshotRaw as ConversationSnapshotMessage[]
                    console.log(
                        '[App] Restored the session snapshot from history, message count:',
                        conversationSnapshot.length,
                    )

                    // 🆕 Precise version restore: load the specified version for each message
                const restoredMessages = await Promise.all(
                        conversationSnapshot.map(async (snapshotMsg) => {
                            // If the snapshot contains chainId and appliedVersion, try a precise restore
                            if (
                                snapshotMsg.chainId &&
                                snapshotMsg.appliedVersion !== undefined &&
                                services.value?.historyManager
                            ) {
                                try {
                                    const msgChain = await services.value.historyManager.getChain(
                                        snapshotMsg.chainId,
                                    )

                                    // 1. V0 (Original) handling
                                    if (snapshotMsg.appliedVersion === 0) {
                                        const original =
                                            msgChain.versions[0]?.originalPrompt ??
                                            snapshotMsg.originalContent ??
                                            snapshotMsg.content ??
                                            ''
                                        return {
                                            id: snapshotMsg.id,
                                            role: snapshotMsg.role,
                                            content: original,
                                            originalContent: original,
                                        }
                                    }

                                    // 2. V1+ (Optimized) handling
                                    // appliedVersion is persistent version number
                                    const targetVersion = msgChain.versions.find(
                                        (v) => v.version === snapshotMsg.appliedVersion,
                                    )

                                    if (targetVersion) {
                                        return {
                                            id: snapshotMsg.id,
                                            role: snapshotMsg.role,
                                            content: targetVersion.optimizedPrompt,
                                            originalContent:
                                                snapshotMsg.originalContent ||
                                                targetVersion.originalPrompt,
                                        }
                                    } else {
                                        console.warn(
                                            `[App] Message ${snapshotMsg.id} version v${snapshotMsg.appliedVersion} does not exist, using the snapshot content`,
                                        )
                                        console.warn(
                                            `[App] Available versions:`,
                                            msgChain.versions.map((v) => v.version),
                                        )
                                    }
                                } catch (error) {
                                    console.warn(
                                        `[App] Failed to load the version of message ${snapshotMsg.id}, using the snapshot content:`,
                                        error,
                                    )
                                }
                            }

                            // Fallback strategy: use the text content saved in the snapshot
                            return {
                                id: snapshotMsg.id,
                                role: snapshotMsg.role,
                                content: snapshotMsg.content,
                                originalContent: snapshotMsg.originalContent,
                            }
                        }),
                    )

                    // Pro-multi: session-owned messages
                    proMultiMessageSession.updateConversationMessages(restoredMessages)

                    // Persist message→chain mapping for Pro-multi (so refresh / mode-switch keeps links).
                    const mapRecord: Record<string, string> = {}
                    for (const msg of conversationSnapshot) {
                        if (msg.id && msg.chainId) {
                            mapRecord[msg.id] = msg.chainId
                        }
                    }
                    if (Object.keys(mapRecord).length > 0) {
                        proMultiMessageSession.setMessageChainMap(mapRecord)
                    }
                    await nextTick()
                }

                const messageId = record.metadata?.messageId
                const targetMessage = messageId
                    ? (proMultiMessageSession.conversationMessagesSnapshot || []).find((msg) => msg.id === messageId)
                    : undefined

                await systemWorkspaceRef.value?.restoreFromHistory?.({
                    chain,
                    record,
                    conversationSnapshot,
                    message: targetMessage,
                })

                if (conversationSnapshot) {
                    if (targetMessage) {
                        toast.success(t('toast.success.conversationRestored'))
                    } else if (messageId) {
                        console.warn('[App] The optimized message ID was not found in the session snapshot:', messageId)
                        toast.warning(t('toast.warning.messageNotFoundInSnapshot'))
                    }
                } else if (messageId) {
                    if (targetMessage) {
                        console.log(
                            '[App] The history record has no session snapshot, trying to find the message in the current session (legacy data)',
                        )
                        toast.warning(t('toast.warning.restoredFromLegacyHistory'))
                    } else {
                        console.warn('[App] The message ID was not found in the legacy history record:', messageId)
                        toast.warning(t('toast.warning.messageNotFoundInSnapshot'))
                    }
                }
            }
        }
    }

    /**
     * Error handling wrapper for history restore
     */
    const handleHistoryReuse = async (context: HistoryContext) => {
        try {
            // 🔧 Set the external data loading flag to prevent the automatic restore on mode switch from overwriting external data
            isLoadingExternalData.value = true

            await handleHistoryReuseImpl(context)
        } catch (error) {
            // Catch all errors during history restore
            console.error('[App] History restore failed:', error)
            const errorMessage = error instanceof Error ? error.message : String(error)
            toast.error(t('toast.error.historyRestoreFailed', { error: errorMessage }))
        } finally {
            // 🔧 Restore finished; reset the flag to allow normal mode-switch restores
            isLoadingExternalData.value = false
        }
    }

    return {
        handleHistoryReuse,
    }
}
