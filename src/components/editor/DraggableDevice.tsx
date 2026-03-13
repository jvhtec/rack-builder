import type { LegacyRef } from 'react'
import { useDrag } from 'react-dnd'
import type { Device } from '../../types'
import { getDeviceImageUrl } from '../../hooks/useDevices'

export const DEVICE_TYPE = 'DEVICE'
export const PLACED_DEVICE_TYPE = 'PLACED_DEVICE'

export interface DeviceDragItem {
  type: typeof DEVICE_TYPE
  deviceId: string
  rackUnits: number
}

export interface PlacedDeviceDragItem {
  type: typeof PLACED_DEVICE_TYPE
  itemId: string
  deviceId: string
  rackUnits: number
}

interface DraggableDeviceProps {
  device: Device
}

export default function DraggableDevice({ device }: DraggableDeviceProps) {
  const [{ isDragging }, dragRef] = useDrag<DeviceDragItem, unknown, { isDragging: boolean }>({
    type: DEVICE_TYPE,
    item: { type: DEVICE_TYPE, deviceId: device.id, rackUnits: device.rack_units },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  })

  const thumbUrl = getDeviceImageUrl(device.front_image_path)

  return (
    <div
      ref={dragRef as unknown as LegacyRef<HTMLDivElement>}
      className={`border rounded-md p-3 bg-white cursor-grab active:cursor-grabbing transition-opacity shadow-sm ${
        isDragging ? 'opacity-40' : 'opacity-100'
      }`}
    >
      {thumbUrl && (
        <img src={thumbUrl} alt={device.model} className="w-full h-14 object-contain bg-gray-50 rounded mb-2" />
      )}
      <div className="text-sm font-medium truncate">{device.brand} {device.model}</div>
      <div className="text-xs text-gray-500">{device.rack_units}U · {device.power_w}W</div>
    </div>
  )
}
