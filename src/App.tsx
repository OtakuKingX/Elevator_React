import { useEffect, useMemo } from 'react'
import './App.css'
import { useSimStore } from './store'
import { strategyList, type StrategyType } from './simulation'
import { Building } from './components/Building'
import { PlaybackControls } from './components/PlaybackControls'
import { SimLog } from './components/SimLog'
import { StatsCard } from './components/StatsCard'

function App() {
  // ── 從 Zustand Store 取得狀態與操作 ──
  const {
    floors, elevatorCount, capacity, spawnCount, strategy,
    tick, playing, speed, result,
    setFloors, setElevatorCount, setCapacity, setSpawnCount, setStrategy,
    rerun, setTick, togglePlay, stepForward, stepBackward, setSpeed, tickForward,
  } = useSimStore()

  // ── 組裝 config 給 Building 元件使用 ──
  const config = useMemo(
    () => ({ floors, elevators: elevatorCount, capacity }),
    [floors, elevatorCount, capacity],
  )

  // ── 從模擬結果取出當前畫面需要的資料 ──
  const stats = result.stats
  const maxTick = Math.max(result.snapshots.length - 1, 0)
  const snapshot = result.snapshots[Math.min(tick, result.snapshots.length - 1)]
  const prevSnapshot =
    tick > 0 ? result.snapshots[Math.min(tick - 1, result.snapshots.length - 1)] : undefined

  const completedCount = useMemo(() => {
    if (!snapshot) return 0
    const totalWaiting = snapshot.waiting.reduce((s, w) => s + w.passengers.length, 0)
    const totalInElevator = snapshot.elevators.reduce((s, e) => s + e.passengerCount, 0)
    return Math.max(0, Math.min(snapshot.time, spawnCount) - totalWaiting - totalInElevator)
  }, [snapshot, spawnCount])

  // ── 自動播放（依速度調整間隔） ──
  useEffect(() => {
    if (!playing) return undefined
    const handle = window.setInterval(tickForward, 600 / speed)
    return () => window.clearInterval(handle)
  }, [playing, speed, tickForward])

  // ── 鍵盤快捷鍵（Space 播放/暫停、← → 逐幀） ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      switch (e.code) {
        case 'Space':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowRight':
          e.preventDefault()
          stepForward()
          break
        case 'ArrowLeft':
          e.preventDefault()
          stepBackward()
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay, stepForward, stepBackward])

  // ── 畫面結構 ──
  return (
    <div className="app">
      {/* ══ 頂部標題 + 統計卡片 ══ */}
      <header className="hero">
        <div>
          <p className="eyebrow">Elevator Control Lab</p>
          <h1>電梯管理系統模擬</h1>
          <p className="subtitle">
            {floors}層樓、{elevatorCount}部電梯、每秒一位乘客。
            可切換排程策略觀察不同演算法的效率差異。
          </p>
        </div>
        <StatsCard stats={stats} />
      </header>

      <section className="layout">
        {/* ══ 控制區：參數調整 + 策略選擇 + 重新模擬按鈕 ══ */}
        <div className="controls-section">
          <div className="controls">
            <label>
              樓層數
              <input
                type="number"
                min={3}
                max={30}
                value={floors}
                onChange={(e) => setFloors(Number(e.target.value))}
              />
            </label>
            <label>
              電梯數
              <input
                type="number"
                min={1}
                max={6}
                value={elevatorCount}
                onChange={(e) => setElevatorCount(Number(e.target.value))}
              />
            </label>
            <label>
              電梯容量
              <input
                type="number"
                min={2}
                max={20}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
              />
            </label>
            <label>
              隨機人數
              <input
                type="number"
                min={10}
                max={200}
                value={spawnCount}
                onChange={(e) => setSpawnCount(Number(e.target.value))}
              />
            </label>
            <label>
              排程策略
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as StrategyType)}
              >
                {strategyList.map((s) => (
                  <option key={s.name} value={s.name}>{s.label}</option>
                ))}
              </select>
            </label>
            <button onClick={rerun}>重新模擬</button>
          </div>
        </div>
        {/* ══ 主畫面：播放控制列 + 大樓動畫 ══ */}
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
