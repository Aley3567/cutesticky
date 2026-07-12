import type { PlatformStore } from '../platform/types'
import { CURRENT_SCHEMA_VERSION, SCHEMA_VERSION_KEY } from './schema'

export async function runDataMigrations(store: PlatformStore): Promise<void> {
  const savedVersion = await store.get<number>(SCHEMA_VERSION_KEY)
  const version = Number.isInteger(savedVersion) ? (savedVersion as number) : 0

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(`数据版本 ${version} 高于当前应用支持的 ${CURRENT_SCHEMA_VERSION}`)
  }

  // v1 establishes a versioned envelope while preserving all existing keys.
  if (version < 1) await store.set(SCHEMA_VERSION_KEY, 1)
  await store.save()
}
