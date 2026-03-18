import { describe, it, expect } from 'vitest'
import { strategies } from './strategies'
import type { Elevator, Passenger, Direction } from '../types'

// 建立測試用電梯
const makeElevator = (
  overrides: Partial<Elevator> & { id: number; floor: number },
): Elevator => ({
  direction: 'idle' as Direction,
  passengers: [],
  ...overrides,
})

// 建立測試用乘客
const makePassenger = (
  overrides: Partial<Passenger> & { id: number; from: number; to: number },
): Passenger => ({
  direction: overrides.to > overrides.from ? 'up' : 'down',
  createdAt: 0,
  ...overrides,
})

// 建立空的等候佇列
const emptyWaiting = (floors: number): Passenger[][] =>
  Array.from({ length: floors + 1 }, () => [])

describe('SCAN 策略', () => {
  const scan = strategies.scan

  it('有同方向乘客時繼續同方向', () => {
    const elevator = makeElevator({
      id: 1, floor: 3, direction: 'up',
      passengers: [
        makePassenger({ id: 1, from: 1, to: 5 }),
        makePassenger({ id: 2, from: 2, to: 7 }),
      ],
    })
    const dir = scan.decideDirection({
      elevator, floors: 10,
      waitingByFloor: emptyWaiting(10),
      targetedFloors: new Set(),
    })
    expect(dir).toBe('up')
  })

  it('同方向無目標時折返', () => {
    const elevator = makeElevator({
      id: 1, floor: 5, direction: 'up',
      passengers: [makePassenger({ id: 1, from: 7, to: 3 })],
    })
    const dir = scan.decideDirection({
      elevator, floors: 10,
      waitingByFloor: emptyWaiting(10),
      targetedFloors: new Set(),
    })
    expect(dir).toBe('down')
  })

  it('空載時前往最近等候樓層', () => {
    const elevator = makeElevator({ id: 1, floor: 5 })
    const waiting = emptyWaiting(10)
    waiting[3] = [makePassenger({ id: 1, from: 3, to: 8 })]
    waiting[8] = [makePassenger({ id: 2, from: 8, to: 1 })]
    const dir = scan.decideDirection({
      elevator, floors: 10,
      waitingByFloor: waiting,
      targetedFloors: new Set(),
    })
    expect(dir).toBe('down') // 3F 比 8F 更近（距離 2 vs 3）
  })

  it('無任何需求時 idle', () => {
    const elevator = makeElevator({ id: 1, floor: 5 })
    const dir = scan.decideDirection({
      elevator, floors: 10,
      waitingByFloor: emptyWaiting(10),
      targetedFloors: new Set(),
    })
    expect(dir).toBe('idle')
  })
})

describe('FCFS 策略', () => {
  const fcfs = strategies.fcfs

  it('空載時前往最早等候者的樓層', () => {
    const elevator = makeElevator({ id: 1, floor: 5 })
    const waiting = emptyWaiting(10)
    waiting[8] = [makePassenger({ id: 1, from: 8, to: 1, createdAt: 0 })]
    waiting[3] = [makePassenger({ id: 2, from: 3, to: 7, createdAt: 5 })]
    const dir = fcfs.decideDirection({
      elevator, floors: 10,
      waitingByFloor: waiting,
      targetedFloors: new Set(),
    })
    expect(dir).toBe('up') // 8F 的乘客 createdAt=0 最早
  })

  it('有乘客時前往最近目的地', () => {
    const elevator = makeElevator({
      id: 1, floor: 5,
      passengers: [
        makePassenger({ id: 1, from: 1, to: 8 }),
        makePassenger({ id: 2, from: 2, to: 3 }),
      ],
    })
    const dir = fcfs.decideDirection({
      elevator, floors: 10,
      waitingByFloor: emptyWaiting(10),
      targetedFloors: new Set(),
    })
    expect(dir).toBe('down') // 3F 距離 2，8F 距離 3
  })
})

describe('最近優先策略', () => {
  const nearest = strategies.nearest

  it('不考慮方向，前往最近目的地', () => {
    const elevator = makeElevator({
      id: 1, floor: 5, direction: 'up',
      passengers: [
        makePassenger({ id: 1, from: 1, to: 8 }),
        makePassenger({ id: 2, from: 7, to: 3 }),
      ],
    })
    const dir = nearest.decideDirection({
      elevator, floors: 10,
      waitingByFloor: emptyWaiting(10),
      targetedFloors: new Set(),
    })
    expect(dir).toBe('down') // 3F 距離 2 < 8F 距離 3
  })

  it('空載時前往最近等候樓層', () => {
    const elevator = makeElevator({ id: 1, floor: 1 })
    const waiting = emptyWaiting(10)
    waiting[2] = [makePassenger({ id: 1, from: 2, to: 5 })]
    waiting[9] = [makePassenger({ id: 2, from: 9, to: 1 })]
    const dir = nearest.decideDirection({
      elevator, floors: 10,
      waitingByFloor: waiting,
      targetedFloors: new Set(),
    })
    expect(dir).toBe('up') // 2F 距離 1 < 9F 距離 8
  })
})
