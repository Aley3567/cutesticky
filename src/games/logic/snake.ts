export interface Cell { x: number; y: number }
export type SnakeDir = 'up' | 'down' | 'left' | 'right'

export interface StepSnakeInput {
  snake: Cell[]
  dir: SnakeDir
  food: Cell
  size: number
}

export function nextSnakeHead(head: Cell, dir: SnakeDir) {
  if (dir === 'up') return { x: head.x, y: head.y - 1 }
  if (dir === 'down') return { x: head.x, y: head.y + 1 }
  if (dir === 'left') return { x: head.x - 1, y: head.y }
  return { x: head.x + 1, y: head.y }
}

export function hasSnakeCollision(head: Cell, body: Cell[], size: number) {
  return head.x < 0 || head.y < 0 || head.x >= size || head.y >= size
    || body.some(cell => cell.x === head.x && cell.y === head.y)
}

export function advanceSnake(snake: Cell[], dir: SnakeDir, food: Cell) {
  const head = nextSnakeHead(snake[0], dir)
  const ate = head.x === food.x && head.y === food.y
  return {
    snake: ate ? [head, ...snake] : [head, ...snake.slice(0, -1)],
    ate,
  }
}

export function stepSnake({ snake, dir, food, size }: StepSnakeInput) {
  const next = advanceSnake(snake, dir, food)
  return {
    ...next,
    dead: hasSnakeCollision(next.snake[0], snake.slice(0, -1), size),
  }
}
