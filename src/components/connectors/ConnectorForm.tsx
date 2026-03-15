import { type FormEvent, useRef, useState } from 'react'
import type { ConnectorDefinition } from '../../types'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import Modal from '../ui/Modal'
import ImageCropper from '../devices/ImageCropper'
import { useImageUpload } from '../../hooks/useImageUpload'

interface ConnectorFormProps {
  initialData?: ConnectorDefinition
  onSubmit: (data: {
    id: string
    name: string
    category: ConnectorDefinition['category']
    image_path: string
    grid_width: number
    grid_height: number
    mounting: ConnectorDefinition['mounting']
    notes: string
    weight_kg: number
  }) => Promise<void>
  onCancel: () => void
}

export default function ConnectorForm({ initialData, onSubmit, onCancel }: ConnectorFormProps) {
  const [id, setId] = useState(initialData?.id ?? '')
  const [name, setName] = useState(initialData?.name ?? '')
  const [category, setCategory] = useState<ConnectorDefinition['category']>(initialData?.category ?? 'other')
  const [imagePath, setImagePath] = useState(initialData?.image_path ?? '')
  const [gridWidth, setGridWidth] = useState(initialData?.grid_width ?? 1)
  const [gridHeight, setGridHeight] = useState(initialData?.grid_height ?? 1)
  const [mounting, setMounting] = useState<ConnectorDefinition['mounting']>(initialData?.mounting ?? 'both')
  const [notes, setNotes] = useState(initialData?.notes ?? '')
  const [weightKg, setWeightKg] = useState(initialData?.weight_kg ?? 0)
  const [saving, setSaving] = useState(false)

  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { uploadImage, uploading } = useImageUpload()

  const handleCropComplete = async (blob: Blob) => {
    const path = await uploadImage(blob, 'catalog', { bucket: 'connector-images' })
    setImagePath(path)
    setCropSrc(null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await onSubmit({
        id: id.trim(),
        name: name.trim(),
        category,
        image_path: imagePath,
        grid_width: Math.max(1, Math.round(gridWidth)),
        grid_height: Math.max(1, Math.round(gridHeight)),
        mounting,
        notes: notes.trim(),
        weight_kg: Number.isFinite(weightKg) ? Math.max(0, weightKg) : 0,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Connector ID"
          value={id}
          onChange={(event) => setId(event.target.value)}
          placeholder="e.g. xlr_d_series"
          disabled={!!initialData}
          required
        />
        <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} required />

        <Select
          label="Category"
          value={category}
          onChange={(event) => setCategory(event.target.value as ConnectorDefinition['category'])}
          options={[
            { value: 'audio', label: 'Audio' },
            { value: 'data', label: 'Data' },
            { value: 'power', label: 'Power' },
            { value: 'multipin', label: 'Multipin' },
            { value: 'other', label: 'Other' },
          ]}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Grid width"
            type="number"
            min={1}
            value={gridWidth}
            onChange={(event) => setGridWidth(Number(event.target.value))}
            required
          />
          <Input
            label="Grid height"
            type="number"
            min={1}
            value={gridHeight}
            onChange={(event) => setGridHeight(Number(event.target.value))}
            required
          />
        </div>

        <Select
          label="Mounting"
          value={mounting}
          onChange={(event) => setMounting(event.target.value as ConnectorDefinition['mounting'])}
          options={[
            { value: 'both', label: 'Both' },
            { value: 'front', label: 'Front only' },
            { value: 'rear', label: 'Rear only' },
          ]}
        />

        <Input
          label="Weight (kg)"
          type="number"
          min={0}
          step={0.01}
          value={weightKg}
          onChange={(event) => setWeightKg(Number(event.target.value))}
          required
        />

        <Input label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes" />

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Connector image</label>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) setCropSrc(URL.createObjectURL(file))
                event.target.value = ''
              }}
            />
            <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
              {imagePath ? 'Replace image' : 'Choose image'}
            </Button>
            {imagePath && <span className="text-xs text-green-600">Uploaded</span>}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" type="button" onClick={onCancel} className="w-full sm:w-auto">Cancel</Button>
          <Button type="submit" disabled={saving || uploading || !id.trim() || !name.trim() || !imagePath} className="w-full sm:w-auto">
            {saving ? 'Saving...' : initialData ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>

      <Modal isOpen={!!cropSrc} onClose={() => setCropSrc(null)} title="Crop connector image">
        {cropSrc && (
          <ImageCropper
            imageSrc={cropSrc}
            aspect={1}
            outputWidth={400}
            outputHeight={400}
            onCropComplete={handleCropComplete}
            onCancel={() => setCropSrc(null)}
          />
        )}
      </Modal>
    </>
  )
}
