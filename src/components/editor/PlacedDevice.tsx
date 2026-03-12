import type { LegacyRef } from 'react'
import { useDrag } from 'react-dnd'
import { PLACED_DEVICE_TYPE, type PlacedDeviceDragItem } from './DraggableDevice'
import type { DeviceFacing, LayoutItemWithDevice } from '../../types'
import { getDeviceImageUrl } from '../../hooks/useDevices'

const SLOT_HEIGHT = 28

interface PlacedDeviceProps {
  item: LayoutItemWithDevice
  facing: DeviceFacing
  onRemove: (itemId: string) => void
  onEditNotes: (item: LayoutItemWithDevice) => void
}

export default function PlacedDevice({ item, facing, onRemove, onEditNotes }: PlacedDeviceProps) {
  const [{ isDragging }, dragRef] = useDrag<PlacedDeviceDragItem, unknown, { isDragging: boolean }>({
    type: PLACED_DEVICE_TYPE,
    item: {
      type: PLACED_DEVICE_TYPE,
      itemId: item.id,
      deviceId: item.device_id,
      rackUnits: item.device.rack_units,
    },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  })

  const imageUrl = getDeviceImageUrl(
    facing === 'front' ? item.device.front_image_path : item.device.rear_image_path,
  )

  const height = item.device.rack_units * SLOT_HEIGHT

  return (
    <div
      ref={dragRef as unknown as LegacyRef<HTMLDivElement>}
      className={`absolute left-0 right-0 bg-blue-50 border border-blue-300 rounded-sm overflow-hidden cursor-grab active:cursor-grabbing z-10 ${
        isDragging ? 'opacity-40' : ''
      }`}
      style={{ height: `${height}px` }}
    >
      <div className="flex items-center h-full px-1 gap-1">
        {imageUrl && (
          <img src={imageUrl} alt={item.device.model} className="h-full w-12 object-contain shrink-0" />
        )}
        <div className="flex-1 min-w-0 px-1">
          <div className="text-xs font-medium truncate">
            {item.device.brand} {item.device.model}
          </div>
          {item.notes && <div className="text-[10px] text-gray-500 truncate">{item.notes}</div>}
        </div>
        <div className="flex gap-0.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEditNotes(item) }}
            className="text-gray-400 hover:text-blue-600 text-xs px-1"
            title="Notes"
          >
            N
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(item.id) }}
            className="text-gray-400 hover:text-red-600 text-xs px-1"
            title="Remove"
          >
            &times;
          </button>
        </div>
      </div>
    </div>
  )
}
