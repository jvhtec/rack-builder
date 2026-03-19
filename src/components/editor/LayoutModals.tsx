import Modal from '../ui/Modal'
import ConfirmDialog from '../ui/ConfirmDialog'
import Input from '../ui/Input'
import Select from '../ui/Select'
import Button from '../ui/Button'
import type { Rack, Layout } from '../../types'

interface LayoutModalsProps {
  createLayoutOpen: boolean
  setCreateLayoutOpen: (open: boolean) => void
  renameLayoutOpen: boolean
  setRenameLayoutOpen: (open: boolean) => void
  deleteLayoutOpen: boolean
  setDeleteLayoutOpen: (open: boolean) => void
  layoutNameDraft: string
  setLayoutNameDraft: (name: string) => void
  layoutRackDraft: string
  setLayoutRackDraft: (rackId: string) => void
  layoutSaving: boolean
  racks: Rack[]
  activeLayout: Layout
  handleCreateLayout: () => Promise<void>
  handleRenameLayout: () => Promise<void>
  handleDeleteLayout: () => Promise<void>
}

export default function LayoutModals({
  createLayoutOpen, setCreateLayoutOpen,
  renameLayoutOpen, setRenameLayoutOpen,
  deleteLayoutOpen, setDeleteLayoutOpen,
  layoutNameDraft, setLayoutNameDraft,
  layoutRackDraft, setLayoutRackDraft,
  layoutSaving, racks, activeLayout,
  handleCreateLayout, handleRenameLayout, handleDeleteLayout,
}: LayoutModalsProps) {
  return (
    <>
      <Modal isOpen={createLayoutOpen} onClose={() => setCreateLayoutOpen(false)} title="New Layout">
        <div className="space-y-4">
          <Input
            label="Layout Name"
            value={layoutNameDraft}
            onChange={(e) => setLayoutNameDraft(e.target.value)}
            required
          />
          <Select
            label="Rack"
            value={layoutRackDraft}
            onChange={(e) => setLayoutRackDraft(e.target.value)}
            options={racks.map((entry) => ({ value: entry.id, label: `${entry.name} (${entry.rack_units}U)` }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setCreateLayoutOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreateLayout()}
              disabled={layoutSaving || !layoutNameDraft || !layoutRackDraft}
            >
              {layoutSaving ? 'Creating...' : 'Create Layout'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={renameLayoutOpen} onClose={() => setRenameLayoutOpen(false)} title="Rename Layout">
        <div className="space-y-4">
          <Input
            label="Layout Name"
            value={layoutNameDraft}
            onChange={(e) => setLayoutNameDraft(e.target.value)}
            required
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setRenameLayoutOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleRenameLayout()} disabled={layoutSaving || !layoutNameDraft}>
              {layoutSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteLayoutOpen}
        onClose={() => setDeleteLayoutOpen(false)}
        onConfirm={() => void handleDeleteLayout()}
        title="Delete Layout"
        message={`Delete "${activeLayout.name}" from this project?`}
      />
    </>
  )
}
