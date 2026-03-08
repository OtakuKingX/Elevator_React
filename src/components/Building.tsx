import { useMemo } from 'react'
import { LAYOUT } from '../config'
import type { Direction, PassengerDisplay, SimConfig, Snapshot } from '../types'

type Props = {
  snapshot: Snapshot | undefined
  prevSnapshot: Snapshot | undefined
  config: SimConfig
}

const getDirSign = (dir: Direction) => {
  if (dir === 'up') return '▲'
  if (dir === 'down') return '▼'
  return '●'
}

const getElevatorStyle = (elevator: Snapshot['elevators'][number], idx: number, floors: number) => {
  const floorHeight = 100 / floors
  const topPercent = (floors - elevator.floor) * floorHeight
  const leftPx =
    LAYOUT.floorLabelWidth + idx * LAYOUT.shaftWidth + (LAYOUT.shaftWidth - LAYOUT.carWidth) / 2
  return {
    top: `${topPercent}%`,
    left: `${leftPx}px`,
    height: `${floorHeight}%`,
  }
}

const renderPeople = (passengers: PassengerDisplay[], variant: 'waiting' | 'car', capacity: number) => {
  const display = passengers.slice(0, capacity)
  const people = display.map((p) => (
    <div key={`${variant}-${p.id}`} className={`person ${p.direction}`}>
      <div className="person-target">{p.to}</div>
    </div>
  ))
  return (
    <div className={`people ${variant}`}>
      {people}
      {passengers.length > display.length && (
        <span className="people-more">+{passengers.length - display.length}</span>
      )}
    </div>
  )
}

export function Building({ snapshot, prevSnapshot, config }: Props) {
  const { floors, elevators: elevatorCount, capacity } = config

  // 樓層列表（從高到低）
  const floorsDescending = useMemo(
    () => Array.from({ length: floors }, (_, i) => floors - i),
    [floors],
  )
  // 每層等候乘客 Map（避免 O(n) 查詢）
  const waitingMap = useMemo(() => {
    const map = new Map<number, PassengerDisplay[]>()
    if (snapshot?.waiting) {
      for (const w of snapshot.waiting) {
        map.set(w.floor, w.passengers)
      }
    }
    return map
  }, [snapshot])

  return (
    <div className="building">
      <div className="shaft-header">
        <div className="floor-label-header"></div>
        {Array.from({ length: elevatorCount }, (_, index) => (
          <div key={`h-${index + 1}`} className="shaft-label">E{index + 1}</div>
        ))}
        <div className="waiting-label">等候區</div>
      </div>
      <div className="floors-container">
        {floorsDescending.map((floor) => {
          const waitingPassengers = waitingMap.get(floor)
          return (
            <div key={floor} className="floor-row">
              <div className="floor-info">
                <span className="floor-name">{floor}F</span>
              </div>
              {Array.from({ length: elevatorCount }, (_, index) => (
                <div key={`s-${floor}-${index}`} className="shaft" />
              ))}
              <div className="waiting-area">
                {renderPeople(waitingPassengers ?? [], 'waiting', capacity)}
              </div>
            </div>
          )
        })}
        {snapshot?.elevators.map((elevator, idx) => {
          const prevElevator = prevSnapshot?.elevators.find((e) => e.id === elevator.id)
          const picked = snapshot.pickups.some(
            (pickup) => pickup.elevatorId === elevator.id && pickup.floor === elevator.floor,
          )
          const dropped =
            prevElevator &&
            prevElevator.floor === elevator.floor &&
            prevElevator.passengerCount > elevator.passengerCount
          const status = picked || dropped ? 'PROCESSING' : elevator.direction === 'idle' ? 'IDLE' : 'MOVING'
          return (
            <div
              key={`car-${elevator.id}`}
              className={`elevator-car ${status}`}
              style={getElevatorStyle(elevator, idx, floors)}
              title={`E${elevator.id}: ${elevator.passengerCount}/${capacity}`}
            >
              <div className="car-body">
                <div className={`door door-left ${status === 'PROCESSING' ? 'open' : ''}`} />
                <div className={`door door-right ${status === 'PROCESSING' ? 'open' : ''}`} />
                <div className="car-content">
                  <div className="direction">{getDirSign(elevator.direction)}</div>
                    <div className="load">{elevator.passengerCount}/{capacity}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
