<template>
  <div class="text-model-manager">
    <TextModelList
      :models="manager.models.value"
      :is-testing-connection-for="isTestingConnectionFor"
      :is-default-model="manager.isDefaultModel"
      @test="handleTestConnection"
      @edit="handleEditModel"
      @enable="handleEnableModel"
      @disable="handleDisableModel"
      @delete="handleDeleteModel"
    />

    <TextModelEditModal
      :show="showEditModal"
      @update:show="updateEditModalVisibility"
      @saved="handleModelUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, provide, ref, h } from 'vue'

import { useI18n } from 'vue-i18n'
import { isRunningInElectron } from '@prompt-optimizer/core'
import { useTextModelManager } from '../composables/model/useTextModelManager'
import TextModelList from './TextModelList.vue'
import TextModelEditModal from './TextModelEditModal.vue'
import { useDialog } from 'naive-ui'

const emit = defineEmits(['modelsUpdated'])
const { t } = useI18n()
const dialog = useDialog()
const manager = useTextModelManager()
provide('textModelManager', manager)

const showEditModal = ref(false)
const editingModelId = ref<string | null>(null)
const isTestingConnectionFor = (id: string) => !!manager.testingConnections.value[id]
const handleModelUpdated = async (id?: string) => {
  await manager.loadModels()
  const targetId = id || manager.models.value[0]?.id
  if (targetId) {
    emit('modelsUpdated', targetId)
  }

  // After a successful save, close the modal and reset the form state
  showEditModal.value = false
  editingModelId.value = null
  manager.resetFormState()
}

const handleTestConnection = async (id: string) => {
  const runTest = async () => {
    await manager.testConfigConnection(id)
  }

  if (!isRunningInElectron()) {
    const model = manager.models.value.find(m => m.id === id)
    if (model) {
      const isCorsRestricted = !!model.providerMeta?.corsRestricted
      if (isCorsRestricted) {
        const providerName = model.providerMeta?.name || model.providerMeta?.id || 'Unknown Provider'
        dialog.warning({
          title: t('modelManager.corsRestrictedTag'),
          content: () => h('div', { style: 'white-space: pre-line;' }, t('modelManager.corsRestrictedConfirm', { provider: providerName })),
          positiveText: t('common.confirm'),
          negativeText: t('common.cancel'),
          // Don't block dialog close while the async test runs.
          onPositiveClick: () => {
            void runTest()
          }
        })
        return
      }
    }
  }
  await runTest()
}

const handleEditModel = async (id: string) => {
  // If already editing the same model and the modal is already open, return directly
  if (editingModelId.value === id && showEditModal.value === true) {
    return
  }

  // If switching to a different model, reset the form state
  if (editingModelId.value && editingModelId.value !== id) {
    manager.resetFormState()
  }

  // Prepare edit mode (always runs, because we need to make sure the state is correct)
  await manager.prepareForEdit(id, true)
  editingModelId.value = id
  showEditModal.value = true
}

const updateEditModalVisibility = (value: boolean) => {
  showEditModal.value = value
  // When the modal closes, reset the editing state but not the form data
  if (!value) {
    editingModelId.value = null
  }
}

const handleEnableModel = async (id: string) => {
  await manager.enableModel(id)
  emit('modelsUpdated', id)
}

const handleDisableModel = async (id: string) => {
  await manager.disableModel(id)
  emit('modelsUpdated', id)
}

const handleDeleteModel = async (id: string) => {
  if (confirm(t('modelManager.deleteConfirm'))) {
    await manager.deleteModel(id)
    const firstId = manager.models.value[0]?.id
    if (firstId) {
      emit('modelsUpdated', firstId)
    }
  }
}

const openAddModal = async () => {
  await manager.prepareForCreate()
  editingModelId.value = null
  showEditModal.value = true
}

defineExpose({
  openAddModal,
  refresh: manager.loadModels
})

onMounted(async () => {
  await manager.loadProviders()
  await manager.loadModels()
  const firstId = manager.models.value[0]?.id
  if (firstId) {
    emit('modelsUpdated', firstId)
  }
})
</script>

<style scoped>
.text-model-manager {
  width: 100%;
}
</style>
