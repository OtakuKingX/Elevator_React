// 方向：上、下、待機
export type Direction = 'up' | 'down' | 'idle'

// 乘客完整資訊（用於模擬計算）
export type Passenger = {
  id: number          // 乘客編號
  from: number        // 起始樓層
  to: number          // 目標樓層
  direction: Direction // 方向
  createdAt: number   // 產生時間
  pickedAt?: number   // 被接上的時間
  droppedAt?: number  // 抵達目標的時間
}

// 乘客顯示資訊（用於 UI 渲染）
export type PassengerDisplay = {
  id: number
  to: number          // 要去哪一樓
  direction: Direction // 方向
}

// 電梯狀態
export type Elevator = {
  id: number              // 電梯編號
  floor: number           // 當前樓層
  direction: Direction    // 當前方向
  passengers: Passenger[] // 車內乘客清單
}

// 模擬統計結果
export type SimulationStats = {
  totalSeconds: number  // 總耗時（秒）
  averageWait: number   // 平均等待時間
  averageRide: number   // 平均乘坐時間
  maxWait: number       // 最長等待時間
}

// 每秒狀態快照（用於動畫播放）
export type Snapshot = {
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
export type SimulationResult = {
  logs: string[]       // 紀錄文字
  stats: SimulationStats // 統計數據
  snapshots: Snapshot[]  // 每秒快照
}
