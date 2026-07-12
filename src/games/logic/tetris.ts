export type Matrix = number[][]

export function rotateMatrix(shape: Matrix) {
  return shape[0].map((_, x) => shape.map(row => row[x]).reverse())
}

export function collides(board: Matrix, shape: Matrix, ox: number, oy: number) {
  return shape.some((row, y) => row.some((cell, x) => {
    if (!cell) return false
    const bx = ox + x
    const by = oy + y
    return bx < 0 || bx >= board[0].length || by >= board.length || (by >= 0 && board[by][bx] > 0)
  }))
}

export function clearLines(board: Matrix) {
  const width = board[0].length
  const kept = board.filter(row => row.some(cell => cell === 0)).map(row => [...row])
  const cleared = board.length - kept.length
  return {
    cleared,
    board: [...Array.from({ length: cleared }, () => Array(width).fill(0)), ...kept],
  }
}

export function scoreClearedLines(cleared: number) {
  const scores = [0, 100, 300, 500, 800]
  return scores[cleared] ?? cleared * 200
}
