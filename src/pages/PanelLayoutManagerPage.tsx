import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { HOLE_COUNT_OPTIONS, type HoleCount } from '../lib/panelGrid'
import { usePanelLayouts } from '../hooks/usePanelLayouts'
import type { DeviceFacing, Project } from '../types'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'

function rowsSummary(heightRu: number, rowHoleCounts: number[]): string {
  const values = Array.from({ length: heightRu }, (_, rowIndex) => rowHoleCounts[rowIndex] ?? 16)
  return values.join(' / ')
}

export default function PanelLayoutManagerPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { panelLayouts, loading, createPanelLayout, duplicatePanelLayout, deletePanelLayout } = usePanelLayouts(projectId)

  const [project, setProject] = useState<Project | null>(null)
  const [projectLoading, setProjectLoading] = useState(true)
  const [projectError, setProjectError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('New Panel')
  const [heightRu, setHeightRu] = useState(1)
  const [facing, setFacing] = useState<DeviceFacing>('front')
  const [defaultHoleCount, setDefaultHoleCount] = useState<HoleCount>(16)
  const [operationError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadProject() {
      if (!projectId) {
        setProjectError('Missing project id')
        setProjectLoading(false)
        return
      }
      setProjectLoading(true)
      const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).single()
      if (!active) return
      if (error || !data) {
        setProject(null)
        setProjectError('Project not found')
        setProjectLoading(false)
        return
      }
      setProject(data as Project)
      setProjectError(null)
      setProjectLoading(false)
    }

    void loadProject()

    return () => {
      active = false
    }
  }, [projectId])

  const deletingLayout = useMemo(
    () => panelLayouts.find((layout) => layout.id === deleteTargetId) ?? null,
    [deleteTargetId, panelLayouts],
  )

  const openCreate = () => {
    setName('New Panel')
    setHeightRu(1)
    setFacing('front')
    setDefaultHoleCount(16)
    setCreateError(null)
    setCreateOpen(true)
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!projectId) return
    setSaving(true)
    try {
      const id = await createPanelLayout({
        name,
        height_ru: heightRu,
        facing,
        has_lacing_bar: false,
        default_hole_count: defaultHoleCount,
      })
      setCreateOpen(false)
      navigate(`/editor/project/${projectId}/panels/${id}`)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create panel layout.')
    } finally {
      setSaving(false)
    }
  }

  const handleDuplicate = async (panelLayoutId: string) => {
    const panel = panelLayouts.find((entry) => entry.id === panelLayoutId)
    if (!panel || !projectId) return
    setSaving(true)
    try {
      const nextId = await duplicatePanelLayout(panel)
      navigate(`/editor/project/${projectId}/panels/${nextId}`)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to duplicate panel layout.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTargetId) return
    setSaving(true)
    try {
      await deletePanelLayout(deleteTargetId)
      setDeleteTargetId(null)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Unable to delete panel layout.')
      setDeleteTargetId(null)
    } finally {
      setSaving(false)
    }
  }

  if (projectLoading || loading) return <div className="text-gray-500">Loading panel layouts...</div>

  if (projectError || !project) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">{projectError ?? 'Project not found.'}</p>
        <Button onClick={() => navigate('/projects')}>Back to projects</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${project.name} - Panel Layouts`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate(`/editor/project/${project.id}`)}>
              Back to Rack Editor
            </Button>
            <Button onClick={openCreate}>Add Panel Layout</Button>
          </div>
        }
      />

      {operationError && <p className="text-sm text-red-600">{operationError}</p>}

      {panelLayouts.length === 0 ? (
        <div className="rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-sm text-gray-600 dark:text-gray-400">
          No panel layouts yet. Create one to start designing connector panels.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {panelLayouts.map((panel) => (
            <article key={panel.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{panel.name}</h2>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {panel.height_ru}U • Facing: {panel.facing} • Lacing bar: {panel.has_lacing_bar ? 'Yes' : 'No'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Row densities: {rowsSummary(panel.height_ru, (panel.rows ?? []).map((row) => row.hole_count))}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => navigate(`/editor/project/${project.id}/panels/${panel.id}`)}>Open Editor</Button>
                <Button variant="secondary" onClick={() => navigate(`/editor/project/${project.id}/panels/${panel.id}/print`)}>
                  Print
                </Button>
                <Button variant="secondary" onClick={() => void handleDuplicate(panel.id)} disabled={saving}>
                  Duplicate
                </Button>
                <Button variant="danger" onClick={() => setDeleteTargetId(panel.id)} disabled={saving}>
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Add Panel Layout">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Panel Name" value={name} onChange={(event) => setName(event.target.value)} required />
          <Input
            label="Panel Height (RU)"
            type="number"
            min={1}
            max={6}
            value={heightRu}
            onChange={(event) => setHeightRu(Math.max(1, Math.min(6, Number(event.target.value) || 1)))}
            required
          />
          <Select
            label="Panel Facing"
            value={facing}
            onChange={(event) => setFacing(event.target.value as DeviceFacing)}
            options={[
              { value: 'front', label: 'Front' },
              { value: 'rear', label: 'Rear' },
            ]}
          />
          <Select
            label="Default Row Density"
            value={String(defaultHoleCount)}
            onChange={(event) => setDefaultHoleCount(Number(event.target.value) as HoleCount)}
            options={HOLE_COUNT_OPTIONS.map((option) => ({ value: String(option), label: `${option} holes / row` }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? 'Creating...' : 'Create Panel Layout'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingLayout}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={() => void handleDelete()}
        title="Delete Panel Layout"
        message={`Delete "${deletingLayout?.name}"? This is blocked if it is used in a rack layout.`}
      />
    </div>
  )
}
