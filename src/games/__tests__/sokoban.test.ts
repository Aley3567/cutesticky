import { describe, expect, it } from 'vitest'
import {
  bestSokobanSteps,
  isSokobanComplete,
  moveSokoban,
  type SokobanState,
} from '../logic/sokoban'

describe('sokoban logic', () => {
  it('moves the player into an empty floor tile', () => {
    const state: SokobanState = {
      player: { x: 1, y: 1 },
      boxes: [],
      walls: [],
      goals: [],
      steps: 0,
    }

    expect(moveSokoban(state, 'right')).toEqual({
      moved: true,
      pushed: false,
      state: {
        ...state,
        player: { x: 2, y: 1 },
        steps: 1,
      },
    })
  })

  it('does not move or count a step into a wall', () => {
    const state: SokobanState = {
      player: { x: 1, y: 1 },
      boxes: [],
      walls: [{ x: 1, y: 0 }],
      goals: [],
      steps: 3,
    }

    expect(moveSokoban(state, 'up')).toEqual({
      moved: false,
      pushed: false,
      state,
    })
  })

  it('pushes a box when the space beyond it is open', () => {
    const state: SokobanState = {
      player: { x: 1, y: 1 },
      boxes: [{ x: 2, y: 1 }],
      walls: [],
      goals: [],
      steps: 4,
    }

    expect(moveSokoban(state, 'right')).toEqual({
      moved: true,
      pushed: true,
      state: {
        ...state,
        player: { x: 2, y: 1 },
        boxes: [{ x: 3, y: 1 }],
        steps: 5,
      },
    })
  })

  it('does not push a box into a blocked tile', () => {
    const state: SokobanState = {
      player: { x: 1, y: 1 },
      boxes: [{ x: 2, y: 1 }],
      walls: [{ x: 3, y: 1 }],
      goals: [],
      steps: 6,
    }

    expect(moveSokoban(state, 'right')).toEqual({
      moved: false,
      pushed: false,
      state,
    })
  })

  it('recognizes completion and keeps lower step counts as better scores', () => {
    const incomplete: SokobanState = {
      player: { x: 1, y: 1 },
      boxes: [{ x: 2, y: 1 }],
      walls: [],
      goals: [{ x: 3, y: 1 }],
      steps: 8,
    }
    const complete: SokobanState = {
      ...incomplete,
      boxes: [{ x: 3, y: 1 }],
    }

    expect(isSokobanComplete(incomplete)).toBe(false)
    expect(isSokobanComplete(complete)).toBe(true)
    expect(bestSokobanSteps(0, 12)).toBe(12)
    expect(bestSokobanSteps(15, 12)).toBe(12)
    expect(bestSokobanSteps(10, 12)).toBe(10)
  })
})
