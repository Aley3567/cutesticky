import { describe, expect, it } from 'vitest'
import { clampArcadeVolume } from '../audio'

describe('clampArcadeVolume', () => {
  it('keeps volume inside the supported range', () => {
    expect(clampArcadeVolume(-1)).toBe(0)
    expect(clampArcadeVolume(0.45)).toBe(0.45)
    expect(clampArcadeVolume(2)).toBe(1)
  })

  it('falls back for invalid values', () => {
    expect(clampArcadeVolume(Number.NaN)).toBe(0.65)
  })
})
