import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Direction = 'up' | 'down' | 'idle'

type Passenger = {
  id: number
  from: number
  to: number
  direction: Direction
  createdAt: number
  pickedAt?: number
  droppedAt?: number
}

type PassengerDisplay = {
  id: number
  to: number
  direction: Direction
}

type Elevator = {
  id: number
  floor: number
  direction: Direction
  passengers: Passenger[]
}

type SimulationStats = {
  totalSeconds: number
  averageWait: number
  averageRide: number
  maxWait: number
}

type Snapshot = {
  time: number
  elevators: Array<{
    id: number
    floor: number
    direction: Direction
    passengerCount: number
    passengers: PassengerDisplay[]
  }>
  waiting: Array<{ floor: number; passengers: PassengerDisplay[] }>
  pickups: Array<{ elevatorId: number; floor: number; count: number; direction: Direction }>
}

type SimulationResult = {
  logs: string[]
  stats: SimulationStats
  snapshots: Snapshot[]
}

const CONFIG = {
  floors: 10,
  elevators: 2,
  capacity: 5,
}

const LAYOUT = {
  floorLabelWidth: 60,
  shaftWidth: 80,
  carWidth: 72,
}

const createRng = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

const randomFloor = (rng: () => number, floors: number) =>
  1 + Math.floor(rng() * floors)

const formatFloor = (floor: number) => `F${floor}`

const simulate = (seed: number, spawnCount: number): SimulationResult => {
  const rng = createRng(seed)
  const logs: string[] = []
  const snapshots: Snapshot[] = []
  const waitingByFloor: Passenger[][] = Array.from(
    { length: CONFIG.floors + 1 },
    () => [],
  )
  const passengers: Passenger[] = []
  const elevators: Elevator[] = Array.from({ length: CONFIG.elevators }, (_, i) => ({
    id: i + 1,
    floor: 1,
    direction: 'idle',
    passengers: [],
  }))

  let time = 0
  let createdCount = 0
  let completedCount = 0

  const hasWaiting = () =>
    waitingByFloor.some((floorQueue, index) => index > 0 && floorQueue.length > 0)

  const nearestWaitingFloor = (currentFloor: number) => {
    let bestFloor: number | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    for (let floor = 1; floor <= CONFIG.floors; floor += 1) {
      if (waitingByFloor[floor].length === 0) continue
      const distance = Math.abs(floor - currentFloor)
      if (distance < bestDistance || (distance === bestDistance && floor < (bestFloor ?? floor))) {
        bestDistance = distance
        bestFloor = floor
      }
    }
    return bestFloor
  }

  const directionTo = (from: number, to: number): Direction => {
    if (to > from) return 'up'
    if (to < from) return 'down'
    return 'idle'
  }

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

  while (completedCount < spawnCount) {
    logs.push(`t=${time}s`)
    const pickupEvents: Snapshot['pickups'] = []

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

    for (const elevator of elevators) {
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

      if (dropped.length > 0 || picked.length > 0) {
        logs.push(
          `  E${elevator.id} 停站 ${formatFloor(elevator.floor)} 放${dropped.length} 接${picked.length} 乘客(${elevator.passengers.length}/${CONFIG.capacity})`,
        )
        continue
      }

      if (elevator.passengers.length > 0) {
        const targets = elevator.passengers.map((passenger) => passenger.to)
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
      } else if (hasWaiting()) {
        const targetFloor = nearestWaitingFloor(elevator.floor)
        if (targetFloor !== null) {
          elevator.direction = directionTo(elevator.floor, targetFloor)
        } else {
          elevator.direction = 'idle'
        }
      } else {
        elevator.direction = 'idle'
      }

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

function App() {
  const [spawnCount, setSpawnCount] = useState(40)
  // const [seed] = useState(42)
  const [result, setResult] = useState(() => simulate(42, 40))
  const [tick, setTick] = useState(0)
  const [playing, setPlaying] = useState(false)
  const stats = useMemo(() => result.stats, [result])
  const snapshot = result.snapshots[Math.min(tick, result.snapshots.length - 1)]
  const prevSnapshot =
    tick > 0 ? result.snapshots[Math.min(tick - 1, result.snapshots.length - 1)] : undefined
  const floorsDescending = useMemo(
    () => Array.from({ length: CONFIG.floors }, (_, index) => CONFIG.floors - index),
    [],
  )

  const renderPeople = (passengers: PassengerDisplay[], variant: 'waiting' | 'car') => {
    const display = passengers.slice(0, CONFIG.capacity)
    const people = display.map((p) => (
      <div key={`${variant}-${p.id}`} className={`person ${p.direction}`}>
        <div className="person-target">{p.to}</div>
      </div>
    ))
    return (
      <div className={`people ${variant}`}>
        {people}
        {passengers.length > display.length && (
          <span className="people-more">+{passengers.length - display.length}</span>
        )}
      </div>
    )
  }

  const getDirSign = (dir: Direction) => {
    if (dir === 'up') return '▲'
    if (dir === 'down') return '▼'
    return '●'
  }

  const getElevatorStyle = (elevator: Snapshot['elevators'][number], idx: number) => {
    const floorHeight = 100 / CONFIG.floors
    const topPercent = (CONFIG.floors - elevator.floor) * floorHeight
    const leftPx =
      LAYOUT.floorLabelWidth + idx * LAYOUT.shaftWidth + (LAYOUT.shaftWidth - LAYOUT.carWidth) / 2
    return {
      top: `${topPercent}%`,
      left: `${leftPx}px`,
      height: `${floorHeight}%`,
    }
  }

  const getElevatorTooltip = (elevator: Snapshot['elevators'][number]) => {
    return `E${elevator.id}: ${elevator.passengerCount}/${CONFIG.capacity}`
  }

  const handleRun = () => {
    const newSeed = Math.floor(Math.random() * 100000)
    const simResult = simulate(newSeed, spawnCount)
    setResult(simResult)
    setTick(0)
    setPlaying(false)
  }

  const togglePlay = () => {
    setPlaying((value) => !value)
  }

  const stepForward = () => {
    setTick((value) => Math.min(value + 1, result.snapshots.length - 1))
  }

  const stepBackward = () => {
    setTick((value) => Math.max(value - 1, 0))
  }

  useEffect(() => {
    if (!playing) return undefined
    const handle = window.setInterval(() => {
      setTick((value) => {
        if (value >= result.snapshots.length - 1) {
          return value
        }
        return value + 1
      })
    }, 600)
    return () => window.clearInterval(handle)
  }, [playing, result.snapshots.length])

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Elevator Control Lab</p>
          <h1>電梯管理系統模擬</h1>
          <p className="subtitle">
            10層樓、2部電梯、每秒一位乘客。採用「最近等待 + 同向優先」策略，
            目標是在固定規則下盡量縮短等待時間。
          </p>
        </div>
        <div className="hero-card">
          <div className="stat">
            <span>總耗時</span>
            <strong>{stats.totalSeconds}s</strong>
          </div>
          <div className="stat">
            <span>平均等待</span>
            <strong>{stats.averageWait.toFixed(2)}s</strong>
          </div>
          <div className="stat">
            <span>平均乘坐</span>
            <strong>{stats.averageRide.toFixed(2)}s</strong>
          </div>
          <div className="stat">
            <span>最大等待</span>
            <strong>{stats.maxWait}s</strong>
          </div>
        </div>
      </header>

      <section className="layout">
        <div className="controls-section">
          <div className="controls">
            <label>
              隨機人數
              <input
                type="number"
                min={10}
                max={200}
                value={spawnCount}
                onChange={(event) => setSpawnCount(Number(event.target.value))}
              />
            </label>
            <button onClick={handleRun}>重新模擬</button>
          </div>
        </div>
        <div className="panel building-panel">
          <div className="building-header">
            <h2>電梯視覺化</h2>
            <div className="playback">
              <span>t = {snapshot?.time ?? 0}s</span>
              <button onClick={stepBackward} aria-label="step back">◀</button>
              <button onClick={togglePlay}>{playing ? '暫停' : '播放'}</button>
              <button onClick={stepForward} aria-label="step forward">▶</button>
            </div>
          </div>
          <input
            className="timeline"
            type="range"
            min={0}
            max={Math.max(result.snapshots.length - 1, 0)}
            value={tick}
            onChange={(event) => setTick(Number(event.target.value))}
          />
          <div className="building">
            <div className="shaft-header">
              <div className="floor-label-header"></div>
              {Array.from({ length: CONFIG.elevators }, (_, index) => (
                <div key={`h-${index + 1}`} className="shaft-label">E{index + 1}</div>
              ))}
              <div className="waiting-label">等候區</div>
            </div>
            <div className="floors-container">
              {floorsDescending.map((floor) => {
                const waiting = snapshot?.waiting.find((entry) => entry.floor === floor)
                return (
                  <div key={floor} className="floor-row">
                    <div className="floor-info">
                      <span className="floor-name">{floor}F</span>
                    </div>
                    {Array.from({ length: CONFIG.elevators }, (_, index) => (
                      <div key={`s-${floor}-${index}`} className="shaft" />
                    ))}
                    <div className="waiting-area">
                      {renderPeople(waiting?.passengers ?? [], 'waiting')}
                    </div>
                  </div>
                )
              })}
              {snapshot?.elevators.map((elevator, idx) => {
                const prevElevator = prevSnapshot?.elevators.find((e) => e.id === elevator.id)
                const picked = snapshot.pickups.some(
                  (pickup) => pickup.elevatorId === elevator.id && pickup.floor === elevator.floor,
                )
                const dropped =
                  prevElevator &&
                  prevElevator.floor === elevator.floor &&
                  prevElevator.passengerCount > elevator.passengerCount
                const status = picked || dropped ? 'PROCESSING' : elevator.direction === 'idle' ? 'IDLE' : 'MOVING'
                return (
                  <div
                    key={`car-${elevator.id}`}
                    className={`elevator-car ${status}`}
                    style={getElevatorStyle(elevator, idx)}
                    title={getElevatorTooltip(elevator)}
                  >
                    <div className="car-body">
                      <div className={`door door-left ${status === 'PROCESSING' ? 'open' : ''}`} />
                      <div className={`door door-right ${status === 'PROCESSING' ? 'open' : ''}`} />
                      <div className="car-content">
                        <div className="direction">{getDirSign(elevator.direction)}</div>
                        <div className="load">{elevator.passengerCount}/{CONFIG.capacity}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="panel log-panel">
        <div className="log-header">
          <h2>模擬紀錄</h2>
          <span>共 {result.logs.length} 筆</span>
        </div>
        <pre className="log-output">{result.logs.join('\n')}</pre>
      </section>
    </div>
  )
}

export default App
