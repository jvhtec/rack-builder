import type { Device } from '../../types'
import { getDeviceImageUrl } from '../../hooks/useDevices'
import Button from '../ui/Button'

interface DeviceListProps {
  devices: Device[]
  onEdit: (device: Device) => void
  onDelete: (device: Device) => void
}

export default function DeviceList({ devices, onEdit, onDelete }: DeviceListProps) {
  if (devices.length === 0) {
    return <p className="text-gray-500 text-sm">No devices defined yet. Create one to get started.</p>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {devices.map((device) => {
        const thumbUrl = getDeviceImageUrl(device.front_image_path)
        return (
          <div key={device.id} className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 hover:shadow-sm transition-shadow">
            {thumbUrl && (
              <img
                src={thumbUrl}
                alt={`${device.brand} ${device.model}`}
                className="w-full h-24 object-contain bg-gray-100 dark:bg-gray-900/50 rounded mb-3"
              />
            )}
            {!thumbUrl && (
              <div className="w-full h-24 bg-gray-100 dark:bg-gray-900/50 rounded mb-3 flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs">
                No image
              </div>
            )}
            <div className="mb-1 font-medium text-gray-900 dark:text-white">{device.brand} {device.model}</div>
            <div className="text-xs text-blue-700 dark:text-blue-400 mb-1">{device.category?.name ?? 'Uncategorized'}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {device.rack_units}U &middot; {device.depth_mm}mm &middot; {device.weight_kg}kg &middot; {device.power_w}W
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => onEdit(device)}>
                Edit
              </Button>
              <Button variant="danger" onClick={() => onDelete(device)}>
                Delete
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
