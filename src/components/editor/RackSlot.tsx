import type { LegacyRef } from 'react'
import { useDrop } from 'react-dnd'
import {
  DEVICE_TYPE,
  PLACED_DEVICE_TYPE,
  type DeviceDragItem,
  type PlacedDeviceDragItem,
} from './DraggableDevice'
import type { DeviceFacing, LayoutItemWithDevice } from '../../types'
import { hasOverlap, isWithinBounds } from '../../lib/overlap'

const SLOT_HEIGHT = 28

interface RackSlotProps {
  slotU: number
  totalRackUnits: number
  facing: DeviceFacing
  items: LayoutItemWithDevice[]
  onDropNew: (deviceId: string, startU: number, rackUnits: number) => void
  onDropMove: (itemId: string, newStartU: number) => void
}

export default function RackSlot({
  slotU,
  totalRackUnits,
  facing,
  items,
  onDropNew,
  onDropMove,
}: RackSlotProps) {
  const [{ isOver, canDrop }, dropRef] = useDrop<
    DeviceDragItem | PlacedDeviceDragItem,
    void,
    { isOver: boolean; canDrop: boolean }
  >({
    accept: [DEVICE_TYPE, PLACED_DEVICE_TYPE],
    canDrop: (dragItem) => {
      if (!isWithinBounds(slotU, dragItem.rackUnits, totalRackUnits)) return false
      const excludeId = dragItem.type === PLACED_DEVICE_TYPE ? dragItem.itemId : undefined
      return !hasOverlap(slotU, dragItem.rackUnits, facing, items, excludeId)
    },
    drop: (dragItem) => {
      if (dragItem.type === PLACED_DEVICE_TYPE) {
        onDropMove(dragItem.itemId, slotU)
      } else {
        onDropNew(dragItem.deviceId, slotU, dragItem.rackUnits)
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  })

  let bgClass = ''
  if (isOver && canDrop) bgClass = 'bg-green-100'
  else if (isOver && !canDrop) bgClass = 'bg-red-100'

  return (
    <div
      ref={dropRef as unknown as LegacyRef<HTMLDivElement>}
      className={`relative border-b border-gray-200 flex items-center ${bgClass}`}
      style={{ height: `${SLOT_HEIGHT}px` }}
    >
      <span className="text-[10px] text-gray-400 w-8 text-center shrink-0 select-none">
        {slotU}
      </span>
    </div>
  )
}
