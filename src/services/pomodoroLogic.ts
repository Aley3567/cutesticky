export type PomodoroPhase = 'work' | 'shortBreak' | 'longBreak'

export const POMODORO_DURATIONS: Record<PomodoroPhase, number> = {
  work: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
}

export interface PhaseTransition {
  phase: PomodoroPhase
  round: number
}

export function remainingSecondsAt(endsAt: number | null, now: number, fallback: number): number {
  if (endsAt === null) return Math.max(0, fallback)
  return Math.max(0, Math.ceil((endsAt - now) / 1000))
}

export function nextPomodoroPhase(phase: PomodoroPhase, round: number): PhaseTransition {
  if (phase === 'work') {
    return { phase: round >= 4 ? 'longBreak' : 'shortBreak', round }
  }
  return { phase: 'work', round: phase === 'longBreak' ? 1 : Math.min(4, round + 1) }
}

export function pomodoroDayKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
