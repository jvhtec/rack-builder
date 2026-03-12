import { useState } from 'react'
import { useDevices } from '../hooks/useDevices'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import DeviceList from '../components/devices/DeviceList'
import DeviceForm from '../components/devices/DeviceForm'
import type { Device } from '../types'

export default function DeviceManagerPage() {
  const { devices, loading, createDevice, updateDevice, deleteDevice } = useDevices()
  const [formOpen, setFormOpen] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | undefined>()
  const [deletingDevice, setDeletingDevice] = useState<Device | undefined>()

  const handleSubmit = async (data: {
    brand: string
    model: string
    rack_units: number
    depth_mm: number
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
        action={<Button onClick={() => setFormOpen(true)}>Add Device</Button>}
      />
      <DeviceList devices={devices} onEdit={handleEdit} onDelete={setDeletingDevice} />

      <Modal
        isOpen={formOpen}
        onClose={handleCloseForm}
        title={editingDevice ? 'Edit Device' : 'New Device'}
      >
        <DeviceForm
          initialData={editingDevice}
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
