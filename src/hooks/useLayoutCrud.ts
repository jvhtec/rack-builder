import { useCallback, useState } from 'react'
import type { Layout, Rack } from '../types'

export function useLayoutCrud(params: {
  projectId: string | undefined
  activeLayout: Layout | null
  layouts: Layout[]
  racks: Rack[]
  rack: Rack | null
  createLayout: (layout: { project_id?: string; rack_id: string; name: string }) => Promise<Layout>
  updateLayout: (id: string, updates: Partial<{ name: string; rack_id: string; project_id: string }>) => Promise<void>
  deleteLayout: (id: string) => Promise<void>
  setActiveLayout: (id: string) => void
}) {
  const {
    projectId,
    activeLayout,
    layouts,
    racks,
    rack,
    createLayout,
    updateLayout,
    deleteLayout,
    setActiveLayout,
  } = params

  const [createLayoutOpen, setCreateLayoutOpen] = useState(false)
  const [renameLayoutOpen, setRenameLayoutOpen] = useState(false)
  const [deleteLayoutOpen, setDeleteLayoutOpen] = useState(false)
  const [layoutNameDraft, setLayoutNameDraft] = useState('')
  const [layoutRackDraft, setLayoutRackDraft] = useState('')
  const [layoutSaving, setLayoutSaving] = useState(false)

  const openCreateLayoutModal = useCallback(() => {
    setLayoutNameDraft('')
    setLayoutRackDraft(rack?.id ?? racks[0]?.id ?? '')
    setCreateLayoutOpen(true)
  }, [rack?.id, racks])

  const openRenameLayoutModal = useCallback(() => {
    if (!activeLayout) return
    setLayoutNameDraft(activeLayout.name)
    setRenameLayoutOpen(true)
  }, [activeLayout])

  const [layoutError, setLayoutError] = useState<string | null>(null)

  const handleCreateLayout = useCallback(async () => {
    if (!projectId || !layoutNameDraft || !layoutRackDraft) return

    setLayoutSaving(true)
    setLayoutError(null)
    try {
      const created = await createLayout({
        project_id: projectId,
        name: layoutNameDraft,
        rack_id: layoutRackDraft,
      })
      if (created) {
        setCreateLayoutOpen(false)
        setActiveLayout(created.id)
      }
    } catch (err) {
      console.error('Create layout failed:', err)
      setLayoutError(err instanceof Error ? err.message : 'Failed to create layout.')
    } finally {
      setLayoutSaving(false)
    }
  }, [projectId, layoutNameDraft, layoutRackDraft, createLayout, setActiveLayout])

  const handleRenameLayout = useCallback(async () => {
    if (!activeLayout || !layoutNameDraft) return

    setLayoutSaving(true)
    setLayoutError(null)
    try {
      await updateLayout(activeLayout.id, { name: layoutNameDraft })
      setRenameLayoutOpen(false)
    } catch (err) {
      console.error('Rename layout failed:', err)
      setLayoutError(err instanceof Error ? err.message : 'Failed to rename layout.')
    } finally {
      setLayoutSaving(false)
    }
  }, [activeLayout, layoutNameDraft, updateLayout])

  const handleDeleteLayout = useCallback(async () => {
    if (!activeLayout || layouts.length <= 1) return

    const fallbackLayout = layouts.find((entry) => entry.id !== activeLayout.id)

    setLayoutSaving(true)
    setLayoutError(null)
    try {
      await deleteLayout(activeLayout.id)
      setDeleteLayoutOpen(false)
      if (fallbackLayout) setActiveLayout(fallbackLayout.id)
    } catch (err) {
      console.error('Delete layout failed:', err)
      setLayoutError(err instanceof Error ? err.message : 'Failed to delete layout.')
    } finally {
      setLayoutSaving(false)
    }
  }, [activeLayout, layouts, deleteLayout, setActiveLayout])

  return {
    createLayoutOpen,
    setCreateLayoutOpen,
    renameLayoutOpen,
    setRenameLayoutOpen,
    deleteLayoutOpen,
    setDeleteLayoutOpen,
    layoutNameDraft,
    setLayoutNameDraft,
    layoutRackDraft,
    setLayoutRackDraft,
    layoutSaving,
    layoutError,
    setLayoutError,
    openCreateLayoutModal,
    openRenameLayoutModal,
    handleCreateLayout,
    handleRenameLayout,
    handleDeleteLayout,
  }
}
