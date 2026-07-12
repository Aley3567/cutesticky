import type { Platform, PlatformNotification } from './types'

function detectTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export const isDesktopRuntime = detectTauriRuntime()
export const isWebRuntime = !isDesktopRuntime

let platformPromise: Promise<Platform> | null = null

export function getPlatform(): Promise<Platform> {
  if (!platformPromise) {
    platformPromise = isDesktopRuntime
      ? import('./tauri').then(({ createTauriPlatform }) => createTauriPlatform())
      : import('./web').then(({ createWebPlatform }) => createWebPlatform())
  }
  return platformPromise
}

export async function platformFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return (await getPlatform()).fetch(input, init)
}

export async function sendPlatformNotification(notification: PlatformNotification): Promise<boolean> {
  try {
    return await (await getPlatform()).notify(notification)
  } catch (error) {
    console.warn('系统通知发送失败', error)
    return false
  }
}

export async function openExternal(url: string): Promise<boolean> {
  return (await getPlatform()).openExternal(url)
}

export async function hideAppWindow(): Promise<boolean> {
  return (await getPlatform()).hideWindow()
}

export async function closeAppWindow(): Promise<boolean> {
  return (await getPlatform()).closeWindow()
}

export type { Platform, PlatformNotification, PlatformStore, RuntimeKind } from './types'
