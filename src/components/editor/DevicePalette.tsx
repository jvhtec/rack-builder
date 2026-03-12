import { useDevices } from '../../hooks/useDevices'
import DraggableDevice from './DraggableDevice'

export default function DevicePalette() {
  const { devices, loading } = useDevices()

  return (
    <div className="w-56 bg-white border-r flex flex-col shrink-0">
      <div className="px-3 py-3 border-b font-semibold text-sm text-gray-700">
        Device Library
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-2">
        {loading && <p className="text-xs text-gray-400 p-2">Loading...</p>}
        {!loading && devices.length === 0 && (
          <p className="text-xs text-gray-400 p-2">No devices. Create some in Device Manager.</p>
        )}
        {devices.map((device) => (
          <DraggableDevice key={device.id} device={device} />
        ))}
      </div>
    </div>
  )
}
