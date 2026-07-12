export interface SokobanState {
  player: Cell
  boxes: Cell[]
  walls: Cell[]
  goals: Cell[]
  steps: number
}

export interface Cell { x: number; y: number }
export type SokobanDirection = 'up' | 'down' | 'left' | 'right'

export interface SokobanMoveResult {
  state: SokobanState
  moved: boolean
  pushed: boolean
}

const DIRECTION_DELTAS: Record<SokobanDirection, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export function cellKey(cell: Cell) {
  return `${cell.x}:${cell.y}`
}

export function canPushBox(state: SokobanState, box: Cell, delta: Cell) {
  const target = { x: box.x + delta.x, y: box.y + delta.y }
  const blocked = new Set([...state.walls, ...state.boxes.filter(b => b !== box)].map(cellKey))
  return !blocked.has(cellKey(target))
}

export function moveSokoban(state: SokobanState, direction: SokobanDirection): SokobanMoveResult {
  const delta = DIRECTION_DELTAS[direction]
  const nextPlayer = { x: state.player.x + delta.x, y: state.player.y + delta.y }
  if (state.walls.some(wall => cellKey(wall) === cellKey(nextPlayer))) {
    return { moved: false, pushed: false, state }
  }

  const box = state.boxes.find(candidate => cellKey(candidate) === cellKey(nextPlayer))
  if (box && canPushBox(state, box, delta)) {
    return {
      moved: true,
      pushed: true,
      state: {
        ...state,
        player: nextPlayer,
        boxes: state.boxes.map(candidate =>
          candidate === box ? { x: candidate.x + delta.x, y: candidate.y + delta.y } : candidate,
        ),
        steps: state.steps + 1,
      },
    }
  }
  if (box) return { moved: false, pushed: false, state }

  return {
    moved: true,
    pushed: false,
    state: {
      ...state,
      player: nextPlayer,
      steps: state.steps + 1,
    },
  }
}

export function isSokobanComplete(state: SokobanState) {
  const goals = new Set(state.goals.map(cellKey))
  return state.boxes.every(box => goals.has(cellKey(box)))
}

export function bestSokobanSteps(previous: number, current: number) {
  return previous === 0 ? current : Math.min(previous, current)
}
