export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Enemy extends Rect {
  id: string
  speed: number
}

export interface Bullet extends Rect {
  id: string
}

export interface EnemySpawnOptions {
  frame: number
  every?: number
  playfieldWidth: number
  seed?: number
}

export interface BulletHitState {
  bullets: Bullet[]
  enemies: Enemy[]
  score: number
}

export function rectsOverlap(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export const hit = rectsOverlap

export function shouldSpawnEnemy(frame: number, every = 42) {
  return frame > 0 && frame % every === 0
}

export function nextEnemySpawn({
  frame,
  every = 42,
  playfieldWidth,
  seed = frame,
}: EnemySpawnOptions): Enemy | null {
  if (!shouldSpawnEnemy(frame, every)) return null
  const width = 24
  const maxX = Math.max(0, playfieldWidth - width)
  return {
    id: `enemy-${frame}`,
    x: (seed * 5) % (maxX + 1),
    y: -24,
    w: width,
    h: 20,
    speed: 1.7,
  }
}

export function resolveBulletHits({ bullets, enemies, score }: BulletHitState) {
  const hitBulletIds = new Set<string>()
  const hitEnemyIds = new Set<string>()

  for (const bullet of bullets) {
    const enemy = enemies.find(candidate => !hitEnemyIds.has(candidate.id) && rectsOverlap(bullet, candidate))
    if (!enemy) continue
    hitBulletIds.add(bullet.id)
    hitEnemyIds.add(enemy.id)
  }

  const kills = hitEnemyIds.size

  return {
    bullets: bullets.filter(bullet => !hitBulletIds.has(bullet.id)),
    enemies: enemies.filter(enemy => !hitEnemyIds.has(enemy.id)),
    score: score + kills,
    kills,
  }
}
