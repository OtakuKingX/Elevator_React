import { describe, it, expect } from 'vitest'
import { createRng, directionTo, formatFloor, randomFloor, nearestWaitingFloor } from './helpers'

describe('createRng', () => {
  it('相同種子產生相同序列', () => {
    const rng1 = createRng(42)
    const rng2 = createRng(42)
    expect(rng1()).toBe(rng2())
    expect(rng1()).toBe(rng2())
    expect(rng1()).toBe(rng2())
  })

  it('不同種子產生不同序列', () => {
    const rng1 = createRng(42)
    const rng2 = createRng(99)
    expect(rng1()).not.toBe(rng2())
  })

  it('產出值介於 0 ~ 1 之間', () => {
    const rng = createRng(42)
    for (let i = 0; i < 100; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('directionTo', () => {
  it('to > from → up', () => expect(directionTo(1, 5)).toBe('up'))
  it('to < from → down', () => expect(directionTo(5, 1)).toBe('down'))
  it('to === from → idle', () => expect(directionTo(3, 3)).toBe('idle'))
})

describe('formatFloor', () => {
  it('格式化為 F 前綴', () => {
    expect(formatFloor(1)).toBe('F1')
    expect(formatFloor(10)).toBe('F10')
  })
})

describe('randomFloor', () => {
  it('產出範圍介於 1 ~ floors', () => {
    const rng = createRng(42)
    for (let i = 0; i < 200; i++) {
      const floor = randomFloor(rng, 10)
      expect(floor).toBeGreaterThanOrEqual(1)
      expect(floor).toBeLessThanOrEqual(10)
    }
  })
})

describe('nearestWaitingFloor', () => {
  it('找到最近的等候樓層', () => {
    // floors: 0(unused), 1(empty), 2(has 1人), 3(empty), 4(empty), 5(has 1人)
    const waiting = [[], [], ['x'], [], [], ['x']]
    expect(nearestWaitingFloor(3, 5, waiting)).toBe(2)
  })

  it('沒有人等候時回傳 null', () => {
    const waiting: never[][] = [[], [], [], []]
    expect(nearestWaitingFloor(1, 3, waiting)).toBeNull()
  })

  it('排除指定樓層', () => {
    const waiting = [[], ['x'], ['x']]
    expect(nearestWaitingFloor(1, 2, waiting, new Set([1]))).toBe(2)
  })

  it('距離相同時選較低樓層', () => {
    // 從 2F 出發，1F 和 3F 距離一樣，應選 1F
    const waiting = [[], ['x'], [], ['x']]
    expect(nearestWaitingFloor(2, 3, waiting)).toBe(1)
  })
})
