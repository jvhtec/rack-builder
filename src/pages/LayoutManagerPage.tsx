import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLayouts } from '../hooks/useLayouts'
import { useRacks } from '../hooks/useRacks'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import LayoutList from '../components/layouts/LayoutList'
import LayoutForm from '../components/layouts/LayoutForm'
import type { DrawingState, Layout } from '../types'

export default function LayoutManagerPage() {
  const { layouts, loading: layoutsLoading, createLayout, deleteLayout } = useLayouts()
  const { racks, loading: racksLoading } = useRacks()
  const navigate = useNavigate()
  const [formOpen, setFormOpen] = useState(false)
  const [deletingLayout, setDeletingLayout] = useState<Layout | undefined>()

  const handleSubmit = async (data: { name: string; rack_id: string; drawing_state: DrawingState }) => {
    const layout = await createLayout(data)
    setFormOpen(false)
    if (layout) {
      navigate(`/editor/${layout.id}`)
    }
  }

  if (layoutsLoading || racksLoading) {
    return <div className="text-gray-500">Loading...</div>
  }

  return (
    <div>
      <PageHeader
        title="Layout Manager"
        action={
          <Button onClick={() => setFormOpen(true)} disabled={racks.length === 0} className="w-full sm:w-auto">
            New Layout
          </Button>
        }
      />
      {racks.length === 0 && (
        <p className="text-amber-600 text-sm mb-4">
          Create a rack definition first before creating layouts.
        </p>
      )}
      <LayoutList layouts={layouts} racks={racks} onDelete={setDeletingLayout} />

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title="New Layout">
        <LayoutForm racks={racks} onSubmit={handleSubmit} onCancel={() => setFormOpen(false)} />
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingLayout}
        onClose={() => setDeletingLayout(undefined)}
        onConfirm={() => deletingLayout && deleteLayout(deletingLayout.id)}
        title="Delete Layout"
        message={`Are you sure you want to delete "${deletingLayout?.name}"? All placed devices will be removed.`}
      />
    </div>
  )
}
