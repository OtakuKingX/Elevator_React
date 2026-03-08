import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { DEFAULT_CONFIG } from './config'
import type { SimConfig } from './types'
import { simulate } from './simulation'
import { Building } from './components/Building'
import { PlaybackControls } from './components/PlaybackControls'
import { SimLog } from './components/SimLog'
import { StatsCard } from './components/StatsCard'

function App() {
  // ── 使用者可調整的模擬參數 ──
  const [floors, setFloors] = useState(DEFAULT_CONFIG.floors)        // 樓層數
  const [elevatorCount, setElevatorCount] = useState(DEFAULT_CONFIG.elevators) // 電梯數
  const [capacity, setCapacity] = useState(DEFAULT_CONFIG.capacity)  // 每部電梯容量
  const [spawnCount, setSpawnCount] = useState(40)                   // 隨機產生乘客數

  // 將參數打包成 config 物件，任一值變動時自動更新
  const config: SimConfig = useMemo(
    () => ({ floors, elevators: elevatorCount, capacity }),
    [floors, elevatorCount, capacity],
  )

  // ── 模擬核心 ──
  const [seed, setSeed] = useState(42)  // 隨機種子，相同種子可重現相同結果
  // seed / spawnCount / config 任一變動 → 自動重新跑模擬
  const result = useMemo(() => simulate(seed, spawnCount, config), [seed, spawnCount, config])

  // ── 播放控制 ──
  const [tick, setTick] = useState(0)        // 目前播放到第幾秒
  const [playing, setPlaying] = useState(false) // 是否自動播放中
  const [speed, setSpeed] = useState(1)      // 播放速度倍率

  // 模擬結果變更時，自動回到第 0 秒並暫停
  // 採用「render 時比對前值」模式，避免在 useEffect 內同步 setState
  const [prevResult, setPrevResult] = useState(result)
  if (prevResult !== result) {
    setPrevResult(result)
    setTick(0)
    setPlaying(false)
  }

  // ── 從模擬結果取出當前畫面需要的資料 ──
  const stats = useMemo(() => result.stats, [result])  // 統計數據（平均等待、最長等待…）
  const snapshot = result.snapshots[Math.min(tick, result.snapshots.length - 1)]   // 當前秒的快照
  const prevSnapshot =  // 前一秒的快照（用來判斷是否剛接/放乘客）
    tick > 0 ? result.snapshots[Math.min(tick - 1, result.snapshots.length - 1)] : undefined
  const maxTick = Math.max(result.snapshots.length - 1, 0)  // 時間軸最大值

  // 已完成運送人數（從快照推算）
  const completedCount = useMemo(() => {
    if (!snapshot) return 0
    const totalWaiting = snapshot.waiting.reduce((s, w) => s + w.passengers.length, 0)
    const totalInElevator = snapshot.elevators.reduce((s, e) => s + e.passengerCount, 0)
    return Math.max(0, Math.min(snapshot.time, spawnCount) - totalWaiting - totalInElevator)
  }, [snapshot, spawnCount])

  // ── 操作函式 ──
  // 「重新模擬」按鈕：換一組隨機種子，觸發 useMemo 重算
  const handleRun = () => {
    setSeed(Math.floor(Math.random() * 100000))
    setTick(0)
    setPlaying(false)
  }

  const togglePlay = () => setPlaying((v) => !v)          // 播放 / 暫停
  const stepForward = () => setTick((v) => Math.min(v + 1, maxTick))  // 下一幀
  const stepBackward = () => setTick((v) => Math.max(v - 1, 0))      // 上一幀

  // 自動播放（依速度調整間隔）
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

  // ── 畫面結構 ──
  return (
    <div className="app">
      {/* ══ 頂部標題 + 統計卡片 ══ */}
      <header className="hero">
        <div>
          <p className="eyebrow">Elevator Control Lab</p>
          <h1>電梯管理系統模擬</h1>
          <p className="subtitle">
            {floors}層樓、{elevatorCount}部電梯、每秒一位乘客。採用「最近等待 + 同向優先」策略，
            目標是在固定規則下盡量縮短等待時間。
          </p>
        </div>
        <StatsCard stats={stats} />
      </header>

      <section className="layout">
        {/* ══ 左側控制區：參數調整 + 重新模擬按鈕 ══ */}
        <div className="controls-section">
          <div className="controls">
            <label>
              樓層數
              <input
                type="number"
                min={3}
                max={30}
                value={floors}
                onChange={(event) => setFloors(Math.max(3, Math.min(30, Number(event.target.value))))}
              />
            </label>
            <label>
              電梯數
              <input
                type="number"
                min={1}
                max={6}
                value={elevatorCount}
                onChange={(event) => setElevatorCount(Math.max(1, Math.min(6, Number(event.target.value))))}
              />
            </label>
            <label>
              電梯容量
              <input
                type="number"
                min={2}
                max={20}
                value={capacity}
                onChange={(event) => setCapacity(Math.max(2, Math.min(20, Number(event.target.value))))}
              />
            </label>
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
        {/* ══ 右側主畫面：播放控制列 + 大樓動畫 ══ */}
        <div className="panel building-panel">
          <PlaybackControls
            time={snapshot?.time ?? 0}
            completedCount={completedCount}
            spawnCount={spawnCount}
            playing={playing}
            speed={speed}
            tick={tick}
            maxTick={maxTick}
            onStepBackward={stepBackward}
            onTogglePlay={togglePlay}
            onStepForward={stepForward}
            onSpeedChange={setSpeed}
            onTickChange={setTick}
          />
          <Building snapshot={snapshot} prevSnapshot={prevSnapshot} config={config} />
        </div>
      </section>

      {/* ══ 底部模擬日誌 ══ */}
      <SimLog logs={result.logs} />
    </div>
  )
}

export default App
