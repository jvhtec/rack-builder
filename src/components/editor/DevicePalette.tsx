import { ALL_BRAND } from '../../hooks/useDevices'
import type { Device, DeviceCategory } from '../../types'
import Select from '../ui/Select'
import DraggableDevice from './DraggableDevice'

interface DevicePaletteProps {
  devices: Device[]
  categories: DeviceCategory[]
  selectedCategoryId: string
  onCategoryChange: (value: string) => void
  brands: string[]
  selectedBrand: string
  onBrandChange: (value: string) => void
  loading: boolean
}

export default function DevicePalette({
  devices,
  categories,
  selectedCategoryId,
  onCategoryChange,
  brands,
  selectedBrand,
  onBrandChange,
  loading,
}: DevicePaletteProps) {
  return (
    <div className="w-72 bg-white border-r flex flex-col shrink-0">
      <div className="px-4 py-4 border-b font-semibold text-base text-gray-700">
        Device Library
      </div>
      <div className="p-3 border-b space-y-2">
        <Select
          label="Category"
          value={selectedCategoryId}
          onChange={(e) => onCategoryChange(e.target.value)}
          options={[
            { value: 'all', label: 'All categories' },
            ...categories.map((category) => ({ value: category.id, label: category.name })),
          ]}
        />
        <Select
          label="Brand"
          value={selectedBrand}
          onChange={(e) => onBrandChange(e.target.value)}
          options={[
            { value: ALL_BRAND, label: 'All brands' },
            ...brands.map((b) => ({ value: b, label: b })),
          ]}
        />
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {loading && <p className="text-sm text-gray-400 p-2">Loading...</p>}
        {!loading && devices.length === 0 && (
          <p className="text-sm text-gray-400 p-2">No devices match the current filters.</p>
        )}
        {devices.map((device) => (
          <DraggableDevice key={device.id} device={device} />
        ))}
      </div>
    </div>
  )
}
