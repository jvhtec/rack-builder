import { type FormEvent, useState } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import type { Rack } from '../../types'

interface LayoutFormProps {
  racks: Rack[]
  onSubmit: (data: { name: string; rack_id: string }) => Promise<void>
  onCancel: () => void
}

export default function LayoutForm({ racks, onSubmit, onCancel }: LayoutFormProps) {
  const [name, setName] = useState('')
  const [rackId, setRackId] = useState(racks[0]?.id ?? '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSubmit({ name, rack_id: rackId })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Layout Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <Select
        label="Rack"
        value={rackId}
        onChange={(e) => setRackId(e.target.value)}
        options={racks.map((r) => ({ value: r.id, label: `${r.name} (${r.rack_units}U)` }))}
      />
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !name || !rackId}>
          {saving ? 'Creating...' : 'Create Layout'}
        </Button>
      </div>
    </form>
  )
}
