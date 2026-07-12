import { describe, expect, it } from 'vitest'
import { nextEnemySpawn, rectsOverlap, resolveBulletHits } from '../logic/shooter'

describe('shooter logic', () => {
  it('detects AABB collision only when rectangles overlap', () => {
    expect(
      rectsOverlap(
        { x: 10, y: 10, w: 12, h: 12 },
        { x: 18, y: 18, w: 10, h: 10 },
      ),
    ).toBe(true)

    expect(
      rectsOverlap(
        { x: 10, y: 10, w: 12, h: 12 },
        { x: 22, y: 10, w: 10, h: 10 },
      ),
    ).toBe(false)
  })

  it('schedules enemy spawns on fixed frame intervals within the playfield', () => {
    expect(nextEnemySpawn({ frame: 41, every: 42, playfieldWidth: 180 })).toBeNull()

    expect(nextEnemySpawn({ frame: 42, every: 42, playfieldWidth: 180, seed: 5 })).toEqual({
      id: 'enemy-42',
      x: 25,
      y: -24,
      w: 24,
      h: 20,
      speed: 1.7,
    })
  })

  it('removes bullets and enemies on hit and awards one point per kill', () => {
    const result = resolveBulletHits({
      bullets: [
        { id: 'bullet-hit', x: 50, y: 40, w: 4, h: 12 },
        { id: 'bullet-miss', x: 120, y: 80, w: 4, h: 12 },
      ],
      enemies: [
        { id: 'enemy-hit', x: 46, y: 34, w: 24, h: 20, speed: 1.7 },
        { id: 'enemy-safe', x: 140, y: 34, w: 24, h: 20, speed: 1.7 },
      ],
      score: 3,
    })

    expect(result).toEqual({
      bullets: [{ id: 'bullet-miss', x: 120, y: 80, w: 4, h: 12 }],
      enemies: [{ id: 'enemy-safe', x: 140, y: 34, w: 24, h: 20, speed: 1.7 }],
      score: 4,
      kills: 1,
    })
  })
})
