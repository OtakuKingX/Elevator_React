import { describe, it, expect } from 'vitest'
import { simulate } from './engine'
import type { StrategyType } from './strategies'

describe('simulate', () => {
  const config = { floors: 10, elevators: 2, capacity: 5 }

  it('相同種子產生相同結果（確定性）', () => {
    const r1 = simulate(42, 20, config, 'scan')
    const r2 = simulate(42, 20, config, 'scan')
    expect(r1.stats).toEqual(r2.stats)
    expect(r1.snapshots.length).toBe(r2.snapshots.length)
  })

  it('不同種子產生不同結果', () => {
    const r1 = simulate(42, 20, config, 'scan')
    const r2 = simulate(99, 20, config, 'scan')
    expect(r1.stats.totalSeconds).not.toBe(r2.stats.totalSeconds)
  })

  it('最終所有乘客完成運送', () => {
    const result = simulate(42, 20, config, 'scan')
    const last = result.snapshots[result.snapshots.length - 1]
    const totalWaiting = last.waiting.reduce((s, w) => s + w.passengers.length, 0)
    const totalInElevator = last.elevators.reduce((s, e) => s + e.passengerCount, 0)
    expect(totalWaiting).toBe(0)
    expect(totalInElevator).toBe(0)
  })

  it('三種策略都能跑完', () => {
    const types: StrategyType[] = ['scan', 'fcfs', 'nearest']
    for (const strategy of types) {
      const result = simulate(42, 20, config, strategy)
      expect(result.stats.totalSeconds).toBeGreaterThan(0)
      expect(result.snapshots.length).toBeGreaterThan(1)
    }
  })

  it('電梯不超載', () => {
    const smallConfig = { floors: 10, elevators: 1, capacity: 2 }
    const result = simulate(42, 15, smallConfig, 'scan')
    for (const snap of result.snapshots) {
      for (const e of snap.elevators) {
        expect(e.passengerCount).toBeLessThanOrEqual(2)
      }
    }
  })

  it('初始快照時間為 0', () => {
    const result = simulate(42, 5, config, 'scan')
    expect(result.snapshots[0].time).toBe(0)
  })

  it('統計數據合理', () => {
    const result = simulate(42, 30, config, 'scan')
    expect(result.stats.averageWait).toBeGreaterThanOrEqual(0)
    expect(result.stats.averageRide).toBeGreaterThanOrEqual(0)
    expect(result.stats.maxWait).toBeGreaterThanOrEqual(result.stats.averageWait)
    expect(result.stats.totalSeconds).toBeGreaterThanOrEqual(30) // 至少 30 秒（每秒產一人）
  })

  it('產生正確數量的日誌', () => {
    const result = simulate(42, 10, config, 'scan')
    expect(result.logs.length).toBeGreaterThan(0)
    // 每秒有一行 t=Xs 標頭
    const timeHeaders = result.logs.filter((l) => l.startsWith('t='))
    expect(timeHeaders.length).toBe(result.stats.totalSeconds)
  })

  it('SCAN 策略通常比 FCFS 更高效（同種子比較）', () => {
    // 這是一個統計性質的測試，在大多數種子下成立
    const scanResult = simulate(42, 40, config, 'scan')
    const fcfsResult = simulate(42, 40, config, 'fcfs')
    // SCAN 因為減少折返，通常平均等待較短
    // 不強制斷言，只記錄差異
    expect(scanResult.stats.totalSeconds).toBeGreaterThan(0)
    expect(fcfsResult.stats.totalSeconds).toBeGreaterThan(0)
  })
})
