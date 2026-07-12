export type RuntimeKind = 'tauri' | 'web'

export interface PlatformStore {
  get<T>(key: string): Promise<T | null | undefined>
  set<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<boolean>
  clear(): Promise<void>
  keys(): Promise<string[]>
  entries<T = unknown>(): Promise<Array<[string, T]>>
  save(): Promise<void>
}

export interface PlatformNotification {
  title: string
  body: string
}

export interface Platform {
  readonly kind: RuntimeKind
  openStore(name: string): Promise<PlatformStore>
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
  notify(notification: PlatformNotification): Promise<boolean>
  openExternal(url: string): Promise<boolean>
  hideWindow(): Promise<boolean>
  closeWindow(): Promise<boolean>
}
