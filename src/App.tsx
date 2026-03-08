import { useEffect, useMemo, useState } from 'react'
import './App.css'

// ========== 型別定義 ==========

// 方向：上、下、待機
type Direction = 'up' | 'down' | 'idle'

// 乘客完整資訊（用於模擬計算）
type Passenger = {
  id: number          // 乘客編號
  from: number        // 起始樓層
  to: number          // 目標樓層
  direction: Direction // 方向
  createdAt: number   // 產生時間
  pickedAt?: number   // 被接上的時間
  droppedAt?: number  // 抵達目標的時間
}

// 乘客顯示資訊（用於 UI 渲染）
type PassengerDisplay = {
  id: number
  to: number          // 要去哪一樓
  direction: Direction // 方向
}

// 電梯狀態
type Elevator = {
  id: number              // 電梯編號
  floor: number           // 當前樓層
  direction: Direction    // 當前方向
  passengers: Passenger[] // 車內乘客清單
}

// 模擬統計結果
type SimulationStats = {
  totalSeconds: number  // 總耗時（秒）
  averageWait: number   // 平均等待時間
  averageRide: number   // 平均乘坐時間
  maxWait: number       // 最長等待時間
}

// 每秒狀態快照（用於動畫播放）
type Snapshot = {
  time: number // 當前秒數
  elevators: Array<{
    id: number
    floor: number
    direction: Direction
    passengerCount: number
    passengers: PassengerDisplay[]
  }>
  waiting: Array<{ floor: number; passengers: PassengerDisplay[] }> // 每層等候的乘客
  pickups: Array<{ elevatorId: number; floor: number; count: number; direction: Direction }> // 接人事件
}

// 模擬結果
type SimulationResult = {
  logs: string[]       // 紀錄文字
  stats: SimulationStats // 統計數據
  snapshots: Snapshot[]  // 每秒快照
}

// ========== 設定參數 ==========

const CONFIG = {
  floors: 10,      // 樓層數
  elevators: 2,    // 電梯數量
  capacity: 5,     // 每部電梯容量
}

// UI 版面配置參數
const LAYOUT = {
  floorLabelWidth: 60, // 樓層標籤寬度
  shaftWidth: 80,      // 電梯井寬度
  carWidth: 72,        // 電梯車廂寬度
}

// ========== 工具函數 ==========

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

// ========== 模擬主函數 ==========

const simulate = (seed: number, spawnCount: number): SimulationResult => {
  const rng = createRng(seed)  // 隨機數產生器
  const logs: string[] = []    // 紀錄陣列
  const snapshots: Snapshot[] = [] // 每秒快照
  
  // 每層樓的等候隊列（索引 0 不使用，1~10 對應樓層）
  const waitingByFloor: Passenger[][] = Array.from(
    { length: CONFIG.floors + 1 },
    () => [],
  )
  
  const passengers: Passenger[] = [] // 所有乘客紀錄
  
  // 初始化電梯（都在 1 樓待機）
  const elevators: Elevator[] = Array.from({ length: CONFIG.elevators }, (_, i) => ({
    id: i + 1,
    floor: 1,
    direction: 'idle',
    passengers: [],
  }))

  let time = 0              // 當前秒數
  let createdCount = 0      // 已產生乘客數
  let completedCount = 0    // 已完成運送數

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

  // 計算從 from 到 to 應該往哪個方向
  const directionTo = (from: number, to: number): Direction => {
    if (to > from) return 'up'
    if (to < from) return 'down'
    return 'idle'
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

  pushSnapshot(0, []) // 記錄初始狀態

  // ========== 主迴圈：模擬每一秒 ==========
  while (completedCount < spawnCount) {
    logs.push(`t=${time}s`)
    const pickupEvents: Snapshot['pickups'] = [] // 這一秒的接人事件

    // 1. 每秒產生一位乘客
    if (createdCount < spawnCount) {
      const from = randomFloor(rng, CONFIG.floors)
      let to = randomFloor(rng, CONFIG.floors)
      // 確保起點終點不同
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
      waitingByFloor[from].push(passenger) // 加入該樓層等候隊列
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
          passenger.droppedAt = time // 記錄抵達時間
          completedCount += 1        // 完成人數 +1
        }
      }

      // 2.2 再接人（同向優先、不超載）
      const waitingHere = waitingByFloor[elevator.floor]
      const picked: Passenger[] = []
      if (waitingHere.length > 0 && elevator.passengers.length < CONFIG.capacity) {
        let pickupDirection = elevator.direction
        // 如果電梯空車，採用第一位等候者的方向
        if (elevator.passengers.length === 0 && pickupDirection === 'idle') {
          pickupDirection = waitingHere[0].direction
        }
        let remaining = CONFIG.capacity - elevator.passengers.length
        const stillWaiting: Passenger[] = []
        // 遍歷等候者，只接同向的（或電梯無方向時全接）
        for (const passenger of waitingHere) {
          if (remaining > 0 && (pickupDirection === 'idle' || passenger.direction === pickupDirection)) {
            passenger.pickedAt = time // 記錄上車時間
            picked.push(passenger)
            remaining -= 1
          } else {
            stillWaiting.push(passenger) // 方向不符或已滿載，留在等候
          }
        }
        waitingByFloor[elevator.floor] = stillWaiting
        if (picked.length > 0) {
          elevator.passengers = elevator.passengers.concat(picked)
          if (pickupDirection !== 'idle') {
            elevator.direction = pickupDirection
          }
          // 記錄接人事件
          pickupEvents.push({
            elevatorId: elevator.id,
            floor: elevator.floor,
            count: picked.length,
            direction: pickupDirection === 'idle' ? picked[0].direction : pickupDirection,
          })
        }
      }

      // 2.3 如果有放人或接人，這秒停站處理（耗時 1 秒）
      if (dropped.length > 0 || picked.length > 0) {
        logs.push(
          `  E${elevator.id} 停站 ${formatFloor(elevator.floor)} 放${dropped.length} 接${picked.length} 乘客(${elevator.passengers.length}/${CONFIG.capacity})`,
        )
        continue // 停站不移動，進入下一部電梯
      }

      // 2.4 決定電梯下一步移動方向（SCAN 策略：優先同方向行駛，減少折返）
      if (elevator.passengers.length > 0) {
        const targets = elevator.passengers.map((passenger) => passenger.to)
        // 優先繼續同方向行駛（SCAN 策略）
        const sameDir = elevator.direction === 'up'
          ? targets.filter((t) => t > elevator.floor)
          : elevator.direction === 'down'
            ? targets.filter((t) => t < elevator.floor)
            : []
        if (sameDir.length > 0) {
          const nearest = elevator.direction === 'up' ? Math.min(...sameDir) : Math.max(...sameDir)
          elevator.direction = directionTo(elevator.floor, nearest)
        } else {
          // 同方向無目標，找最近的（自然反轉）
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
        // 空車：前往最近的等候樓層（避開其他電梯已分配的目標）
        const targetFloor = nearestWaitingFloor(elevator.floor, targetedFloors)
        if (targetFloor !== null) {
          elevator.direction = directionTo(elevator.floor, targetFloor)
          targetedFloors.add(targetFloor)
        } else {
          elevator.direction = 'idle'
        }
      } else {
        // 無乘客也無人等候：待機
        elevator.direction = 'idle'
      }

      // 2.5 執行移動（耗時 1 秒）
      if (elevator.direction === 'idle') {
        logs.push(`  E${elevator.id} 待命 @ ${formatFloor(elevator.floor)}`)
      } else {
        elevator.floor += elevator.direction === 'up' ? 1 : -1 // 移動 1 層
        logs.push(
          `  E${elevator.id} 移動 ${elevator.direction === 'up' ? '↑' : '↓'} 到 ${formatFloor(elevator.floor)}`,
        )
      }
    }

    time += 1 // 時間前進 1 秒
    pushSnapshot(time, pickupEvents) // 記錄這一秒的狀態
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

// ========== React 組件 ==========

function App() {
  // 狀態管理
  const [spawnCount, setSpawnCount] = useState(40)  // 要模擬的人數
  const [result, setResult] = useState(() => simulate(42, 40)) // 模擬結果
  const [tick, setTick] = useState(0)      // 當前播放的時間點
  const [playing, setPlaying] = useState(false) // 是否正在播放
  const [speed, setSpeed] = useState(1) // 播放速度倍率
  
  const stats = useMemo(() => result.stats, [result]) // 統計數據
  const snapshot = result.snapshots[Math.min(tick, result.snapshots.length - 1)] // 當前快照
  const prevSnapshot =
    tick > 0 ? result.snapshots[Math.min(tick - 1, result.snapshots.length - 1)] : undefined // 前一秒快照
  
  // 每層等候乘客 Map（避免 O(n) 查詢）
  const waitingMap = useMemo(() => {
    const map = new Map<number, PassengerDisplay[]>()
    if (snapshot?.waiting) {
      for (const w of snapshot.waiting) {
        map.set(w.floor, w.passengers)
      }
    }
    return map
  }, [snapshot])

  // 已完成運送人數（從快照推算）
  const completedCount = useMemo(() => {
    if (!snapshot) return 0
    const totalWaiting = snapshot.waiting.reduce((s, w) => s + w.passengers.length, 0)
    const totalInElevator = snapshot.elevators.reduce((s, e) => s + e.passengerCount, 0)
    return Math.max(0, Math.min(snapshot.time, spawnCount) - totalWaiting - totalInElevator)
  }, [snapshot, spawnCount])

  // 樓層列表（從高到低）
  const floorsDescending = useMemo(
    () => Array.from({ length: CONFIG.floors }, (_, index) => CONFIG.floors - index),
    [],
  )

  // 渲染小人圖示
  const renderPeople = (passengers: PassengerDisplay[], variant: 'waiting' | 'car') => {
    const display = passengers.slice(0, CONFIG.capacity) // 最多顯示容量數
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

  // 取得方向符號
  const getDirSign = (dir: Direction) => {
    if (dir === 'up') return '▲'
    if (dir === 'down') return '▼'
    return '●'
  }

  // 計算電梯車廂的絕對定位樣式
  const getElevatorStyle = (elevator: Snapshot['elevators'][number], idx: number) => {
    const floorHeight = 100 / CONFIG.floors
    const topPercent = (CONFIG.floors - elevator.floor) * floorHeight // 10樓在頂部 0%, 1樓在底部 90%
    const leftPx =
      LAYOUT.floorLabelWidth + idx * LAYOUT.shaftWidth + (LAYOUT.shaftWidth - LAYOUT.carWidth) / 2
    return {
      top: `${topPercent}%`,
      left: `${leftPx}px`,
      height: `${floorHeight}%`,
    }
  }

  // 電梯 tooltip 顯示
  const getElevatorTooltip = (elevator: Snapshot['elevators'][number]) => {
    return `E${elevator.id}: ${elevator.passengerCount}/${CONFIG.capacity}`
  }

  // 重新模擬
  const handleRun = () => {
    const newSeed = Math.floor(Math.random() * 100000) // 隨機種子
    const simResult = simulate(newSeed, spawnCount)
    setResult(simResult)
    setTick(0)
    setPlaying(false)
  }

  // 切換播放/暫停
  const togglePlay = () => {
    setPlaying((value) => !value)
  }

  // 下一秒
  const stepForward = () => {
    setTick((value) => Math.min(value + 1, result.snapshots.length - 1))
  }

  // 上一秒
  const stepBackward = () => {
    setTick((value) => Math.max(value - 1, 0))
  }

  // 自動播放效果（依據速度調整間隔）
  useEffect(() => {
    if (!playing) return undefined
    const handle = window.setInterval(() => {
      setTick((value) => {
        if (value >= result.snapshots.length - 1) {
          setPlaying(false)
          return value
        }
        return value + 1
      })
    }, 600 / speed)
    return () => window.clearInterval(handle)
  }, [playing, result.snapshots.length, speed])

  // 鍵盤快捷鍵（Space 播放/暫停、← → 逐幀）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      switch (e.code) {
        case 'Space':
          e.preventDefault()
          setPlaying((v) => !v)
          break
        case 'ArrowRight':
          e.preventDefault()
          setTick((v) => Math.min(v + 1, result.snapshots.length - 1))
          break
        case 'ArrowLeft':
          e.preventDefault()
          setTick((v) => Math.max(v - 1, 0))
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [result.snapshots.length])

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
              <span className="progress-badge">{completedCount}/{spawnCount} 完成</span>
              <button onClick={stepBackward} aria-label="step back">◀</button>
              <button onClick={togglePlay}>{playing ? '⏸ 暫停' : '▶ 播放'}</button>
              <button onClick={stepForward} aria-label="step forward">▶</button>
              <div className="speed-control">
                {[1, 2, 4].map((s) => (
                  <button
                    key={s}
                    className={`speed-btn ${speed === s ? 'active' : ''}`}
                    onClick={() => setSpeed(s)}
                  >
                    {s}x
                  </button>
                ))}
              </div>
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
                const waitingPassengers = waitingMap.get(floor)
                return (
                  <div key={floor} className="floor-row">
                    <div className="floor-info">
                      <span className="floor-name">{floor}F</span>
                    </div>
                    {Array.from({ length: CONFIG.elevators }, (_, index) => (
                      <div key={`s-${floor}-${index}`} className="shaft" />
                    ))}
                    <div className="waiting-area">
                      {renderPeople(waitingPassengers ?? [], 'waiting')}
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
