import { useMemo, useState } from 'react'
import { ensureCategoryByName, filterDevicesByBrand, filterDevicesByCategory, sortDevices, useDevices } from '../hooks/useDevices'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Select from '../components/ui/Select'
import DeviceList from '../components/devices/DeviceList'
import DeviceForm from '../components/devices/DeviceForm'
import type { Device } from '../types'

export default function DeviceManagerPage() {
  const { devices, categories, loading, createDevice, updateDevice, deleteDevice, refetch } = useDevices()
  const [formOpen, setFormOpen] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | undefined>()
  const [deletingDevice, setDeletingDevice] = useState<Device | undefined>()
  const [selectedCategoryId, setSelectedCategoryId] = useState('all')
  const [selectedBrand, setSelectedBrand] = useState('all')
  const [sortField, setSortField] = useState<
    'default' | 'brand' | 'model' | 'rack_units' | 'depth_mm' | 'weight_kg' | 'power_w'
  >('default')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const brands = useMemo(
    () => [...new Set(devices.map((d) => d.brand))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    [devices],
  )

  const filteredDevices = useMemo(
    () => filterDevicesByBrand(filterDevicesByCategory(devices, selectedCategoryId), selectedBrand),
    [devices, selectedCategoryId, selectedBrand],
  )

  const sortedDevices = useMemo(() => {
    if (sortField === 'default') {
      return sortDevices(filteredDevices, [
        { key: 'category', direction: 'asc' },
        { key: 'brand', direction: 'asc' },
        { key: 'model', direction: 'asc' },
      ])
    }

    return sortDevices(filteredDevices, [
      { key: sortField, direction: sortDirection },
      { key: 'brand', direction: 'asc' },
      { key: 'model', direction: 'asc' },
    ])
  }, [filteredDevices, sortDirection, sortField])

  const handleSubmit = async (data: {
    brand: string
    model: string
    rack_units: number
    depth_mm: number
    weight_kg: number
    power_w: number
    category_id: string
    front_image_path?: string | null
    rear_image_path?: string | null
  }) => {
    if (editingDevice) {
      await updateDevice(editingDevice.id, data)
    } else {
      await createDevice(data)
    }
    setFormOpen(false)
    setEditingDevice(undefined)
  }

  const handleEdit = (device: Device) => {
    setEditingDevice(device)
    setFormOpen(true)
  }

  const handleEnsureCategory = async (name: string) => {
    const category = await ensureCategoryByName(name)
    await refetch()
    return category
  }

  const handleCloseForm = () => {
    setFormOpen(false)
    setEditingDevice(undefined)
  }

  if (loading) {
    return <div className="text-gray-500">Loading...</div>
  }

  return (
    <div>
      <PageHeader
        title="Device Manager"
        action={<Button onClick={() => setFormOpen(true)} className="w-full sm:w-auto">Add Device</Button>}
      />

      <div className="mb-4 text-gray-700">
        Showing {sortedDevices.length} of {devices.length} device{devices.length !== 1 ? 's' : ''}
      </div>

      <div className="grid grid-cols-1 gap-3 mb-4 md:grid-cols-4">
        <Select
          label="Category"
          value={selectedCategoryId}
          onChange={(e) => setSelectedCategoryId(e.target.value)}
          options={[
            { value: 'all', label: 'All categories' },
            ...categories.map((category) => ({ value: category.id, label: category.name })),
          ]}
        />
        <Select
          label="Brand"
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          options={[
            { value: 'all', label: 'All brands' },
            ...brands.map((b) => ({ value: b, label: b })),
          ]}
        />
        <Select
          label="Sort By"
          value={sortField}
          onChange={(e) => setSortField(e.target.value as typeof sortField)}
          options={[
            { value: 'default', label: 'Category, Brand, Model' },
            { value: 'brand', label: 'Brand' },
            { value: 'model', label: 'Model' },
            { value: 'rack_units', label: 'Rack Units' },
            { value: 'depth_mm', label: 'Depth (mm)' },
            { value: 'weight_kg', label: 'Weight (kg)' },
            { value: 'power_w', label: 'Power (W)' },
          ]}
        />
        <Select
          label="Direction"
          value={sortDirection}
          onChange={(e) => setSortDirection(e.target.value as 'asc' | 'desc')}
          options={[
            { value: 'asc', label: 'Ascending' },
            { value: 'desc', label: 'Descending' },
          ]}
          disabled={sortField === 'default'}
        />
      </div>

      <DeviceList devices={sortedDevices} onEdit={handleEdit} onDelete={setDeletingDevice} />

      <Modal
        isOpen={formOpen}
        onClose={handleCloseForm}
        title={editingDevice ? 'Edit Device' : 'New Device'}
      >
        <DeviceForm
          initialData={editingDevice}
          categories={categories}
          onEnsureCategory={handleEnsureCategory}
          onSubmit={handleSubmit}
          onCancel={handleCloseForm}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingDevice}
        onClose={() => setDeletingDevice(undefined)}
        onConfirm={() => deletingDevice && deleteDevice(deletingDevice.id)}
        title="Delete Device"
        message={`Are you sure you want to delete "${deletingDevice?.brand} ${deletingDevice?.model}"?`}
      />
    </div>
  )
}
