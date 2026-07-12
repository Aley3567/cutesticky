import { GAMES } from '../games/registry'
import { isWebRuntime } from '.'

type GameChunkLoader = () => Promise<unknown>

export function serviceWorkerUrl(version = import.meta.env.VITE_APP_VERSION || 'dev'): string {
  return `/sw.js?v=${encodeURIComponent(version)}`
}

export async function preloadOfflineGameChunks(
  loaders: GameChunkLoader[] = GAMES.map(game => game.component),
): Promise<void> {
  await Promise.allSettled(loaders.map(load => load()))
}

function waitForServiceWorkerControl(): Promise<boolean> {
  if (navigator.serviceWorker.controller) return Promise.resolve(true)

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      resolve(false)
    }, 10_000)
    const onControllerChange = () => {
      window.clearTimeout(timeout)
      resolve(Boolean(navigator.serviceWorker.controller))
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange, { once: true })
  })
}

function preloadCoreOfflineFeatures(): void {
  void navigator.serviceWorker.ready
    .then(waitForServiceWorkerControl)
    .then((controlled) => {
      if (!controlled) return
      const preload = () => {
        void preloadOfflineGameChunks().then(() => {
          window.dispatchEvent(new CustomEvent('cute-sticky:pwa-core-ready'))
        })
      }
      const requestIdle = (window as unknown as {
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
      }).requestIdleCallback
      if (requestIdle) {
        requestIdle.call(window, preload, { timeout: 4_000 })
      } else {
        window.setTimeout(preload, 1_500)
      }
    })
}

export function registerPwa(): void {
  if (!isWebRuntime || !import.meta.env.PROD || !('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(serviceWorkerUrl()).then((registration) => {
      preloadCoreOfflineFeatures()
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('cute-sticky:pwa-update'))
          }
        })
      })
    }).catch((error) => {
      console.warn('离线应用注册失败', error)
    })
  }, { once: true })
}
