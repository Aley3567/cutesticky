<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import {
  BACKUP_MODULE_OPTIONS,
  createSampleBackup,
  downloadBackup,
  loadDataRepository,
  previewBackup,
  readBackupFile,
  type BackupEnvelope,
  type BackupModule,
  type BackupPreview,
} from '../data'
import { isWebRuntime } from '../platform'

const includeSecrets = ref(false)
const busy = ref(false)
const status = ref('')
const fileInput = ref<HTMLInputElement>()
const pendingBackup = shallowRef<BackupEnvelope | null>(null)
const pendingPreview = shallowRef<BackupPreview | null>(null)
const selectedModules = ref<BackupModule[]>([])
const canRestoreImport = ref(false)
let reloadTimer: number | null = null

onMounted(async () => {
  canRestoreImport.value = await (await loadDataRepository()).hasImportRecovery()
})

const availableModules = computed(() => BACKUP_MODULE_OPTIONS.filter(
  option => Boolean(pendingPreview.value?.modules[option.key]),
))
const selectedLabels = computed(() => BACKUP_MODULE_OPTIONS
  .filter(option => selectedModules.value.includes(option.key))
  .map(option => option.label))
const aiSelected = computed(() => selectedModules.value.includes('ai'))

async function exportData() {
  busy.value = true
  status.value = ''
  try {
    const repository = await loadDataRepository()
    downloadBackup(await repository.export({ includeSecrets: includeSecrets.value }))
    status.value = '备份已导出'
  } catch (error) {
    status.value = `导出失败：${error instanceof Error ? error.message : String(error)}`
  } finally {
    busy.value = false
  }
}

async function stageImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  busy.value = true
  status.value = ''
  try {
    const backup = await readBackupFile(file)
    const preview = previewBackup(backup)
    if (Object.keys(preview.modules).length === 0) throw new Error('备份中没有可导入的数据')
    pendingBackup.value = backup
    pendingPreview.value = preview
    selectedModules.value = availableModuleKeys(preview)
  } catch (error) {
    status.value = `导入失败：${error instanceof Error ? error.message : String(error)}`
  } finally {
    busy.value = false
  }
}

function availableModuleKeys(preview: BackupPreview): BackupModule[] {
  return BACKUP_MODULE_OPTIONS
    .filter(option => Boolean(preview.modules[option.key]))
    .map(option => option.key)
}

function cancelImport() {
  pendingBackup.value = null
  pendingPreview.value = null
  selectedModules.value = []
}

async function confirmImport() {
  if (!pendingBackup.value || selectedModules.value.length === 0) return
  busy.value = true
  status.value = ''
  try {
    await (await loadDataRepository()).import(pendingBackup.value, { modules: selectedModules.value })
    canRestoreImport.value = true
    scheduleReload(`已替换${selectedLabels.value.join('、')}，正在重新载入…`)
    cancelImport()
  } catch (error) {
    status.value = `导入失败：${error instanceof Error ? error.message : String(error)}`
  } finally {
    busy.value = false
  }
}

function formatExportedAt(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

async function loadSampleData() {
  const confirmed = window.confirm('示例数据会替换当前网页数据，导入前会自动创建恢复备份。是否继续？')
  if (!confirmed) return

  busy.value = true
  status.value = ''
  try {
    await (await loadDataRepository()).import(createSampleBackup())
    canRestoreImport.value = true
    scheduleReload('示例数据已载入，正在重新载入…')
  } catch (error) {
    status.value = `载入失败：${error instanceof Error ? error.message : String(error)}`
  } finally {
    busy.value = false
  }
}

async function restoreImport() {
  busy.value = true
  status.value = ''
  try {
    const restored = await (await loadDataRepository()).restoreLastImport()
    if (!restored) {
      canRestoreImport.value = false
      status.value = '没有可恢复的导入前数据'
      return
    }
    canRestoreImport.value = false
    scheduleReload('已恢复导入前数据，正在重新载入…')
  } catch (error) {
    status.value = `恢复失败：${error instanceof Error ? error.message : String(error)}`
  } finally {
    busy.value = false
  }
}

function scheduleReload(message: string) {
  status.value = message
  if (reloadTimer !== null) window.clearTimeout(reloadTimer)
  reloadTimer = window.setTimeout(() => window.location.reload(), 900)
}
</script>

<template>
  <section class="data-backup" aria-labelledby="data-backup-title">
    <div class="backup-heading">
      <div>
        <h3 id="data-backup-title">本地数据</h3>
        <p>桌面端与网页端可通过同一种 JSON 备份迁移数据。</p>
      </div>
      <label class="secret-option">
        <input v-model="includeSecrets" type="checkbox" />
        包含 API Key
      </label>
    </div>
    <p v-if="includeSecrets" class="warning">备份将包含明文 API Key，请妥善保管。</p>
    <div class="backup-actions">
      <button :disabled="busy" @click="exportData">导出备份</button>
      <button :disabled="busy" @click="fileInput?.click()">导入备份</button>
      <button v-if="canRestoreImport" :disabled="busy" class="restore-btn" @click="restoreImport">撤销上次导入</button>
      <button v-if="isWebRuntime" :disabled="busy" @click="loadSampleData">示例数据</button>
      <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="stageImport" />
    </div>

    <div v-if="pendingBackup && pendingPreview" class="import-preview" role="group" aria-labelledby="import-preview-title">
      <div class="preview-title-row">
        <div>
          <h4 id="import-preview-title">选择要替换的数据</h4>
          <p>{{ formatExportedAt(pendingPreview.exportedAt) }} · v{{ pendingPreview.appVersion }}</p>
        </div>
        <span>{{ pendingPreview.keyCount }} 项记录</span>
      </div>

      <div class="module-grid">
        <label v-for="option in availableModules" :key="option.key" class="module-option">
          <input v-model="selectedModules" type="checkbox" :value="option.key" />
          <span>{{ option.label }}</span>
          <small>{{ pendingPreview.modules[option.key] }}</small>
        </label>
      </div>

      <p class="import-impact">所选模块的现有数据会被清除并替换；未选模块保持不变。导入前会自动创建恢复备份。</p>
      <p v-if="aiSelected && pendingPreview.containsSecrets" class="warning">此备份包含 API Key，导入 AI 模块会覆盖本机 Key。</p>
      <p v-else-if="aiSelected" class="safe-note">此备份不包含 API Key；导入 AI 模块时会保留本机 Key。</p>

      <div class="confirm-actions">
        <button :disabled="busy" class="cancel-btn" @click="cancelImport">取消</button>
        <button :disabled="busy || selectedModules.length === 0" class="confirm-btn" @click="confirmImport">
          确认替换 {{ selectedModules.length }} 个模块
        </button>
      </div>
    </div>
    <p v-if="status" class="backup-status" role="status">{{ status }}</p>
  </section>
</template>

<style scoped>
.data-backup {
  display: grid;
  gap: 10px;
  max-height: calc(100vh - 56px);
  overflow-y: auto;
  padding: 14px;
  border-radius: var(--radius-md);
  background: var(--surface-color);
  box-shadow: var(--shadow-raised);
}

.backup-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
  padding-right: 26px;
}

h3 {
  margin-bottom: 3px;
  font-size: 14px;
}

p,
.secret-option {
  color: var(--ink-2);
  font-size: 11px;
  line-height: 1.45;
}

.secret-option {
  display: flex;
  flex: none;
  align-items: center;
  gap: 5px;
}

.warning {
  color: #b35b2f;
}

.backup-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

button {
  padding: 7px 12px;
  border: 0;
  border-radius: 10px;
  color: var(--accent-color);
  background: var(--accent-soft);
  font: 700 12px/1 var(--font);
  cursor: pointer;
}

button:disabled {
  cursor: wait;
  opacity: 0.55;
}

.backup-status {
  color: var(--accent-color);
}

.restore-btn {
  color: var(--ink-2);
  background: var(--surface-color);
  box-shadow: inset 0 0 0 1px var(--line);
}

.import-preview {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--tint-color);
}

.preview-title-row,
.module-option,
.confirm-actions {
  display: flex;
  align-items: center;
}

.preview-title-row {
  justify-content: space-between;
  gap: 10px;
}

.preview-title-row h4 {
  font-size: 12px;
}

.preview-title-row > span,
.module-option small {
  color: var(--ink-3);
  font-size: 10px;
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.module-option {
  gap: 6px;
  min-width: 0;
  padding: 7px 8px;
  border-radius: 9px;
  background: var(--surface-color);
  color: var(--ink-1);
  font-size: 11px;
}

.module-option span {
  overflow: hidden;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.import-impact,
.safe-note {
  color: var(--ink-2);
}

.confirm-actions {
  justify-content: flex-end;
  gap: 8px;
}

.cancel-btn {
  color: var(--ink-2);
  background: var(--surface-color);
}

.confirm-btn {
  color: white;
  background: var(--accent-color);
}
</style>
