import { describe, expect, it } from 'vitest'
import { stepSnake, type Cell } from '../logic/snake'

describe('snake logic', () => {
  it('moves one cell in the current direction without growing', () => {
    const snake: Cell[] = [
      { x: 2, y: 1 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ]

    expect(stepSnake({ snake, dir: 'right', food: { x: 4, y: 4 }, size: 6 })).toEqual({
      snake: [
        { x: 3, y: 1 },
        { x: 2, y: 1 },
        { x: 1, y: 1 },
      ],
      ate: false,
      dead: false,
    })
  })

  it('grows when the next head reaches food', () => {
    const snake: Cell[] = [
      { x: 2, y: 1 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ]

    expect(stepSnake({ snake, dir: 'right', food: { x: 3, y: 1 }, size: 6 })).toEqual({
      snake: [
        { x: 3, y: 1 },
        { x: 2, y: 1 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      ate: true,
      dead: false,
    })
  })

  it('dies when the next head leaves the board', () => {
    const snake: Cell[] = [
      { x: 5, y: 1 },
      { x: 4, y: 1 },
      { x: 3, y: 1 },
    ]

    expect(stepSnake({ snake, dir: 'right', food: { x: 0, y: 0 }, size: 6 })).toEqual({
      snake: [
        { x: 6, y: 1 },
        { x: 5, y: 1 },
        { x: 4, y: 1 },
      ],
      ate: false,
      dead: true,
    })
  })

  it('dies when the next head hits its own body', () => {
    const snake: Cell[] = [
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 1, y: 3 },
      { x: 1, y: 2 },
      { x: 1, y: 1 },
    ]

    expect(stepSnake({ snake, dir: 'down', food: { x: 5, y: 5 }, size: 6 })).toEqual({
      snake: [
        { x: 2, y: 3 },
        { x: 2, y: 2 },
        { x: 2, y: 3 },
        { x: 1, y: 3 },
        { x: 1, y: 2 },
      ],
      ate: false,
      dead: true,
    })
  })
})
