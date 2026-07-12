import type { Platform, PlatformStore } from './types'
import { snapshotStorageValue } from './serialization'

const DB_NAME = 'cute-sticky'
const DB_VERSION = 1
const OBJECT_STORE = 'settings'
const LOCAL_PREFIX = 'cute-sticky:'
const MIGRATION_MARKER = `${LOCAL_PREFIX}indexeddb-migrated-v1`

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true })
    request.addEventListener('error', () => reject(request.error ?? new Error('IndexedDB request failed')), { once: true })
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true })
    transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('IndexedDB transaction aborted')), { once: true })
    transaction.addEventListener('error', () => reject(transaction.error ?? new Error('IndexedDB transaction failed')), { once: true })
  })
}

async function openDatabase(): Promise<IDBDatabase> {
  const request = indexedDB.open(DB_NAME, DB_VERSION)
  request.addEventListener('upgradeneeded', () => {
    if (!request.result.objectStoreNames.contains(OBJECT_STORE)) {
      request.result.createObjectStore(OBJECT_STORE)
    }
  })
  return requestResult(request)
}

class IndexedDbStore implements PlatformStore {
  private readonly database: IDBDatabase

  constructor(database: IDBDatabase) {
    this.database = database
  }

  async get<T>(key: string): Promise<T | undefined> {
    const transaction = this.database.transaction(OBJECT_STORE, 'readonly')
    return requestResult(transaction.objectStore(OBJECT_STORE).get(key)) as Promise<T | undefined>
  }

  async set<T>(key: string, value: T): Promise<void> {
    const transaction = this.database.transaction(OBJECT_STORE, 'readwrite')
    transaction.objectStore(OBJECT_STORE).put(snapshotStorageValue(value), key)
    await transactionDone(transaction)
  }

  async delete(key: string): Promise<boolean> {
    const existed = (await this.get(key)) !== undefined
    const transaction = this.database.transaction(OBJECT_STORE, 'readwrite')
    transaction.objectStore(OBJECT_STORE).delete(key)
    await transactionDone(transaction)
    return existed
  }

  async clear(): Promise<void> {
    const transaction = this.database.transaction(OBJECT_STORE, 'readwrite')
    transaction.objectStore(OBJECT_STORE).clear()
    await transactionDone(transaction)
  }

  async keys(): Promise<string[]> {
    const transaction = this.database.transaction(OBJECT_STORE, 'readonly')
    const keys = await requestResult(transaction.objectStore(OBJECT_STORE).getAllKeys())
    return keys.map(String)
  }

  async entries<T = unknown>(): Promise<Array<[string, T]>> {
    const transaction = this.database.transaction(OBJECT_STORE, 'readonly')
    const objectStore = transaction.objectStore(OBJECT_STORE)
    const [keys, values] = await Promise.all([
      requestResult(objectStore.getAllKeys()),
      requestResult(objectStore.getAll()) as Promise<T[]>,
    ])
    return keys.map((key, index) => [String(key), values[index]])
  }

  async save(): Promise<void> {
    // IndexedDB commits each write transaction immediately.
  }
}

class LocalStorageStore implements PlatformStore {
  private readonly storage: Storage | null

  constructor(storage: Storage | null) {
    this.storage = storage
  }

  private readonly memory = new Map<string, unknown>()

  async get<T>(key: string): Promise<T | undefined> {
    if (!this.storage) return this.memory.get(key) as T | undefined
    const raw = this.storage.getItem(LOCAL_PREFIX + key)
    if (raw === null) return undefined
    try {
      return JSON.parse(raw) as T
    } catch {
      console.warn(`忽略无法解析的本地数据：${key}`)
      return undefined
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    const snapshot = snapshotStorageValue(value)
    if (!this.storage) {
      this.memory.set(key, snapshot)
      return
    }
    this.storage.setItem(LOCAL_PREFIX + key, JSON.stringify(snapshot))
  }

  async delete(key: string): Promise<boolean> {
    const existed = (await this.get(key)) !== undefined
    if (this.storage) this.storage.removeItem(LOCAL_PREFIX + key)
    else this.memory.delete(key)
    return existed
  }

  async clear(): Promise<void> {
    if (!this.storage) {
      this.memory.clear()
      return
    }
    for (const key of await this.keys()) this.storage.removeItem(LOCAL_PREFIX + key)
  }

  async keys(): Promise<string[]> {
    if (!this.storage) return [...this.memory.keys()]
    const keys: string[] = []
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index)
      if (key?.startsWith(LOCAL_PREFIX) && key !== MIGRATION_MARKER) {
        keys.push(key.slice(LOCAL_PREFIX.length))
      }
    }
    return keys
  }

  async entries<T = unknown>(): Promise<Array<[string, T]>> {
    const entries: Array<[string, T]> = []
    for (const key of await this.keys()) {
      const value = await this.get<T>(key)
      if (value !== undefined) entries.push([key, value])
    }
    return entries
  }

  async save(): Promise<void> {
    // localStorage writes synchronously.
  }
}

function browserLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

async function migrateLocalStorage(store: PlatformStore): Promise<void> {
  const local = browserLocalStorage()
  if (!local || local.getItem(MIGRATION_MARKER) === 'true') return

  const legacy = new LocalStorageStore(local)
  for (const [key, value] of await legacy.entries()) {
    if ((await store.get(key)) === undefined) await store.set(key, value)
  }
  local.setItem(MIGRATION_MARKER, 'true')
}

export async function openWebStore(): Promise<PlatformStore> {
  if (typeof indexedDB === 'undefined') return new LocalStorageStore(browserLocalStorage())

  try {
    const store = new IndexedDbStore(await openDatabase())
    await migrateLocalStorage(store)
    return store
  } catch (error) {
    console.warn('IndexedDB 不可用，已降级到 localStorage', error)
    return new LocalStorageStore(browserLocalStorage())
  }
}

export function createWebPlatform(): Platform {
  return {
    kind: 'web',
    openStore: openWebStore,
    fetch(input, init) {
      return globalThis.fetch(input, init)
    },
    async notify({ title, body }) {
      if (!('Notification' in globalThis)) return false
      let permission = Notification.permission
      if (permission === 'default') permission = await Notification.requestPermission()
      if (permission !== 'granted') return false
      new Notification(title, { body })
      return true
    },
    async openExternal(url) {
      if (typeof window === 'undefined') return false
      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      if (opened) opened.opener = null
      return opened !== null
    },
    async hideWindow() {
      return false
    },
    async closeWindow() {
      return false
    },
  }
}
