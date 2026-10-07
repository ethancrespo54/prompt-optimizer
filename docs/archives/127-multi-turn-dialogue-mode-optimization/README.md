# 127 - Multi-turn Conversation Mode (Pro-System / Conversation) Optimization Design

## 📋 Feature Overview

Archives the optimized interaction and data structure design of the multi-turn conversation mode (formerly "Context - System"). The core goal is to support selecting any `system/user` message in a conversation for optimization, and to use the "message ID" as a stable anchor to manage version chains and automatic application.

## ⏱️ Timeline

- **Start date**: 2025-01-04
- **Last updated**: 2025-01-05
- **Status**: ✅ Design proposal + implementation record (baseline is v3.1)

## 🎯 Key Points

- **Stable selection**: Use `ConversationMessage.id` as the primary key for selection and mapping, avoiding the insert/delete/sort problems of index-based approaches.
- **Work chain reuse**: Use `messageChainMap` (message ID → chainId) to give the "automatically load the existing chain when switching messages" experience.
- **Automatic application and automatic saving**: Optimization results are applied to the conversation message automatically, and work chains are saved automatically by the history system (no extra persistence index required).

## 📁 Document List

- [x] `design.md` - Design proposal and implementation record (final version v3.1)

## 🔗 Related Implementation References (Code)

- `packages/core/src/services/prompt/types.ts` (`ConversationMessage.id` / `originalContent?`)
- `packages/ui/src/composables/prompt/useConversationOptimization.ts` (`selectedMessageId` / `messageChainMap` / automatic application)
- `packages/ui/src/components/context-mode/ContextSystemWorkspace.vue` (multi-turn conversation mode workspace)
- `packages/ui/src/components/context-mode/ConversationManager.vue` (conversation input and message selection)

