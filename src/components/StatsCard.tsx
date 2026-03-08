import type { SimulationStats } from '../types'

type Props = {
  stats: SimulationStats
}

export function StatsCard({ stats }: Props) {
  return (
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
  )
}
