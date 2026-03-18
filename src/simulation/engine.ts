import type { Direction, Elevator, Passenger, SimConfig, SimulationResult, Snapshot } from '../types'
import { createRng, formatFloor, randomFloor } from './helpers'
import { strategies, type StrategyType } from './strategies'

const MAX_TICK_FACTOR = 10 // 安全上限 = spawnCount * floors * MAX_TICK_FACTOR

export const simulate = (
  seed: number,
  spawnCount: number,
  config: SimConfig,
  strategyType: StrategyType = 'scan',
): SimulationResult => {
  const { floors, elevators: elevatorCount, capacity } = config
  const strategy = strategies[strategyType]
  const rng = createRng(seed)
  const logs: string[] = []
  const snapshots: Snapshot[] = []

  // 每層樓的等候隊列（索引 0 不使用，1~floors 對應樓層）
  const waitingByFloor: Passenger[][] = Array.from(
    { length: floors + 1 },
    () => [],
  )

  const passengers: Passenger[] = []

  // 初始化電梯（都在 1 樓待機）
  const elevators: Elevator[] = Array.from({ length: elevatorCount }, (_, i) => ({
    id: i + 1,
    floor: 1,
    direction: 'idle' as Direction,
    passengers: [],
  }))

  let time = 0
  let createdCount = 0
  let completedCount = 0
  const maxTicks = spawnCount * floors * MAX_TICK_FACTOR

  // 記錄當前狀態快照
  const pushSnapshot = (snapshotTime: number, pickups: Snapshot['pickups']) => {
    snapshots.push({
      time: snapshotTime,
      elevators: elevators.map((e) => ({
        id: e.id,
        floor: e.floor,
        direction: e.direction,
        passengerCount: e.passengers.length,
        passengers: e.passengers.map((p) => ({ id: p.id, to: p.to, direction: p.direction })),
      })),
      waiting: Array.from({ length: floors }, (_, index) => {
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
  while (completedCount < spawnCount && time < maxTicks) {
    logs.push(`t=${time}s`)
    const pickupEvents: Snapshot['pickups'] = []

    // 1. 每秒產生一位乘客
    if (createdCount < spawnCount) {
      const from = randomFloor(rng, floors)
      let to = randomFloor(rng, floors)
      while (to === from) {
        to = randomFloor(rng, floors)
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

    // 2. 處理每部電梯
    const targetedFloors = new Set<number>()
    for (const elevator of elevators) {
      // 2.1 放人（到達目標樓層的乘客）
      const dropped = elevator.passengers.filter((p) => p.to === elevator.floor)
      if (dropped.length > 0) {
        elevator.passengers = elevator.passengers.filter((p) => p.to !== elevator.floor)
        for (const p of dropped) {
          p.droppedAt = time
          completedCount += 1
        }
      }

      // 2.2 接人（同向優先、不超載）
      const waitingHere = waitingByFloor[elevator.floor]
      const picked: Passenger[] = []
      if (waitingHere.length > 0 && elevator.passengers.length < capacity) {
        let pickupDirection = elevator.direction
        if (elevator.passengers.length === 0 && pickupDirection === 'idle') {
          pickupDirection = waitingHere[0].direction
        }
        let remaining = capacity - elevator.passengers.length
        const stillWaiting: Passenger[] = []
        for (const p of waitingHere) {
          if (remaining > 0 && (pickupDirection === 'idle' || p.direction === pickupDirection)) {
            p.pickedAt = time
            picked.push(p)
            remaining -= 1
          } else {
            stillWaiting.push(p)
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

      // 2.3 停站處理
      if (dropped.length > 0 || picked.length > 0) {
        logs.push(
          `  E${elevator.id} 停站 ${formatFloor(elevator.floor)} 放${dropped.length} 接${picked.length} 乘客(${elevator.passengers.length}/${capacity})`,
        )
        continue
      }

      // 2.4 使用策略決定方向
      elevator.direction = strategy.decideDirection({
        elevator,
        floors,
        waitingByFloor,
        targetedFloors,
      })

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
    (p) => (p.pickedAt ?? p.createdAt) - p.createdAt,
  )
  const rides = passengers.map(
    (p) => (p.droppedAt ?? p.createdAt) - (p.pickedAt ?? p.createdAt),
  )
  const averageWait = waits.reduce((s, v) => s + v, 0) / waits.length
  const averageRide = rides.reduce((s, v) => s + v, 0) / rides.length
  const maxWait = Math.max(...waits)

  return {
    logs,
    stats: { totalSeconds: time, averageWait, averageRide, maxWait },
    snapshots,
  }
}
