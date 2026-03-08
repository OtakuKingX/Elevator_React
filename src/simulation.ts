import { CONFIG } from './config'
import type { Direction, Elevator, Passenger, SimulationResult, Snapshot } from './types'

// 建立偽隨機數產生器（可重現結果）
const createRng = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

// 產生隨機樓層（1 ~ floors）
const randomFloor = (rng: () => number, floors: number) =>
  1 + Math.floor(rng() * floors)

// 格式化樓層顯示
const formatFloor = (floor: number) => `F${floor}`

// 計算從 from 到 to 應該往哪個方向
const directionTo = (from: number, to: number): Direction => {
  if (to > from) return 'up'
  if (to < from) return 'down'
  return 'idle'
}

export const simulate = (seed: number, spawnCount: number): SimulationResult => {
  const rng = createRng(seed)
  const logs: string[] = []
  const snapshots: Snapshot[] = []

  // 每層樓的等候隊列（索引 0 不使用，1~10 對應樓層）
  const waitingByFloor: Passenger[][] = Array.from(
    { length: CONFIG.floors + 1 },
    () => [],
  )

  const passengers: Passenger[] = []

  // 初始化電梯（都在 1 樓待機）
  const elevators: Elevator[] = Array.from({ length: CONFIG.elevators }, (_, i) => ({
    id: i + 1,
    floor: 1,
    direction: 'idle' as Direction,
    passengers: [],
  }))

  let time = 0
  let createdCount = 0
  let completedCount = 0

  // 檢查是否還有人在等候
  const hasWaiting = () =>
    waitingByFloor.some((floorQueue, index) => index > 0 && floorQueue.length > 0)

  // 找出離當前樓層最近的等候樓層（相同距離時選較低樓層）
  const nearestWaitingFloor = (currentFloor: number, exclude?: Set<number>) => {
    let bestFloor: number | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    for (let floor = 1; floor <= CONFIG.floors; floor += 1) {
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

  // 記錄當前狀態快照（用於動畫播放）
  const pushSnapshot = (snapshotTime: number, pickups: Snapshot['pickups']) => {
    snapshots.push({
      time: snapshotTime,
      elevators: elevators.map((elevator) => ({
        id: elevator.id,
        floor: elevator.floor,
        direction: elevator.direction,
        passengerCount: elevator.passengers.length,
        passengers: elevator.passengers.map((p) => ({ id: p.id, to: p.to, direction: p.direction })),
      })),
      waiting: Array.from({ length: CONFIG.floors }, (_, index) => {
        const floor = index + 1
        const queue = waitingByFloor[floor]
        return {
          floor,
          passengers: queue.map((p) => ({ id: p.id, to: p.to, direction: p.direction })),
        }
      }),
      pickups,
    })
  }

  pushSnapshot(0, [])

  // ========== 主迴圈：模擬每一秒 ==========
  while (completedCount < spawnCount) {
    logs.push(`t=${time}s`)
    const pickupEvents: Snapshot['pickups'] = []

    // 1. 每秒產生一位乘客
    if (createdCount < spawnCount) {
      const from = randomFloor(rng, CONFIG.floors)
      let to = randomFloor(rng, CONFIG.floors)
      while (to === from) {
        to = randomFloor(rng, CONFIG.floors)
      }
      const direction: Direction = to > from ? 'up' : 'down'
      const passenger: Passenger = {
        id: createdCount + 1,
        from,
        to,
        direction,
        createdAt: time,
      }
      passengers.push(passenger)
      waitingByFloor[from].push(passenger)
      createdCount += 1
      logs.push(
        `  +P${passenger.id} ${formatFloor(from)}→${formatFloor(to)} (${direction})`,
      )
    }

    // 2. 處理每部電梯（使用 targetedFloors 避免多台電梯前往同一樓層）
    const targetedFloors = new Set<number>()
    for (const elevator of elevators) {
      // 2.1 先放人（到達目標樓層的乘客）
      const dropped = elevator.passengers.filter(
        (passenger) => passenger.to === elevator.floor,
      )
      if (dropped.length > 0) {
        elevator.passengers = elevator.passengers.filter(
          (passenger) => passenger.to !== elevator.floor,
        )
        for (const passenger of dropped) {
          passenger.droppedAt = time
          completedCount += 1
        }
      }

      // 2.2 再接人（同向優先、不超載）
      const waitingHere = waitingByFloor[elevator.floor]
      const picked: Passenger[] = []
      if (waitingHere.length > 0 && elevator.passengers.length < CONFIG.capacity) {
        let pickupDirection = elevator.direction
        if (elevator.passengers.length === 0 && pickupDirection === 'idle') {
          pickupDirection = waitingHere[0].direction
        }
        let remaining = CONFIG.capacity - elevator.passengers.length
        const stillWaiting: Passenger[] = []
        for (const passenger of waitingHere) {
          if (remaining > 0 && (pickupDirection === 'idle' || passenger.direction === pickupDirection)) {
            passenger.pickedAt = time
            picked.push(passenger)
            remaining -= 1
          } else {
            stillWaiting.push(passenger)
          }
        }
        waitingByFloor[elevator.floor] = stillWaiting
        if (picked.length > 0) {
          elevator.passengers = elevator.passengers.concat(picked)
          if (pickupDirection !== 'idle') {
            elevator.direction = pickupDirection
          }
          pickupEvents.push({
            elevatorId: elevator.id,
            floor: elevator.floor,
            count: picked.length,
            direction: pickupDirection === 'idle' ? picked[0].direction : pickupDirection,
          })
        }
      }

      // 2.3 如果有放人或接人，這秒停站處理
      if (dropped.length > 0 || picked.length > 0) {
        logs.push(
          `  E${elevator.id} 停站 ${formatFloor(elevator.floor)} 放${dropped.length} 接${picked.length} 乘客(${elevator.passengers.length}/${CONFIG.capacity})`,
        )
        continue
      }

      // 2.4 決定電梯下一步移動方向（SCAN 策略：優先同方向行駛，減少折返）
      if (elevator.passengers.length > 0) {
        const targets = elevator.passengers.map((passenger) => passenger.to)
        const sameDir = elevator.direction === 'up'
          ? targets.filter((t) => t > elevator.floor)
          : elevator.direction === 'down'
            ? targets.filter((t) => t < elevator.floor)
            : []
        if (sameDir.length > 0) {
          const nearest = elevator.direction === 'up' ? Math.min(...sameDir) : Math.max(...sameDir)
          elevator.direction = directionTo(elevator.floor, nearest)
        } else {
          let nearestTarget = targets[0]
          let nearestDistance = Math.abs(nearestTarget - elevator.floor)
          for (const target of targets.slice(1)) {
            const distance = Math.abs(target - elevator.floor)
            if (distance < nearestDistance) {
              nearestDistance = distance
              nearestTarget = target
            }
          }
          elevator.direction = directionTo(elevator.floor, nearestTarget)
        }
      } else if (hasWaiting()) {
        const targetFloor = nearestWaitingFloor(elevator.floor, targetedFloors)
        if (targetFloor !== null) {
          elevator.direction = directionTo(elevator.floor, targetFloor)
          targetedFloors.add(targetFloor)
        } else {
          elevator.direction = 'idle'
        }
      } else {
        elevator.direction = 'idle'
      }

      // 2.5 執行移動
      if (elevator.direction === 'idle') {
        logs.push(`  E${elevator.id} 待命 @ ${formatFloor(elevator.floor)}`)
      } else {
        elevator.floor += elevator.direction === 'up' ? 1 : -1
        logs.push(
          `  E${elevator.id} 移動 ${elevator.direction === 'up' ? '↑' : '↓'} 到 ${formatFloor(elevator.floor)}`,
        )
      }
    }

    time += 1
    pushSnapshot(time, pickupEvents)
  }

  // ========== 計算統計數據 ==========
  const waits = passengers.map(
    (passenger) => (passenger.pickedAt ?? passenger.createdAt) - passenger.createdAt,
  )
  const rides = passengers.map(
    (passenger) => (passenger.droppedAt ?? passenger.createdAt) - (passenger.pickedAt ?? passenger.createdAt),
  )
  const averageWait = waits.reduce((sum, value) => sum + value, 0) / waits.length
  const averageRide = rides.reduce((sum, value) => sum + value, 0) / rides.length
  const maxWait = Math.max(...waits)

  return {
    logs,
    stats: {
      totalSeconds: time,
      averageWait,
      averageRide,
      maxWait,
    },
    snapshots,
  }
}
