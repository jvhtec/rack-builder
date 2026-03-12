import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import type { LayoutItemWithDevice } from '../../types'

interface DeviceNotesProps {
  item: LayoutItemWithDevice | null
  onSave: (itemId: string, notes: string) => Promise<void>
  onClose: () => void
}

export default function DeviceNotes({ item, onSave, onClose }: DeviceNotesProps) {
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!item) return
    setSaving(true)
    await onSave(item.id, notes)
    setSaving(false)
    onClose()
  }

  return (
    <Modal
      isOpen={!!item}
      onClose={onClose}
      title={`Notes — ${item?.device.brand} ${item?.device.model}`}
    >
      <textarea
        className="w-full border rounded-md p-2 text-sm h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add notes for this device placement..."
      />
      <div className="flex justify-end gap-3 mt-4">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Notes'}
        </Button>
      </div>
    </Modal>
  )
}
