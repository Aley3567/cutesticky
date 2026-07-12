import { describe, expect, it } from 'vitest'
import { stepBreakout, type BreakoutState } from '../logic/breakout'

describe('stepBreakout', () => {
  it('breaks a hit brick, reflects the ball upward, and awards points', () => {
    const state: BreakoutState = {
      width: 120,
      height: 160,
      ball: { x: 55, y: 36, w: 8, h: 8 },
      velocity: { x: 0, y: -6 },
      paddle: { x: 40, y: 140, w: 40, h: 8 },
      bricks: [{ x: 48, y: 24, w: 24, h: 10, alive: true, points: 50 }],
      score: 0,
      status: 'playing',
    }

    const next = stepBreakout(state)

    expect(next.bricks).toEqual([{ x: 48, y: 24, w: 24, h: 10, alive: false, points: 50 }])
    expect(next.velocity.y).toBeGreaterThan(0)
    expect(next.score).toBe(50)
    expect(next.status).toBe('won')
  })

  it('reflects upward from the paddle and angles toward the hit side', () => {
    const state: BreakoutState = {
      width: 120,
      height: 160,
      ball: { x: 83, y: 130, w: 8, h: 8 },
      velocity: { x: 0, y: 6 },
      paddle: { x: 40, y: 140, w: 50, h: 8 },
      bricks: [{ x: 12, y: 20, w: 20, h: 10, alive: true, points: 10 }],
      score: 0,
      status: 'playing',
    }

    const next = stepBreakout(state)

    expect(next.velocity.y).toBeLessThan(0)
    expect(next.velocity.x).toBeGreaterThan(0)
    expect(next.score).toBe(0)
    expect(next.status).toBe('playing')
  })

  it('ends the round when the ball falls below the playfield', () => {
    const state: BreakoutState = {
      width: 120,
      height: 160,
      ball: { x: 56, y: 158, w: 8, h: 8 },
      velocity: { x: 0, y: 5 },
      paddle: { x: 40, y: 140, w: 40, h: 8 },
      bricks: [{ x: 12, y: 20, w: 20, h: 10, alive: true, points: 10 }],
      score: 30,
      status: 'playing',
    }

    const next = stepBreakout(state)

    expect(next.status).toBe('lost')
    expect(next.score).toBe(30)
  })
})
