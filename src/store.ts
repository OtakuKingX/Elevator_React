import { create } from 'zustand'
import { DEFAULT_CONFIG } from './config'
import type { SimConfig, SimulationResult } from './types'
import { simulate, type StrategyType } from './simulation'

// ── 型別定義 ──

type SimStore = {
  // 模擬參數
  floors: number
  elevatorCount: number
  capacity: number
  spawnCount: number
  strategy: StrategyType
  seed: number

  // 播放控制
  tick: number
  playing: boolean
  speed: number

  // 模擬結果（由參數衍生）
  result: SimulationResult

  // 參數設定
  setFloors: (v: number) => void
  setElevatorCount: (v: number) => void
  setCapacity: (v: number) => void
  setSpawnCount: (v: number) => void
  setStrategy: (v: StrategyType) => void

  // 模擬控制
  rerun: () => void

  // 播放控制
  setTick: (v: number | ((prev: number) => number)) => void
  togglePlay: () => void
  stepForward: () => void
  stepBackward: () => void
  setSpeed: (v: number) => void
  tickForward: () => void
}

// ── 輔助：執行模擬 ──

const runSimulation = (
  floors: number,
  elevatorCount: number,
  capacity: number,
  spawnCount: number,
  seed: number,
  strategy: StrategyType,
): SimulationResult => {
  const config: SimConfig = { floors, elevators: elevatorCount, capacity }
  return simulate(seed, spawnCount, config, strategy)
}

// 初始模擬結果（避免首次 render 時沒有資料）
const initialResult = runSimulation(
  DEFAULT_CONFIG.floors,
  DEFAULT_CONFIG.elevators,
  DEFAULT_CONFIG.capacity,
  40,
  42,
  'scan',
)

// ── Zustand Store ──

export const useSimStore = create<SimStore>((set, get) => ({
  floors: DEFAULT_CONFIG.floors,
  elevatorCount: DEFAULT_CONFIG.elevators,
  capacity: DEFAULT_CONFIG.capacity,
  spawnCount: 40,
  strategy: 'scan',
  seed: 42,
  tick: 0,
  playing: false,
  speed: 1,
  result: initialResult,

  setFloors: (v) => {
    const clamped = Math.max(3, Math.min(30, v))
    const { elevatorCount, capacity, spawnCount, seed, strategy } = get()
    set({
      floors: clamped,
      result: runSimulation(clamped, elevatorCount, capacity, spawnCount, seed, strategy),
      tick: 0,
      playing: false,
    })
  },

  setElevatorCount: (v) => {
    const clamped = Math.max(1, Math.min(6, v))
    const { floors, capacity, spawnCount, seed, strategy } = get()
    set({
      elevatorCount: clamped,
      result: runSimulation(floors, clamped, capacity, spawnCount, seed, strategy),
      tick: 0,
      playing: false,
    })
  },

  setCapacity: (v) => {
    const clamped = Math.max(2, Math.min(20, v))
    const { floors, elevatorCount, spawnCount, seed, strategy } = get()
    set({
      capacity: clamped,
      result: runSimulation(floors, elevatorCount, clamped, spawnCount, seed, strategy),
      tick: 0,
      playing: false,
    })
  },

  setSpawnCount: (v) => {
    const { floors, elevatorCount, capacity, seed, strategy } = get()
    set({
      spawnCount: v,
      result: runSimulation(floors, elevatorCount, capacity, v, seed, strategy),
      tick: 0,
      playing: false,
    })
  },

  setStrategy: (v) => {
    const { floors, elevatorCount, capacity, spawnCount, seed } = get()
    set({
      strategy: v,
      result: runSimulation(floors, elevatorCount, capacity, spawnCount, seed, v),
      tick: 0,
      playing: false,
    })
  },

  rerun: () => {
    const newSeed = Math.floor(Math.random() * 100000)
    const { floors, elevatorCount, capacity, spawnCount, strategy } = get()
    set({
      seed: newSeed,
      result: runSimulation(floors, elevatorCount, capacity, spawnCount, newSeed, strategy),
      tick: 0,
      playing: false,
    })
  },

  setTick: (v) =>
    set((state) => ({
      tick: typeof v === 'function' ? v(state.tick) : v,
    })),

  togglePlay: () => set((state) => ({ playing: !state.playing })),

  stepForward: () =>
    set((state) => ({
      tick: Math.min(state.tick + 1, state.result.snapshots.length - 1),
    })),

  stepBackward: () =>
    set((state) => ({
      tick: Math.max(state.tick - 1, 0),
    })),

  setSpeed: (v) => set({ speed: v }),

  tickForward: () =>
    set((state) => {
      const maxTick = state.result.snapshots.length - 1
      if (state.tick >= maxTick) {
        return { playing: false }
      }
      return { tick: state.tick + 1 }
    }),
}))
