<!-- Toast component - based on Naive UI NMessageProvider -->
<template>
    <!-- Naive UI's message provider component -->
    <NMessageProvider
        placement="top-right"
        container-style="position: fixed; top: 20px; right: 20px;"
    >
        <NDialogProvider>
            <MessageApiInitializer />
            <slot />
        </NDialogProvider>
    </NMessageProvider>
</template>

<script setup lang="ts">
import { onMounted, defineComponent, h } from "vue";
import { NMessageProvider, NDialogProvider, useMessage } from "naive-ui";

import { setGlobalMessageApi } from '../composables/ui/useToast';

// Internal component used to initialize the message API in the correct context
const MessageApiInitializer = defineComponent({
    name: "MessageApiInitializer",
    setup() {
        onMounted(() => {
            try {
                const messageApi = useMessage();
                setGlobalMessageApi(messageApi);
                console.log("[Toast] Message API initialized successfully");
            } catch (error) {
                console.warn(
                    "[Toast] Message API initialization failed (this is normal during SSR or when provider is not ready):",
                    error,
                );
            }
        });
        return () => h("div", { style: { display: "none" } });
    },
});
</script>
