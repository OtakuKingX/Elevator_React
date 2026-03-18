import type { Direction, Elevator, Passenger } from '../types'
import { directionTo, hasWaiting, nearestWaitingFloor } from './helpers'

// ── 策略類型與介面 ──

export type StrategyType = 'scan' | 'fcfs' | 'nearest'

export type SchedulingContext = {
  elevator: Elevator
  floors: number
  waitingByFloor: readonly Passenger[][]
  targetedFloors: Set<number>
}

export type SchedulingStrategy = {
  name: StrategyType
  label: string
  description: string
  decideDirection: (ctx: SchedulingContext) => Direction
}

// ── 輔助：找車內最近目的地 ──

const nearestDestination = (elevator: Elevator): number => {
  let nearest = elevator.passengers[0].to
  let best = Math.abs(nearest - elevator.floor)
  for (const p of elevator.passengers.slice(1)) {
    const d = Math.abs(p.to - elevator.floor)
    if (d < best) {
      best = d
      nearest = p.to
    }
  }
  return nearest
}

// ── SCAN 策略：優先同方向行駛，減少折返 ──

const scanStrategy: SchedulingStrategy = {
  name: 'scan',
  label: 'SCAN 掃描',
  description: '優先完成同方向的請求，再折返處理反方向',
  decideDirection({ elevator, floors, waitingByFloor, targetedFloors }) {
    if (elevator.passengers.length > 0) {
      const targets = elevator.passengers.map((p) => p.to)
      const sameDir =
        elevator.direction === 'up'
          ? targets.filter((t) => t > elevator.floor)
          : elevator.direction === 'down'
            ? targets.filter((t) => t < elevator.floor)
            : []
      if (sameDir.length > 0) {
        const nearest =
          elevator.direction === 'up' ? Math.min(...sameDir) : Math.max(...sameDir)
        return directionTo(elevator.floor, nearest)
      }
      return directionTo(elevator.floor, nearestDestination(elevator))
    }
    if (hasWaiting(waitingByFloor)) {
      const target = nearestWaitingFloor(elevator.floor, floors, waitingByFloor, targetedFloors)
      if (target !== null) {
        targetedFloors.add(target)
        return directionTo(elevator.floor, target)
      }
    }
    return 'idle'
  },
}

// ── FCFS 策略：先來先服務，優先處理最早等待的乘客 ──

const fcfsStrategy: SchedulingStrategy = {
  name: 'fcfs',
  label: 'FCFS 先到先服務',
  description: '優先前往最早等待的乘客所在樓層',
  decideDirection({ elevator, floors, waitingByFloor, targetedFloors }) {
    if (elevator.passengers.length > 0) {
      return directionTo(elevator.floor, nearestDestination(elevator))
    }
    if (hasWaiting(waitingByFloor)) {
      let earliestTime = Number.POSITIVE_INFINITY
      let earliestFloor: number | null = null
      for (let floor = 1; floor <= floors; floor++) {
        if (targetedFloors.has(floor)) continue
        for (const p of waitingByFloor[floor]) {
          if (p.createdAt < earliestTime) {
            earliestTime = p.createdAt
            earliestFloor = floor
          }
        }
      }
      if (earliestFloor !== null) {
        targetedFloors.add(earliestFloor)
        return directionTo(elevator.floor, earliestFloor)
      }
    }
    return 'idle'
  },
}

// ── Nearest 策略：總是前往最近的需求樓層 ──

const nearestStrategy: SchedulingStrategy = {
  name: 'nearest',
  label: '最近優先',
  description: '不考慮方向，總是前往最近的目標樓層',
  decideDirection({ elevator, floors, waitingByFloor, targetedFloors }) {
    if (elevator.passengers.length > 0) {
      return directionTo(elevator.floor, nearestDestination(elevator))
    }
    if (hasWaiting(waitingByFloor)) {
      const target = nearestWaitingFloor(elevator.floor, floors, waitingByFloor, targetedFloors)
      if (target !== null) {
        targetedFloors.add(target)
        return directionTo(elevator.floor, target)
      }
    }
    return 'idle'
  },
}

// ── 策略註冊表 ──

export const strategies: Record<StrategyType, SchedulingStrategy> = {
  scan: scanStrategy,
  fcfs: fcfsStrategy,
  nearest: nearestStrategy,
}

export const strategyList: SchedulingStrategy[] = Object.values(strategies)
