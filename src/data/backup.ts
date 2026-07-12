import type { PlatformStore } from '../platform/types'
import {
  BACKUP_FORMAT,
  CURRENT_SCHEMA_VERSION,
  INTERNAL_KEY_PREFIX,
  LAST_IMPORT_BACKUP_KEY,
  SCHEMA_VERSION_KEY,
  isBackupEnvelope,
  type BackupEnvelope,
  type StoredData,
} from './schema'

export interface BackupOptions {
  includeSecrets?: boolean
  appVersion?: string
}

export type BackupModule = 'notes' | 'todos' | 'pomodoro' | 'links' | 'ai' | 'weather' | 'games' | 'preferences' | 'other'

export const BACKUP_MODULE_OPTIONS: ReadonlyArray<{ key: BackupModule; label: string }> = [
  { key: 'notes', label: '便签' },
  { key: 'todos', label: '待办' },
  { key: 'pomodoro', label: '番茄钟' },
  { key: 'links', label: '常用链接' },
  { key: 'ai', label: 'AI 对话与设置' },
  { key: 'weather', label: '天气' },
  { key: 'games', label: '游戏记录' },
  { key: 'preferences', label: '界面偏好' },
  { key: 'other', label: '其他数据' },
]

export interface ImportOptions {
  /** Omit to replace the full backup. Pass modules to replace only those groups. */
  modules?: BackupModule[]
}

export interface BackupPreview {
  exportedAt: string
  appVersion: string
  schemaVersion: number
  keyCount: number
  modules: Partial<Record<BackupModule, number>>
  containsSecrets: boolean
}

export interface ImportResult {
  preview: BackupPreview
  rollbackBackup: string
  importedModules: BackupModule[]
}

function appVersion(): string {
  return import.meta.env.VITE_APP_VERSION || '0.1.0'
}

function withoutSecrets(key: string, value: unknown): unknown {
  if (key !== 'llmConfig' || typeof value !== 'object' || value === null || Array.isArray(value)) return value
  const { apiKey: _apiKey, ...safeConfig } = value as Record<string, unknown>
  return safeConfig
}

export function moduleForBackupKey(key: string): BackupModule {
  if (key === 'notes' || key === 'memo') return 'notes'
  if (key === 'todos' || key.startsWith('pomodoro')) return key === 'todos' ? 'todos' : 'pomodoro'
  if (key === 'links') return 'links'
  if (key === 'aiChatHistory' || key === 'llmConfig') return 'ai'
  if (key.startsWith('weather')) return 'weather'
  if (key.startsWith('game:') || key.startsWith('highscore:')) return 'games'
  if (key === 'themeIndex' || key === 'activeTab') return 'preferences'
  return 'other'
}

function containsApiKey(data: StoredData): boolean {
  const config = data.llmConfig
  return typeof config === 'object'
    && config !== null
    && !Array.isArray(config)
    && typeof (config as Record<string, unknown>).apiKey === 'string'
    && Boolean((config as Record<string, unknown>).apiKey)
}

export async function createBackup(store: PlatformStore, options: BackupOptions = {}): Promise<BackupEnvelope> {
  const data: StoredData = {}
  for (const [key, value] of await store.entries()) {
    if (key.startsWith(INTERNAL_KEY_PREFIX)) continue
    data[key] = options.includeSecrets ? value : withoutSecrets(key, value)
  }

  return {
    format: BACKUP_FORMAT,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: options.appVersion ?? appVersion(),
    data,
  }
}

export function serializeBackup(backup: BackupEnvelope): string {
  return JSON.stringify(backup, null, 2)
}

export function parseBackup(source: string): BackupEnvelope {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    throw new Error('备份不是有效的 JSON 文件')
  }

  if (!isBackupEnvelope(value)) throw new Error('文件不是 Cute Sticky 备份，或备份结构已损坏')
  if (value.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(`备份数据版本 ${value.schemaVersion} 高于当前支持的 ${CURRENT_SCHEMA_VERSION}`)
  }
  return value
}

export function previewBackup(backup: BackupEnvelope): BackupPreview {
  const modules: Partial<Record<BackupModule, number>> = {}
  for (const key of Object.keys(backup.data)) {
    const module = moduleForBackupKey(key)
    modules[module] = (modules[module] ?? 0) + 1
  }

  return {
    exportedAt: backup.exportedAt,
    appVersion: backup.appVersion,
    schemaVersion: backup.schemaVersion,
    keyCount: Object.keys(backup.data).length,
    modules,
    containsSecrets: containsApiKey(backup.data),
  }
}

async function replaceStoreData(store: PlatformStore, data: StoredData): Promise<void> {
  await store.clear()
  for (const [key, value] of Object.entries(data)) {
    if (!key.startsWith(INTERNAL_KEY_PREFIX)) await store.set(key, value)
  }
  await store.set(SCHEMA_VERSION_KEY, CURRENT_SCHEMA_VERSION)
  await store.save()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function preserveLocalApiKey(target: StoredData, current: StoredData): StoredData {
  const incomingConfig = target.llmConfig
  const currentConfig = current.llmConfig
  if (!isRecord(currentConfig)) return target
  if (typeof currentConfig.apiKey !== 'string') return target
  if (!Object.prototype.hasOwnProperty.call(target, 'llmConfig')) {
    return { ...target, llmConfig: { ...currentConfig } }
  }
  if (!isRecord(incomingConfig)) return target
  if (Object.prototype.hasOwnProperty.call(incomingConfig, 'apiKey')) return target

  return {
    ...target,
    llmConfig: { ...incomingConfig, apiKey: currentConfig.apiKey },
  }
}

function validateSelectedModules(modules: BackupModule[]): BackupModule[] {
  const known = new Set(BACKUP_MODULE_OPTIONS.map(option => option.key))
  const selected = [...new Set(modules)]
  if (selected.length === 0) throw new Error('请至少选择一个要导入的模块')
  if (selected.some(module => !known.has(module))) throw new Error('包含无法识别的备份模块')
  return selected
}

function selectImportData(current: StoredData, incoming: StoredData, modules: BackupModule[]): StoredData {
  const selected = new Set(modules)
  const target: StoredData = { ...current }

  for (const key of Object.keys(target)) {
    if (selected.has(moduleForBackupKey(key))) delete target[key]
  }
  for (const [key, value] of Object.entries(incoming)) {
    if (selected.has(moduleForBackupKey(key))) target[key] = value
  }
  return target
}

export async function importBackup(
  store: PlatformStore,
  backup: BackupEnvelope,
  options: ImportOptions = {},
): Promise<ImportResult> {
  const preview = previewBackup(backup)
  const before = serializeBackup(await createBackup(store, { includeSecrets: true }))
  const current = parseBackup(before).data
  const importedModules = options.modules
    ? validateSelectedModules(options.modules)
    : BACKUP_MODULE_OPTIONS.map(option => option.key)
  const selectedData = options.modules
    ? selectImportData(current, backup.data, importedModules)
    : { ...backup.data }
  const target = preserveLocalApiKey(selectedData, current)

  try {
    await replaceStoreData(store, target)
    await store.set(LAST_IMPORT_BACKUP_KEY, before)
    await store.save()
  } catch (error) {
    const rollback = parseBackup(before)
    await replaceStoreData(store, rollback.data)
    throw error
  }

  return { preview, rollbackBackup: before, importedModules }
}

export async function restoreLastImport(store: PlatformStore): Promise<boolean> {
  const backup = await store.get<string>(LAST_IMPORT_BACKUP_KEY)
  if (!backup) return false
  await replaceStoreData(store, parseBackup(backup).data)
  return true
}

export function downloadBackup(backup: BackupEnvelope): void {
  const blob = new Blob([serializeBackup(backup)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const date = backup.exportedAt.slice(0, 10)
  anchor.href = url
  anchor.download = `cute-sticky-backup-${date}.json`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function readBackupFile(file: File): Promise<BackupEnvelope> {
  return parseBackup(await file.text())
}
