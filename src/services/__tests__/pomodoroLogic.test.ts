import { describe, expect, it } from 'vitest'
import { nextPomodoroPhase, pomodoroDayKey, remainingSecondsAt } from '../pomodoroLogic'

describe('pomodoro timing logic', () => {
  it('derives remaining time from the absolute end timestamp after a delayed tick', () => {
    expect(remainingSecondsAt(40_000, 12_400, 1500)).toBe(28)
    expect(remainingSecondsAt(40_000, 41_000, 1500)).toBe(0)
  })

  it('moves to a long break after the fourth work round and resets after it', () => {
    expect(nextPomodoroPhase('work', 4)).toEqual({ phase: 'longBreak', round: 4 })
    expect(nextPomodoroPhase('longBreak', 4)).toEqual({ phase: 'work', round: 1 })
  })

  it('uses a local calendar key for daily completion totals', () => {
    expect(pomodoroDayKey(new Date(2026, 6, 11, 23, 59))).toBe('2026-07-11')
  })
})
