import { type FormEvent, useState } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import type { Rack, RackWidth } from '../../types'

interface RackFormProps {
  initialData?: Rack
  onSubmit: (data: { name: string; rack_units: number; depth_mm: number; width: RackWidth }) => Promise<void>
  onCancel: () => void
}

export default function RackForm({ initialData, onSubmit, onCancel }: RackFormProps) {
  const [name, setName] = useState(initialData?.name ?? '')
  const [rackUnits, setRackUnits] = useState(initialData?.rack_units ?? 42)
  const [depthMm, setDepthMm] = useState(initialData?.depth_mm ?? 800)
  const [width, setWidth] = useState<RackWidth>(initialData?.width ?? 'single')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSubmit({ name, rack_units: rackUnits, depth_mm: depthMm, width })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input
        label="Rack Units"
        type="number"
        min={1}
        value={rackUnits}
        onChange={(e) => setRackUnits(Number(e.target.value))}
        required
      />
      <Input
        label="Depth (mm)"
        type="number"
        min={1}
        value={depthMm}
        onChange={(e) => setDepthMm(Number(e.target.value))}
        required
      />
      <Select
        label="Width"
        value={width}
        onChange={(e) => setWidth(e.target.value as RackWidth)}
        options={[
          { value: 'single', label: 'Single' },
          { value: 'dual', label: 'Dual' },
        ]}
      />
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !name}>
          {saving ? 'Saving...' : initialData ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  )
}
