export const BACKUP_FORMAT = 'cute-sticky-backup'
export const CURRENT_SCHEMA_VERSION = 1
export const INTERNAL_KEY_PREFIX = '__cuteSticky:'
export const SCHEMA_VERSION_KEY = `${INTERNAL_KEY_PREFIX}schemaVersion`
export const LAST_IMPORT_BACKUP_KEY = `${INTERNAL_KEY_PREFIX}lastImportBackup`

export type StoredData = Record<string, unknown>

export interface BackupEnvelope {
  format: typeof BACKUP_FORMAT
  schemaVersion: number
  exportedAt: string
  appVersion: string
  data: StoredData
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isBackupEnvelope(value: unknown): value is BackupEnvelope {
  if (!isRecord(value)) return false
  return value.format === BACKUP_FORMAT
    && Number.isInteger(value.schemaVersion)
    && (value.schemaVersion as number) > 0
    && typeof value.exportedAt === 'string'
    && !Number.isNaN(Date.parse(value.exportedAt))
    && typeof value.appVersion === 'string'
    && isRecord(value.data)
}
