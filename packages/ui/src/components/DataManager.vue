<template>
  <NModal
    :show="show"
    preset="card"
    :style="{ width: '90vw', maxWidth: '500px' }"
    :title="$t('dataManager.title')"
    size="large"
    :bordered="false"
    :segmented="true"
    @update:show="(value: boolean) => !value && close()"
  >
    <NSpace vertical :size="24">
      <!-- Desktop Storage Info -->
      <div v-if="isRunningInElectron() && storageInfo">
        <NText tag="h3" :depth="1" strong style="font-size: 18px; margin-bottom: 12px;">
          {{ $t('dataManager.storage.title') }}
        </NText>
        <NCard size="small" :bordered="true">
          <NSpace vertical :size="12">
            <div>
              <NText depth="3" style="font-size: 12px">{{ $t('dataManager.storage.path') }}</NText>
              <div style="word-break: break-all; font-family: monospace; font-size: 12px; margin-top: 4px;">
                {{ storageInfo.userDataPath }}
              </div>
            </div>
            
            <NGrid :cols="3" :x-gap="12">
              <NGridItem>
                <NStatistic :label="$t('dataManager.storage.mainData')" :value="formatFileSize(storageInfo.mainSizeBytes)">
                </NStatistic>
              </NGridItem>
              <NGridItem>
                <NStatistic :label="$t('dataManager.storage.backup')" :value="formatFileSize(storageInfo.backupSizeBytes)">
                </NStatistic>
              </NGridItem>
              <NGridItem>
                <NStatistic :label="$t('dataManager.storage.total')" :value="formatFileSize(storageInfo.totalBytes)">
                </NStatistic>
              </NGridItem>
            </NGrid>

            <NSpace>
              <NButton size="small" @click="openStorageDir">
                {{ $t('dataManager.storage.openDir') }}
              </NButton>
              <NButton size="small" @click="refreshStorageInfo" :loading="isRefreshingStorage">
                {{ $t('dataManager.storage.refresh') }}
              </NButton>
            </NSpace>
          </NSpace>
        </NCard>
      </div>

      <!-- Export feature -->
      <div>
        <NText tag="h3" :depth="1" strong style="font-size: 18px; margin-bottom: 12px;">
          {{ $t('dataManager.export.title') }}
        </NText>
        <NText :depth="3" style="display: block; margin-bottom: 16px;">
          {{ $t('dataManager.export.description') }}
        </NText>
        <NButton
          @click="handleExport"
          :disabled="isExporting"
          type="primary"
          :loading="isExporting"
          block
        >
          <template #icon>
            <span>📥</span>
          </template>
          {{ isExporting ? $t('common.exporting') : $t('dataManager.export.button') }}
        </NButton>
      </div>

      <!-- Import feature -->
      <div>
        <NText tag="h3" :depth="1" strong style="font-size: 18px; margin-bottom: 12px;">
          {{ $t('dataManager.import.title') }}
        </NText>
        <NText :depth="3" style="display: block; margin-bottom: 16px;">
          {{ $t('dataManager.import.description') }}
        </NText>
        
        <!-- File selection area -->
        <NUpload
          :file-list="selectedFile ? [selectedFile] : []"
          accept=".json"
          :show-file-list="false"
          @change="handleFileChange"
          :custom-request="() => {}"
        >
          <NUploadDragger>
            <div v-if="!selectedFile" style="padding: 24px;">
              <div style="margin-bottom: 12px;">
                <NIcon size="48" :depth="3">
                  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </NIcon>
              </div>
              <NText :depth="3">
                {{ $t('dataManager.import.selectFile') }}
              </NText>
            </div>
            
            <div v-else style="padding: 24px;">
              <NText strong style="display: block; margin-bottom: 8px;">
                {{ selectedFile.name }}
              </NText>
              <NText :depth="3" style="display: block; margin-bottom: 12px;">
                {{ formatFileSize(selectedFile.file?.size ?? 0) }}
              </NText>
              <NSpace>
                <NButton text @click.stop="clearSelectedFile">
                  {{ $t('common.clear') }}
                </NButton>
              </NSpace>
            </div>
          </NUploadDragger>
        </NUpload>

        <!-- Import button -->
        <NButton
          @click="handleImport"
          :disabled="!selectedFile || isImporting"
          type="success"
          :loading="isImporting"
          block
          style="margin-top: 16px;"
        >
          <template #icon>
            <span>📤</span>
          </template>
          {{ isImporting ? $t('common.importing') : $t('dataManager.import.button') }}
        </NButton>
      </div>

      <!-- Context import/export feature -->
      <div>
        <NText tag="h3" :depth="1" strong style="font-size: 18px; margin-bottom: 12px;">
          {{ $t('dataManager.contexts.title') }}
        </NText>
        <NText :depth="3" style="display: block; margin-bottom: 16px;">
          {{ $t('dataManager.contexts.description') }}
        </NText>
        
        <NSpace vertical :size="12">
          <!-- Context export -->
          <NButton
            @click="handleContextExportToFile"
            :disabled="isContextExporting"
            type="default"
            :loading="isContextExporting"
            block
          >
            <template #icon>
              <span>💾</span>
            </template>
            {{ isContextExporting ? $t('common.exporting') : $t('dataManager.contexts.exportFile') }}
          </NButton>
          
          <NButton
            @click="handleContextExportToClipboard"
            :disabled="isContextExporting"
            type="default"
            :loading="isContextExporting"
            block
          >
            <template #icon>
              <span>📋</span>
            </template>
            {{ isContextExporting ? $t('common.exporting') : $t('dataManager.contexts.exportClipboard') }}
          </NButton>
          
          <!-- Context import -->
          <!-- File import -->
          <NUpload
            class="context-upload"
            :file-list="[]"
            accept=".json"
            :show-file-list="false"
            @change="handleContextFileChange"
            :custom-request="() => {}"
            :disabled="isContextImporting"
            style="width: 100%;"
          >
            <NButton
              :disabled="isContextImporting"
              type="default"
              :loading="isContextImporting && isContextImportingFromFile"
              block
            >
              <template #icon>
                <span>📁</span>
              </template>
              {{ (isContextImporting && isContextImportingFromFile) ? $t('common.importing') : $t('dataManager.contexts.importFile') }}
            </NButton>
          </NUpload>
          
          <!-- Clipboard import -->
          <NButton
            @click="handleContextImportFromClipboard"
            :disabled="isContextImporting"
            type="default"
            :loading="isContextImporting && !isContextImportingFromFile"
            block
          >
            <template #icon>
              <span>📝</span>
            </template>
            {{ (isContextImporting && !isContextImportingFromFile) ? $t('common.importing') : $t('dataManager.contexts.importClipboard') }}
          </NButton>
        </NSpace>
      </div>

      <!-- Warning message -->
      <NAlert type="warning" :show-icon="true">
        {{ $t('dataManager.warning') }}
      </NAlert>
    </NSpace>
  </NModal>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted, onUnmounted, type Ref } from 'vue'

import { useI18n } from 'vue-i18n'
import {
  NModal, NSpace, NText, NButton, NUpload, NUploadDragger,
  NIcon, NAlert, NCard, NStatistic, NGrid, NGridItem, type UploadFileInfo
} from 'naive-ui'
import { isRunningInElectron, type ContextBundle } from '@prompt-optimizer/core'
import { useToast } from '../composables/ui/useToast'
import type { AppServices } from '../types/services'

interface Props {
  show: boolean;
  // dataManager is now obtained via inject; props are no longer needed
}

interface Emits {
  (e: 'close'): void
  (e: 'imported'): void
  (e: 'update:show', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const toast = useToast()

// Obtain services uniformly via inject
const services = inject<Ref<AppServices | null>>('services')
if (!services) {
  throw new Error('[DataManager] services was not injected correctly; make sure services is provided in the App component')
}

const getDataManager = computed(() => {
  const servicesValue = services.value
  if (!servicesValue) {
    throw new Error('[DataManager] services is not initialized; make sure the app has started correctly')
  }

  const manager = servicesValue.dataManager
  if (!manager) {
    throw new Error('[DataManager] dataManager is not initialized; make sure the services are configured correctly')
  }

  return manager
})

const isExporting = ref(false)
const isImporting = ref(false)
const selectedFile = ref<UploadFileInfo | null>(null)

const isContextBundle = (data: unknown): data is ContextBundle => {
  if (!data || typeof data !== 'object') return false
  const bundle = data as {
    type?: unknown
    version?: unknown
    currentId?: unknown
    contexts?: unknown
  }
  return (
    bundle.type === 'context-bundle' &&
    bundle.version === '1.0.0' &&
    typeof bundle.currentId === 'string' &&
    Array.isArray(bundle.contexts)
  )
}

// Context import/export state
const isContextExporting = ref(false)
const isContextImporting = ref(false)
const isContextImportingFromFile = ref(false) // Distinguishes file import from clipboard import

// Storage Info State
const storageInfo = ref<{
  userDataPath: string
  mainSizeBytes: number
  backupSizeBytes: number
  totalBytes: number
} | null>(null)
const isRefreshingStorage = ref(false)

const refreshStorageInfo = async () => {
  if (!isRunningInElectron() || !window.electronAPI?.data) return
  try {
    isRefreshingStorage.value = true
    storageInfo.value = await window.electronAPI.data.getStorageInfo()
  } catch (error) {
    console.error('Failed to get storage info:', error)
    toast.error(t('dataManager.storage.refreshFailed'))
  } finally {
    isRefreshingStorage.value = false
  }
}

const openStorageDir = () => {
  if (!isRunningInElectron() || !window.electronAPI?.data) return
  window.electronAPI.data.openStorageDirectory()
}

// Handle file changes
const handleFileChange = (options: { fileList: UploadFileInfo[] }) => {
  selectedFile.value = options.fileList[0] ?? null
}

// --- Close Logic ---
const close = () => {
  emit('update:show', false)
  emit('close')
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.show) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
  if (isRunningInElectron()) {
    refreshStorageInfo()
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})

// Handle export
const handleExport = async () => {
  try {
    const dataManager = getDataManager.value
    if (!dataManager) {
      toast.error(t('toast.error.dataManagerNotAvailable'))
      return
    }

    isExporting.value = true
    
    const data = await dataManager.exportAllData()
    
    // Create the download link
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `prompt-optimizer-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    toast.success(t('dataManager.export.success'))
  } catch (error) {
    console.error('Export failed:', error)
    toast.error(t('dataManager.export.failed'))
  } finally {
    isExporting.value = false
  }
}

// Handle file selection - removed, use handleFileChange instead

// Clear the selected file
const clearSelectedFile = () => {
  selectedFile.value = null
}

// Handle import
const handleImport = async () => {
  if (!selectedFile.value) return

  try {
    isImporting.value = true

    const file = selectedFile.value.file ?? null
    if (!file) {
      toast.error(t('dataManager.import.failed'))
      return
    }

    const content = await file.text()
    const dataManager = getDataManager.value
    if (!dataManager) {
      toast.error(t('toast.error.dataManagerNotAvailable'))
      return
    }
    await dataManager.importAllData(content)
    
    toast.success(t('dataManager.import.success'))
    emit('imported')
    emit('close')
    clearSelectedFile()
  } catch (error) {
    console.error('Import failed:', error)
    toast.error(t('dataManager.import.failed') + ': ' + (error as Error).message)
  } finally {
    isImporting.value = false
  }
}

// Format the file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Handle exporting contexts to a file
const handleContextExportToFile = async () => {
  try {
    const servicesValue = services.value
    if (!servicesValue) {
      toast.error('Service unavailable, please try again later')
      return
    }

    const contextRepo = servicesValue.contextRepo
    if (!contextRepo) {
      toast.error('Context service unavailable, please try again later')
      return
    }

    isContextExporting.value = true
    
    // Use exportAll to get the ContextBundle format
    const contextBundle = await contextRepo.exportAll()
    const exportContent = JSON.stringify(contextBundle, null, 2)
    
    // Create the download link
    const blob = new Blob([exportContent], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `contexts-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    toast.success(`Exported ${contextBundle.contexts.length} context collections to a file`)
  } catch (error) {
    console.error('Context file export failed:', error)
    toast.error('Context export failed: ' + (error as Error).message)
  } finally {
    isContextExporting.value = false
  }
}

// Handle exporting contexts to the clipboard
const handleContextExportToClipboard = async () => {
  try {
    const servicesValue = services.value
    if (!servicesValue) {
      toast.error('Service unavailable, please try again later')
      return
    }

    const contextRepo = servicesValue.contextRepo
    if (!contextRepo) {
      toast.error('Context service unavailable, please try again later')
      return
    }

    isContextExporting.value = true
    
    // Use exportAll to get the ContextBundle format
    const contextBundle = await contextRepo.exportAll()
    const exportContent = JSON.stringify(contextBundle, null, 2)
    
    // Copy to the clipboard
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(exportContent)
    } else {
      // Fallback
      const textarea = document.createElement('textarea')
      textarea.value = exportContent
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    
    toast.success(`Exported ${contextBundle.contexts.length} context collections to the clipboard`)
  } catch (error) {
    console.error('Context clipboard export failed:', error)
    toast.error('Context export failed: ' + (error as Error).message)
  } finally {
    isContextExporting.value = false
  }
}

// Handle context file selection and import
const handleContextFileChange = async (options: { fileList: UploadFileInfo[] }) => {
  if (options.fileList.length === 0 || !options.fileList[0].file) return

  const file = options.fileList[0].file
  if (!file) return
  await handleContextImportFromFile(file)
}

// Handle importing contexts from a file
const handleContextImportFromFile = async (file: File) => {
  try {
    const servicesValue = services.value
    if (!servicesValue) {
      toast.error('Service unavailable, please try again later')
      return
    }

    const contextRepo = servicesValue.contextRepo
    if (!contextRepo) {
      toast.error('Context service unavailable, please try again later')
      return
    }

    isContextImporting.value = true
    isContextImportingFromFile.value = true
    
    // Read the file content
    const content = await file.text()
    
    // Parse the JSON data
    let importData: unknown
    try {
      importData = JSON.parse(content)
    } catch (_parseError) {
      toast.error('Invalid JSON format, please check the file content')
      return
    }
    
    // Use importAll and get detailed statistics
    if (!isContextBundle(importData)) {
      toast.error(t('dataManager.context.invalidContextBundle'))
      return
    }

    const result = await contextRepo.importAll(importData, 'replace')
    
    // Show the detailed import statistics
    const stats = []
    if (result.imported > 0) stats.push(`Imported ${result.imported} contexts`)
    if (result.skipped > 0) stats.push(`Skipped ${result.skipped}`)
    if (result.predefinedVariablesRemoved > 0) stats.push(`Removed ${result.predefinedVariablesRemoved} predefined variable overrides`)
    
    const message = stats.length > 0 ? `Success: ${stats.join(', ')}` : 'Import complete'
    toast.success(message)
    emit('imported') // Trigger the parent component's import success event
  } catch (error) {
    console.error('Context file import failed:', error)
    toast.error('Context import failed: ' + (error as Error).message)
  } finally {
    isContextImporting.value = false
    isContextImportingFromFile.value = false
  }
}

// Handle importing contexts from the clipboard (corrected version)
const handleContextImportFromClipboard = async () => {
  try {
    const servicesValue = services.value
    if (!servicesValue) {
      toast.error('Service unavailable, please try again later')
      return
    }

    const contextRepo = servicesValue.contextRepo
    if (!contextRepo) {
      toast.error('Context service unavailable, please try again later')
      return
    }

    isContextImporting.value = true
    isContextImportingFromFile.value = false
    
    // Read the content from the clipboard
    let clipboardContent = ''
    if (navigator.clipboard) {
      clipboardContent = await navigator.clipboard.readText()
    } else {
      // If the clipboard is not accessible, ask the user to paste manually
      clipboardContent = prompt('Please paste the context data to import:') || ''
    }
    
    if (!clipboardContent.trim()) {
      toast.warning('Clipboard is empty; please copy the data to import first')
      return
    }
    
    // Parse the JSON data
    let importData: unknown
    try {
      importData = JSON.parse(clipboardContent)
    } catch (_parseError) {
      toast.error('Invalid JSON format, please check the data format')
      return
    }
    
    // Use importAll and get detailed statistics
    if (!isContextBundle(importData)) {
      toast.error(t('dataManager.context.invalidContextBundle'))
      return
    }

    const result = await contextRepo.importAll(importData, 'replace')
    
    // Show the detailed import statistics
    const stats = []
    if (result.imported > 0) stats.push(`Imported ${result.imported} contexts`)
    if (result.skipped > 0) stats.push(`Skipped ${result.skipped}`)
    if (result.predefinedVariablesRemoved > 0) stats.push(`Removed ${result.predefinedVariablesRemoved} predefined variable overrides`)
    
    const message = stats.length > 0 ? `Success: ${stats.join(', ')}` : 'Import complete'
    toast.success(message)
    emit('imported') // Trigger the parent component's import success event
  } catch (error) {
    console.error('Context clipboard import failed:', error)
    toast.error('Context import failed: ' + (error as Error).message)
  } finally {
    isContextImporting.value = false
    isContextImportingFromFile.value = false
  }
}
</script>

<style scoped>
:deep(.context-upload .n-upload-trigger) {
  width: 100%;
  display: block;
}
</style>
