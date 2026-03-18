import type { Direction } from '../types'

// 建立偽隨機數產生器（可重現結果）
export const createRng = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

// 產生隨機樓層（1 ~ floors）
export const randomFloor = (rng: () => number, floors: number) =>
  1 + Math.floor(rng() * floors)

// 格式化樓層顯示
export const formatFloor = (floor: number) => `F${floor}`

// 計算從 from 到 to 應該往哪個方向
export const directionTo = (from: number, to: number): Direction => {
  if (to > from) return 'up'
  if (to < from) return 'down'
  return 'idle'
}

// 檢查是否還有人在等候
export const hasWaiting = (waitingByFloor: readonly ArrayLike<unknown>[]) =>
  waitingByFloor.some((floorQueue, index) => index > 0 && floorQueue.length > 0)

// 找出離當前樓層最近的等候樓層（相同距離時選較低樓層）
export const nearestWaitingFloor = (
  currentFloor: number,
  floors: number,
  waitingByFloor: readonly ArrayLike<unknown>[],
  exclude?: Set<number>,
): number | null => {
  let bestFloor: number | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (let floor = 1; floor <= floors; floor += 1) {
    if (waitingByFloor[floor].length === 0) continue
    if (exclude?.has(floor)) continue
    const distance = Math.abs(floor - currentFloor)
    if (distance < bestDistance || (distance === bestDistance && floor < (bestFloor ?? floor))) {
      bestDistance = distance
      bestFloor = floor
    }
  }
  return bestFloor
}
