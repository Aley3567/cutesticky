import { loadStickyStore } from '../services/stickyStore'

export function highscoreKey(id: string) {
  return `game:${id}:highscore`
}

export async function readHighscore(id: string) {
  const store = await loadStickyStore()
  return (await store.get<number>(highscoreKey(id))) ?? 0
}

export async function writeHighscore(id: string, value: number) {
  const store = await loadStickyStore()
  const previous = (await store.get<number>(highscoreKey(id))) ?? 0
  const next = Math.max(previous, value)
  await store.set(highscoreKey(id), next)
  await store.save()
  return next
}

export async function writeLowestBest(id: string, value: number) {
  const store = await loadStickyStore()
  const previous = (await store.get<number>(highscoreKey(id))) ?? 0
  const next = previous === 0 ? value : Math.min(previous, value)
  await store.set(highscoreKey(id), next)
  await store.save()
  return next
}
