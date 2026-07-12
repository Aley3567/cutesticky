import { describe, expect, it } from 'vitest'
import { clearLines, collides, rotateMatrix, scoreClearedLines } from '../logic/tetris'

describe('tetris logic', () => {
  it('rotates a matrix clockwise without changing the source shape', () => {
    const shape = [
      [1, 0, 0],
      [1, 1, 1],
    ]

    expect(rotateMatrix(shape)).toEqual([
      [1, 1],
      [1, 0],
      [1, 0],
    ])
    expect(shape).toEqual([
      [1, 0, 0],
      [1, 1, 1],
    ])
  })

  it('detects wall, floor, and occupied-cell collisions', () => {
    const board = [
      [0, 0, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]
    const shape = [
      [1, 1],
      [0, 1],
    ]

    expect(collides(board, shape, 1, 2)).toBe(false)
    expect(collides(board, shape, -1, 0)).toBe(true)
    expect(collides(board, shape, 3, 0)).toBe(true)
    expect(collides(board, shape, 1, 3)).toBe(true)
    expect(collides(board, shape, 1, 0)).toBe(true)
  })

  it('scores cleared lines with tetris-style scaling', () => {
    expect(scoreClearedLines(0)).toBe(0)
    expect(scoreClearedLines(1)).toBe(100)
    expect(scoreClearedLines(2)).toBe(300)
    expect(scoreClearedLines(3)).toBe(500)
    expect(scoreClearedLines(4)).toBe(800)
  })

  it('clears full rows and returns an independent board', () => {
    const board = [
      [1, 1, 1, 1],
      [1, 0, 0, 1],
      [1, 1, 1, 1],
      [0, 1, 0, 1],
    ]

    const result = clearLines(board)

    expect(result.cleared).toBe(2)
    expect(result.board).toEqual([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 0, 0, 1],
      [0, 1, 0, 1],
    ])

    result.board[2][0] = 9
    expect(board[1][0]).toBe(1)
  })
})
