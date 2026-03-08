import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { simulate } from './simulation'
import { Building } from './components/Building'
import { PlaybackControls } from './components/PlaybackControls'
import { SimLog } from './components/SimLog'
import { StatsCard } from './components/StatsCard'

function App() {
  const [spawnCount, setSpawnCount] = useState(40)
  const [result, setResult] = useState(() => simulate(42, 40))
  const [tick, setTick] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)

  const stats = useMemo(() => result.stats, [result])
  const snapshot = result.snapshots[Math.min(tick, result.snapshots.length - 1)]
  const prevSnapshot =
    tick > 0 ? result.snapshots[Math.min(tick - 1, result.snapshots.length - 1)] : undefined
  const maxTick = Math.max(result.snapshots.length - 1, 0)

  // 已完成運送人數（從快照推算）
  const completedCount = useMemo(() => {
    if (!snapshot) return 0
    const totalWaiting = snapshot.waiting.reduce((s, w) => s + w.passengers.length, 0)
    const totalInElevator = snapshot.elevators.reduce((s, e) => s + e.passengerCount, 0)
    return Math.max(0, Math.min(snapshot.time, spawnCount) - totalWaiting - totalInElevator)
  }, [snapshot, spawnCount])

  const handleRun = () => {
    const newSeed = Math.floor(Math.random() * 100000)
    setResult(simulate(newSeed, spawnCount))
    setTick(0)
    setPlaying(false)
  }

  const togglePlay = () => setPlaying((v) => !v)
  const stepForward = () => setTick((v) => Math.min(v + 1, maxTick))
  const stepBackward = () => setTick((v) => Math.max(v - 1, 0))

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
        <StatsCard stats={stats} />
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
          <Building snapshot={snapshot} prevSnapshot={prevSnapshot} />
        </div>
      </section>

      <SimLog logs={result.logs} />
    </div>
  )
}

export default App
