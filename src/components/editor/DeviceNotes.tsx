import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'
import type { LayoutItemWithDevice } from '../../types'

interface DeviceNotesProps {
  item: LayoutItemWithDevice | null
  onSave: (itemId: string, updates: { notes: string; custom_name: string | null }) => Promise<void>
  onClose: () => void
}

export default function DeviceNotes({ item, onSave, onClose }: DeviceNotesProps) {
  const [customName, setCustomName] = useState(item?.custom_name ?? '')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!item) return
    setSaving(true)
    await onSave(item.id, {
      custom_name: customName.trim() || null,
      notes,
    })
    setSaving(false)
    onClose()
  }

  const defaultName = item ? `${item.device.brand} ${item.device.model}` : ''

  return (
    <Modal
      isOpen={!!item}
      onClose={onClose}
      title={`Notes — ${item?.custom_name ?? defaultName}`}
    >
      <div className="space-y-3">
        <Input
          label="Name (layout-specific)"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder={defaultName}
        />
        <textarea
          className="w-full border rounded-md p-2 text-sm h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes for this device placement..."
        />
      </div>
      <div className="flex justify-end gap-3 mt-4">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </Modal>
  )
}
