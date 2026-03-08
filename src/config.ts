import type { SimConfig } from './types'

// 預設模擬設定
export const DEFAULT_CONFIG: SimConfig = {
  floors: 10,      // 樓層數
  elevators: 2,    // 電梯數量
  capacity: 5,     // 每部電梯容量
}

// UI 版面配置參數
export const LAYOUT = {
  floorLabelWidth: 60, // 樓層標籤寬度
  shaftWidth: 80,      // 電梯井寬度
  carWidth: 72,        // 電梯車廂寬度
}
