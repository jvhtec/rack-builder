import { useCallback, useRef, type RefCallback } from 'react'
import { useDrop } from 'react-dnd'
import {
  DEVICE_TYPE,
  PLACED_DEVICE_TYPE,
  type DeviceDragItem,
  type PlacedDeviceDragItem,
} from './DraggableDevice'
import type { XYCoord } from 'dnd-core'
import type { DeviceFacing, LayoutItemWithDevice } from '../../types'
import { isWithinBounds } from '../../lib/overlap'
import { RACK_SLOT_HEIGHT_PX, RACK_RAIL_WIDTH_PX } from './rackGeometry'

const SLOT_HEIGHT = RACK_SLOT_HEIGHT_PX

interface RackSlotProps {
  slotU: number
  totalRackUnits: number
  facing: DeviceFacing
  items: LayoutItemWithDevice[]
  laneCount?: 1 | 2
  slotHeight?: number
  canPlaceAtSlot?: (
    slotU: number,
    rackUnits: number,
    excludeItemId?: string,
    preferredLane?: 0 | 1,
  ) => boolean
  onDropNew: (deviceId: string, startU: number, rackUnits: number, preferredLane?: 0 | 1) => void
  onDropMove: (itemId: string, newStartU: number, preferredLane?: 0 | 1) => void
}

export default function RackSlot({
  slotU,
  totalRackUnits,
  facing,
  items,
  laneCount = 1,
  slotHeight = SLOT_HEIGHT,
  canPlaceAtSlot,
  onDropNew,
  onDropMove,
}: RackSlotProps) {
  const slotRef = useRef<HTMLDivElement | null>(null)

  const getPreferredLane = useCallback((point: XYCoord | null): 0 | 1 => {
    if (laneCount === 1) return 0
    if (!point || !slotRef.current) return 0

    const bounds = slotRef.current.getBoundingClientRect()
    const laneAreaLeft = bounds.left + RACK_RAIL_WIDTH_PX
    const laneAreaWidth = bounds.width - RACK_RAIL_WIDTH_PX * 2
    if (laneAreaWidth <= 0) return 0

    const visualLane = point.x >= laneAreaLeft + laneAreaWidth / 2 ? 1 : 0
    if (facing === 'rear') return (1 - visualLane) as 0 | 1
    return visualLane
  }, [facing, laneCount])

  const [{ isOver, canDrop }, dropRef] = useDrop<
    DeviceDragItem | PlacedDeviceDragItem,
    void,
    { isOver: boolean; canDrop: boolean }
  >({
    accept: [DEVICE_TYPE, PLACED_DEVICE_TYPE],
    canDrop: (dragItem, monitor) => {
      if (!isWithinBounds(slotU, dragItem.rackUnits, totalRackUnits)) return false
      const excludeId = dragItem.type === PLACED_DEVICE_TYPE ? dragItem.itemId : undefined
      const preferredLane = getPreferredLane(monitor.getClientOffset())
      if (canPlaceAtSlot) {
        return canPlaceAtSlot(slotU, dragItem.rackUnits, excludeId, preferredLane)
      }
      return !items
        .filter((item) => item.facing === facing && item.id !== excludeId)
        .some((item) => {
          const existingTop = item.start_u + item.device.rack_units - 1
          const droppedTop = slotU + dragItem.rackUnits - 1
          return slotU <= existingTop && droppedTop >= item.start_u
        })
    },
    drop: (dragItem, monitor) => {
      const preferredLane = getPreferredLane(monitor.getClientOffset())
      if (dragItem.type === PLACED_DEVICE_TYPE) {
        onDropMove(dragItem.itemId, slotU, preferredLane)
      } else {
        onDropNew(dragItem.deviceId, slotU, dragItem.rackUnits, preferredLane)
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  })
  const setRefs: RefCallback<HTMLDivElement> = useCallback((node) => {
    slotRef.current = node
    dropRef(node)
  }, [dropRef])

  let stateClass = ''
  if (isOver && canDrop) stateClass = 'rack-slot-drop-ok'
  else if (isOver && !canDrop) stateClass = 'rack-slot-drop-bad'

  return (
    <div
      ref={setRefs}
      className={`rack-slot-row ${stateClass}`}
      style={{ height: `${slotHeight}px` }}
    >
      <div className="rack-slot-track" />
    </div>
  )
}
