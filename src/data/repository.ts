import { loadStickyStore, type StickyStore } from '../services/stickyStore'
import {
  createBackup,
  importBackup,
  parseBackup,
  type BackupOptions,
  type ImportOptions,
  type ImportResult,
} from './backup'
import type { BackupEnvelope } from './schema'

export class DataRepository {
  private readonly store: StickyStore

  constructor(store: StickyStore) {
    this.store = store
  }

  get<T>(key: string): Promise<T | null | undefined> {
    return this.store.get<T>(key)
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.store.set(key, value)
    await this.store.save()
  }

  async remove(key: string): Promise<boolean> {
    const removed = await this.store.delete(key)
    await this.store.save()
    return removed
  }

  export(options?: BackupOptions): Promise<BackupEnvelope> {
    return createBackup(this.store, options)
  }

  import(source: string | BackupEnvelope, options?: ImportOptions): Promise<ImportResult> {
    return importBackup(this.store, typeof source === 'string' ? parseBackup(source) : source, options)
  }
}

let repositoryPromise: Promise<DataRepository> | null = null

export function loadDataRepository(): Promise<DataRepository> {
  if (!repositoryPromise) {
    repositoryPromise = loadStickyStore().then(store => new DataRepository(store))
  }
  return repositoryPromise
}
