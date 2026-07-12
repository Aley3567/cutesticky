import { getCurrentWindow } from '@tauri-apps/api/window'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'
import { open } from '@tauri-apps/plugin-shell'
import { load } from '@tauri-apps/plugin-store'
import type { Platform } from './types'
import { snapshotStorageValue } from './serialization'

export function createTauriPlatform(): Platform {
  return {
    kind: 'tauri',
    async openStore(name) {
      const store = await load(name, { autoSave: 100, defaults: {} })
      return {
        get<T>(key: string) {
          return store.get<T>(key)
        },
        set<T>(key: string, value: T) {
          return store.set(key, snapshotStorageValue(value))
        },
        delete(key: string) {
          return store.delete(key)
        },
        clear() {
          return store.clear()
        },
        keys() {
          return store.keys()
        },
        entries<T = unknown>() {
          return store.entries<T>()
        },
        save() {
          return store.save()
        },
      }
    },
    fetch(input, init) {
      return tauriFetch(input, init)
    },
    async notify({ title, body }) {
      let granted = await isPermissionGranted()
      if (!granted) granted = (await requestPermission()) === 'granted'
      if (!granted) return false
      sendNotification({ title, body })
      return true
    },
    async openExternal(url) {
      await open(url)
      return true
    },
    async hideWindow() {
      await getCurrentWindow().hide()
      return true
    },
    async closeWindow() {
      await getCurrentWindow().close()
      return true
    },
  }
}
