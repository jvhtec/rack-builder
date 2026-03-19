import type { LayoutItemWithDevice } from '../../types'

interface MobileItemEditorPanelProps {
  items: LayoutItemWithDevice[]
  selectedItemToMove: string
  mobileNameDraft: string
  setMobileNameDraft: (name: string) => void
  mobileNotesDraft: string
  setMobileNotesDraft: (notes: string) => void
  mobileOffsetDraft: string
  setMobileOffsetDraft: (offset: string) => void
  mobileEditorError: string | null
  setMobileEditorError: (error: string | null) => void
  onSave: () => void
  onDelete: () => void
}

export default function MobileItemEditorPanel({
  items, selectedItemToMove,
  mobileNameDraft, setMobileNameDraft,
  mobileNotesDraft, setMobileNotesDraft,
  mobileOffsetDraft, setMobileOffsetDraft,
  mobileEditorError, setMobileEditorError,
  onSave, onDelete,
}: MobileItemEditorPanelProps) {
  const selectedItem = items.find((entry) => entry.id === selectedItemToMove)
  if (!selectedItem) return null

  const selectedLabel = selectedItem.custom_name?.trim() || `${selectedItem.device.brand} ${selectedItem.device.model}`

  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-20 w-[calc(100%-2rem)] max-w-[380px] rounded-xl border border-indigo-400 bg-slate-900/95 px-3 py-2 shadow-2xl" style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}>
      <div className="mb-2 text-[11px] font-semibold text-indigo-100 truncate">Edit · {selectedLabel}</div>
      <div className="space-y-2">
        <input
          type="text"
          value={mobileNameDraft}
          onChange={(e) => { setMobileNameDraft(e.target.value); if (mobileEditorError) setMobileEditorError(null) }}
          placeholder="Custom name"
          className="w-full min-h-9 rounded-md border border-slate-600 bg-slate-800 px-2 text-xs text-slate-100"
        />
        <textarea
          value={mobileNotesDraft}
          onChange={(e) => { setMobileNotesDraft(e.target.value); if (mobileEditorError) setMobileEditorError(null) }}
          placeholder="Notes"
          className="w-full h-16 rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-100"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.1"
            value={mobileOffsetDraft}
            onChange={(e) => { setMobileOffsetDraft(e.target.value); if (mobileEditorError) setMobileEditorError(null) }}
            className="w-full min-h-9 rounded-md border border-slate-600 bg-slate-800 px-2 text-xs text-slate-100"
            placeholder="Offset (mm)"
          />
          <button
            onClick={onSave}
            className="min-h-9 rounded-md border border-indigo-300 bg-indigo-600 px-3 text-xs font-semibold text-white"
          >
            Save
          </button>
          <button
            onClick={onDelete}
            className="min-h-9 rounded-md border border-red-500/70 bg-red-700/70 px-3 text-xs font-semibold text-white"
          >
            Delete
          </button>
        </div>
        {mobileEditorError && <p className="text-[11px] text-amber-300">{mobileEditorError}</p>}
      </div>
    </div>
  )
}
