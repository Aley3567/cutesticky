export interface Vec { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }
export interface Brick extends Rect { alive: boolean; points: number }
export type BreakoutStatus = 'playing' | 'won' | 'lost'
export interface BreakoutState {
  width: number
  height: number
  ball: Rect
  velocity: Vec
  paddle: Rect
  bricks: Brick[]
  score: number
  status: BreakoutStatus
}

export function overlapRect(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function reflectBall(ball: Rect, velocity: Vec, target: Rect) {
  const centerDeltaX = (ball.x + ball.w / 2) - (target.x + target.w / 2)
  const centerDeltaY = (ball.y + ball.h / 2) - (target.y + target.h / 2)
  if (Math.abs(centerDeltaX / target.w) > Math.abs(centerDeltaY / target.h)) {
    return { x: -velocity.x, y: velocity.y }
  }
  return { x: velocity.x, y: -velocity.y }
}

export function stepBreakout(state: BreakoutState): BreakoutState {
  if (state.status !== 'playing') return state

  const ball = {
    ...state.ball,
    x: state.ball.x + state.velocity.x,
    y: state.ball.y + state.velocity.y,
  }
  let velocity = { ...state.velocity }
  let score = state.score
  const bricks = state.bricks.map(brick => ({ ...brick }))

  if (ball.x <= 0 || ball.x + ball.w >= state.width) velocity.x = -velocity.x
  if (ball.y <= 0) velocity.y = Math.abs(velocity.y)
  if (ball.y > state.height) return { ...state, ball, velocity, bricks, score, status: 'lost' }

  for (const brick of bricks) {
    if (!brick.alive || !overlapRect(ball, brick)) continue
    brick.alive = false
    score += brick.points
    velocity = reflectBall(ball, velocity, brick)
    break
  }

  if (velocity.y > 0 && overlapRect(ball, state.paddle)) {
    const ballCenter = ball.x + ball.w / 2
    const paddleCenter = state.paddle.x + state.paddle.w / 2
    const hitOffset = (ballCenter - paddleCenter) / (state.paddle.w / 2)
    const speed = Math.max(4, Math.hypot(velocity.x, velocity.y))
    velocity = {
      x: Math.max(-1, Math.min(1, hitOffset)) * speed * 0.75,
      y: -Math.abs(speed),
    }
  }

  const status = bricks.every(brick => !brick.alive) ? 'won' : 'playing'
  return { ...state, ball, velocity, bricks, score, status }
}
