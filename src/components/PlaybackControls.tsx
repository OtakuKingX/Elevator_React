type Props = {
  time: number
  completedCount: number
  spawnCount: number
  playing: boolean
  speed: number
  tick: number
  maxTick: number
  onStepBackward: () => void
  onTogglePlay: () => void
  onStepForward: () => void
  onSpeedChange: (speed: number) => void
  onTickChange: (tick: number) => void
}

export function PlaybackControls({
  time,
  completedCount,
  spawnCount,
  playing,
  speed,
  tick,
  maxTick,
  onStepBackward,
  onTogglePlay,
  onStepForward,
  onSpeedChange,
  onTickChange,
}: Props) {
  return (
    <>
      <div className="building-header">
        <h2>電梯視覺化</h2>
        <div className="playback">
          <span>t = {time}s</span>
          <span className="progress-badge">{completedCount}/{spawnCount} 完成</span>
          <button onClick={onStepBackward} aria-label="step back">◀</button>
          <button onClick={onTogglePlay}>{playing ? '⏸ 暫停' : '▶ 播放'}</button>
          <button onClick={onStepForward} aria-label="step forward">▶</button>
          <div className="speed-control">
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                className={`speed-btn ${speed === s ? 'active' : ''}`}
                onClick={() => onSpeedChange(s)}
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
        max={maxTick}
        value={tick}
        onChange={(event) => onTickChange(Number(event.target.value))}
      />
    </>
  )
}
