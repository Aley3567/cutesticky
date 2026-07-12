import { runDataMigrations } from '../data/migrations'
import { getPlatform } from '../platform'
import { openWebStore } from '../platform/web'
import type { PlatformStore } from '../platform/types'

const STORE_FILE = 'sticky-data.json'

export type StickyStore = PlatformStore

let storePromise: Promise<StickyStore> | null = null

export async function loadStickyStore(): Promise<StickyStore> {
  if (!storePromise) storePromise = openStickyStore()
  return storePromise
}

async function openStickyStore(): Promise<StickyStore> {
  let store: StickyStore
  try {
    store = await (await getPlatform()).openStore(STORE_FILE)
  } catch (error) {
    console.warn('主存储不可用，已启用浏览器本地降级存储', error)
    store = await openWebStore()
  }
  await runDataMigrations(store)
  return store
}
