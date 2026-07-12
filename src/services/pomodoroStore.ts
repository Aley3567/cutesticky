import { reactive } from 'vue'
import { sendPlatformNotification } from '../platform'
import { loadStickyStore, type StickyStore } from './stickyStore'
import {
  POMODORO_DURATIONS,
  nextPomodoroPhase,
  pomodoroDayKey,
  remainingSecondsAt,
  type PomodoroPhase,
} from './pomodoroLogic'

export interface FocusTask {
  id: number
  text: string
}

interface SavedPomodoroState {
  phase: PomodoroPhase
  round: number
  totalSeconds: number
  remainingSeconds: number
  running: boolean
  endsAt: number | null
  activeTask: FocusTask | null
  statsDate: string
  todayRounds: number
}

export interface PomodoroEvent {
  title: string
  body: string
}

const initialState = (): SavedPomodoroState => ({
  phase: 'work',
  round: 1,
  totalSeconds: POMODORO_DURATIONS.work,
  remainingSeconds: POMODORO_DURATIONS.work,
  running: false,
  endsAt: null,
  activeTask: null,
  statsDate: pomodoroDayKey(),
  todayRounds: 0,
})

export const pomodoroState = reactive<SavedPomodoroState>(initialState())

let store: StickyStore | null = null
let initializePromise: Promise<void> | null = null
let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<(event: PomodoroEvent) => void>()

export function initializePomodoro(): Promise<void> {
  if (!initializePromise) initializePromise = doInitialize()
  return initializePromise
}

async function doInitialize() {
  store = await loadStickyStore()
  const saved = await store.get<Partial<SavedPomodoroState>>('pomodoroState')
  if (saved && isPhase(saved.phase)) {
    Object.assign(pomodoroState, initialState(), saved)
  }
  resetDailyStatsIfNeeded()
  tickPomodoro()
  if (pomodoroState.running) ensureTimer()
}

function isPhase(value: unknown): value is PomodoroPhase {
  return value === 'work' || value === 'shortBreak' || value === 'longBreak'
}

function resetDailyStatsIfNeeded() {
  const today = pomodoroDayKey()
  if (pomodoroState.statsDate === today) return
  pomodoroState.statsDate = today
  pomodoroState.todayRounds = 0
}

function ensureTimer() {
  if (!timer) timer = setInterval(tickPomodoro, 500)
}

function stopTimer() {
  if (timer) clearInterval(timer)
  timer = null
}

async function persistPomodoro() {
  await initializePomodoro()
  await store?.set('pomodoroState', { ...pomodoroState })
  await store?.save()
}

function emit(event: PomodoroEvent) {
  for (const listener of listeners) listener(event)
  void sendPlatformNotification(event)
}

function transitionPhase(completedNaturally: boolean, now = Date.now()) {
  const completedPhase = pomodoroState.phase
  if (completedNaturally && completedPhase === 'work') {
    resetDailyStatsIfNeeded()
    pomodoroState.todayRounds += 1
  }

  const next = nextPomodoroPhase(completedPhase, pomodoroState.round)
  pomodoroState.phase = next.phase
  pomodoroState.round = next.round
  pomodoroState.totalSeconds = POMODORO_DURATIONS[next.phase]
  pomodoroState.remainingSeconds = pomodoroState.totalSeconds
  pomodoroState.endsAt = pomodoroState.running ? now + pomodoroState.totalSeconds * 1000 : null

  if (next.phase === 'work') {
    emit({ title: '开始专注', body: `第 ${next.round} 轮，专注 25 分钟` })
  } else if (next.phase === 'longBreak') {
    emit({ title: '长休息', body: '完成 4 轮专注，休息 15 分钟' })
  } else {
    emit({ title: '短休息', body: `第 ${pomodoroState.round} 轮完成，休息 5 分钟` })
  }
  void persistPomodoro()
}

export function tickPomodoro(now = Date.now()) {
  resetDailyStatsIfNeeded()
  if (!pomodoroState.running) return

  pomodoroState.remainingSeconds = remainingSecondsAt(
    pomodoroState.endsAt,
    now,
    pomodoroState.remainingSeconds,
  )
  if (pomodoroState.remainingSeconds === 0) transitionPhase(true, now)
}

export async function togglePomodoro(now = Date.now()) {
  await initializePomodoro()
  if (pomodoroState.running) {
    tickPomodoro(now)
    pomodoroState.running = false
    pomodoroState.endsAt = null
    stopTimer()
  } else {
    pomodoroState.running = true
    pomodoroState.endsAt = now + pomodoroState.remainingSeconds * 1000
    ensureTimer()
  }
  await persistPomodoro()
}

export async function resetPomodoro() {
  await initializePomodoro()
  stopTimer()
  const statsDate = pomodoroState.statsDate
  const todayRounds = pomodoroState.todayRounds
  Object.assign(pomodoroState, initialState(), { statsDate, todayRounds })
  await persistPomodoro()
}

export async function skipPomodoro() {
  await initializePomodoro()
  transitionPhase(false)
  await persistPomodoro()
}

export async function startFocusForTodo(task: FocusTask, now = Date.now()) {
  await initializePomodoro()
  if (pomodoroState.phase !== 'work') {
    pomodoroState.round = nextPomodoroPhase(pomodoroState.phase, pomodoroState.round).round
  }
  pomodoroState.activeTask = { ...task }
  pomodoroState.phase = 'work'
  pomodoroState.totalSeconds = POMODORO_DURATIONS.work
  pomodoroState.remainingSeconds = POMODORO_DURATIONS.work
  pomodoroState.running = true
  pomodoroState.endsAt = now + POMODORO_DURATIONS.work * 1000
  ensureTimer()
  await persistPomodoro()
}

export async function clearFocusTask() {
  await initializePomodoro()
  pomodoroState.activeTask = null
  await persistPomodoro()
}

export function subscribePomodoroEvents(listener: (event: PomodoroEvent) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
