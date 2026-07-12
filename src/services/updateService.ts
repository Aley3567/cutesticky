import { reactive } from 'vue'
import type { Update } from '@tauri-apps/plugin-updater'
import { isDesktopRuntime } from '../platform'

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'restarting'
  | 'error'

export const updateState = reactive({
  phase: 'idle' as UpdatePhase,
  visible: false,
  currentVersion: '',
  version: '',
  notes: '',
  progress: 0,
  message: '',
})

let pendingUpdate: Update | null = null
let checkingPromise: Promise<void> | null = null
let feedbackTimer: number | null = null

function clearFeedbackTimer() {
  if (feedbackTimer !== null) window.clearTimeout(feedbackTimer)
  feedbackTimer = null
}

function showTemporaryMessage(message: string) {
  clearFeedbackTimer()
  updateState.phase = 'idle'
  updateState.message = message
  updateState.visible = true
  feedbackTimer = window.setTimeout(() => {
    if (updateState.phase === 'idle') updateState.visible = false
  }, 2600)
}

export function updateDownloadProgress(downloaded: number, total?: number): number {
  if (!total || total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((downloaded / total) * 100)))
}

export async function checkForUpdates(manual = false): Promise<void> {
  if (!isDesktopRuntime) return
  if (updateState.phase === 'available' && pendingUpdate) {
    updateState.visible = true
    return
  }
  if (checkingPromise) return checkingPromise

  checkingPromise = (async () => {
    clearFeedbackTimer()
    updateState.phase = 'checking'
    updateState.message = '正在检查新版本…'
    updateState.visible = manual

    try {
      const { check } = await import('@tauri-apps/plugin-updater')
      const update = await check({ timeout: 12_000 })
      if (!update) {
        pendingUpdate = null
        if (manual) showTemporaryMessage('已经是最新版')
        else updateState.phase = 'idle'
        return
      }

      pendingUpdate = update
      updateState.currentVersion = update.currentVersion
      updateState.version = update.version
      updateState.notes = update.body?.trim() || '包含体验优化与问题修复。'
      updateState.progress = 0
      updateState.message = ''
      updateState.phase = 'available'
      updateState.visible = true
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.warn('检查应用更新失败', error)
      if (manual) {
        updateState.phase = 'error'
        updateState.message = `暂时无法检查更新：${detail}`
        updateState.visible = true
      } else {
        updateState.phase = 'idle'
        updateState.visible = false
      }
    } finally {
      checkingPromise = null
    }
  })()

  return checkingPromise
}

export async function installPendingUpdate(): Promise<void> {
  if (!pendingUpdate || updateState.phase !== 'available') return

  clearFeedbackTimer()
  updateState.phase = 'downloading'
  updateState.progress = 0
  updateState.message = '正在下载更新…'

  let downloaded = 0
  let total: number | undefined
  try {
    await pendingUpdate.downloadAndInstall((event) => {
      if (event.event === 'Started') {
        total = event.data.contentLength
        downloaded = 0
      } else if (event.event === 'Progress') {
        downloaded += event.data.chunkLength
        updateState.progress = updateDownloadProgress(downloaded, total)
      } else {
        updateState.progress = 100
        updateState.phase = 'installing'
        updateState.message = '正在安装更新…'
      }
    })

    updateState.phase = 'restarting'
    updateState.message = '更新完成，正在重新启动…'
    const { relaunch } = await import('@tauri-apps/plugin-process')
    await relaunch()
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('安装应用更新失败', error)
    updateState.phase = 'error'
    updateState.message = `更新失败：${detail}`
  }
}

export function dismissUpdatePrompt() {
  if (updateState.phase === 'downloading' || updateState.phase === 'installing' || updateState.phase === 'restarting') return
  clearFeedbackTimer()
  updateState.visible = false
}
