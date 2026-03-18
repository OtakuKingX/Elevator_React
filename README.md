# 電梯管理系統模擬 Elevator Control Lab

以視覺化動畫呈現多部電梯的排程與運行過程，可自由調整樓層數、電梯數量與容量，並切換不同排程策略，觀察各參數與演算法對等待時間的影響。

## 功能

- **可調參數** — 樓層數（3–30）、電梯數（1–6）、電梯容量（2–20）、隨機乘客數（10–200），修改後即時重新模擬
- **多種排程策略** — 支援即時切換，比較不同演算法的效率差異：
  - **SCAN 掃描** — 優先完成同方向的請求再折返，減少空跑
  - **FCFS 先到先服務** — 優先前往最早等候的乘客所在樓層
  - **最近優先** — 不考慮方向，總是前往距離最近的需求樓層
- **逐秒動畫** — 完整模擬結果以快照方式儲存，支援播放 / 暫停 / 逐幀前進後退 / 速度調整
- **鍵盤快捷鍵** — `Space` 播放/暫停、`←` `→` 逐幀切換
- **統計面板** — 顯示總耗時、平均等待、平均乘坐、最長等待等數據
- **模擬日誌** — 逐秒文字紀錄，方便追蹤排程細節

## 快速開始

### 環境需求

- [Node.js](https://nodejs.org/) 18+
- npm 或其他套件管理工具

### 安裝與啟動

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev
```

瀏覽器開啟終端機顯示的網址（預設 http://localhost:5173）即可使用。

### 建置正式版

```bash
npm run build
npm run preview   # 本機預覽建置結果
```

### 執行測試

```bash
npm test          # 單次執行
npm run test:watch # 監控模式
```

## 操作說明

1. 在控制區調整 **樓層數**、**電梯數**、**電梯容量**、**隨機人數**
2. 從下拉選單選擇 **排程策略**（SCAN / FCFS / 最近優先）
3. 點擊「**重新模擬**」產生新的隨機情境
4. 使用播放列控制動畫播放，或用鍵盤快捷鍵操作
5. 觀察右上角統計卡片與底部日誌，比較不同策略的排程效率

## 專案結構

```
src/
├── App.tsx                  # 主元件：版面配置與 UI 組合
├── App.css                  # 全域樣式
├── store.ts                 # Zustand 狀態管理（參數、播放、模擬結果）
├── types.ts                 # TypeScript 型別定義
├── config.ts                # 預設參數與版面常數
├── simulation/              # 模擬引擎（純函式，不依賴 React）
│   ├── index.ts             # Barrel export
│   ├── engine.ts            # 主模擬迴圈
│   ├── strategies.ts        # 排程策略（Strategy Pattern）
│   └── helpers.ts           # RNG、方向計算等工具函式
└── components/
    ├── Building.tsx          # 大樓視覺化（電梯井 + 車廂動畫）
    ├── PlaybackControls.tsx  # 播放控制列
    ├── SimLog.tsx            # 模擬日誌
    └── StatsCard.tsx         # 統計數據卡片
```

## 技術棧

- **React 19** + **TypeScript 5.9**
- **Vite 8** — 開發伺服器與打包
- **Zustand** — 輕量狀態管理
- **Vitest** — 單元測試（29 個測試案例）
- 純 CSS 動畫，無額外 UI 框架
- 確定性偽隨機（seed-based RNG），同 seed 可重現結果

## 設計決策

### 模擬邏輯模組化

將原本單一的 `simulation.ts` 拆分為 `simulation/` 目錄：
- **helpers.ts** — 純工具函式，可獨立測試
- **strategies.ts** — 策略介面 + 具體實作，新增策略只需加一個物件
- **engine.ts** — 主迴圈，透過策略模式（Strategy Pattern）決定電梯方向

### 策略模式（Strategy Pattern）

所有排程演算法實作相同的 `SchedulingStrategy` 介面，模擬引擎不需要知道具體策略邏輯，新增策略只需：
1. 在 `strategies.ts` 新增一個 `SchedulingStrategy` 物件
2. 註冊到 `strategies` 表中

### Zustand 狀態管理

將 App.tsx 原本的多個 `useState` 整合到單一 store，每個 setter 自動觸發重新模擬並重置播放狀態。

## License

MIT
