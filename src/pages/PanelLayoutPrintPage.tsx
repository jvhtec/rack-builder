import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Button from '../components/ui/Button'
import type { DeviceFacing, PanelLayout, Project } from '../types'
import { supabase } from '../lib/supabase'
import { normalizeActiveColumnMap, toHoleCount } from '../lib/panelGrid'
import PanelPrintSheet from '../components/print/PanelPrintSheet'
import '../components/print/layoutPrint.css'

interface PanelLayoutRecord extends Omit<PanelLayout, 'rows' | 'ports'> {
  rows?: Array<{
    id: string
    panel_layout_id: string
    row_index: number
    hole_count: number
    active_column_map: unknown
    created_at: string
    updated_at: string
  }>
  ports?: Array<{
    id: string
    panel_layout_id: string
    connector_id: string
    row_index: number
    hole_index: number
    span_w: number
    span_h: number
    label: string | null
    created_at: string
    updated_at: string
  }>
}

function mapPanelLayout(record: PanelLayoutRecord): PanelLayout {
  return {
    id: record.id,
    project_id: record.project_id,
    name: record.name,
    height_ru: record.height_ru,
    facing: record.facing,
    has_lacing_bar: record.has_lacing_bar,
    notes: record.notes,
    weight_kg: Number(record.weight_kg ?? 0),
    created_at: record.created_at,
    updated_at: record.updated_at,
    rows: (record.rows ?? [])
      .map((row) => {
        const holeCount = toHoleCount(row.hole_count)
        return {
          id: row.id,
          panel_layout_id: row.panel_layout_id,
          row_index: row.row_index,
          hole_count: holeCount,
          active_column_map: normalizeActiveColumnMap(row.active_column_map, holeCount),
          created_at: row.created_at,
          updated_at: row.updated_at,
        }
      })
      .sort((a, b) => a.row_index - b.row_index),
    ports: (record.ports ?? []).map((port) => ({
      id: port.id,
      panel_layout_id: port.panel_layout_id,
      connector_id: port.connector_id,
      row_index: port.row_index,
      hole_index: port.hole_index,
      span_w: port.span_w,
      span_h: port.span_h,
      label: port.label,
      created_at: port.created_at,
      updated_at: port.updated_at,
    })),
  }
}

export default function PanelLayoutPrintPage() {
  const { projectId, panelLayoutId } = useParams<{ projectId: string; panelLayoutId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [panel, setPanel] = useState<PanelLayout | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generatedAt] = useState(() => new Date())

  const facing = useMemo<DeviceFacing>(() => {
    const queryFacing = searchParams.get('facing')
    if (queryFacing === 'front' || queryFacing === 'rear') return queryFacing
    return panel?.facing ?? 'front'
  }, [panel?.facing, searchParams])

  useEffect(() => {
    let active = true
    async function load() {
      if (!projectId || !panelLayoutId) {
        setError('Missing project or panel id')
        setLoading(false)
        return
      }
      setLoading(true)
      const [{ data: projectData, error: projectError }, { data: panelData, error: panelError }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase
          .from('panel_layouts')
          .select('*, rows:panel_layout_rows(*), ports:panel_layout_ports(*)')
          .eq('project_id', projectId)
          .eq('id', panelLayoutId)
          .single(),
      ])

      if (!active) return

      if (projectError || !projectData) {
        setError('Project not found')
        setLoading(false)
        return
      }
      if (panelError || !panelData) {
        setError('Panel layout not found')
        setLoading(false)
        return
      }

      setProject(projectData as Project)
      setPanel(mapPanelLayout(panelData as PanelLayoutRecord))
      setError(null)
      setLoading(false)
    }
    void load()
    return () => {
      active = false
    }
  }, [panelLayoutId, projectId])

  const setFacing = (value: DeviceFacing) => {
    const next = new URLSearchParams(searchParams)
    next.set('facing', value)
    setSearchParams(next)
  }

  if (loading) return <div className="layout-print-loading"><p>Preparing panel print preview...</p></div>

  if (error || !panel || !project) {
    return (
      <div className="layout-print-error">
        <p>{error ?? 'Panel layout not found.'}</p>
        <Button variant="secondary" onClick={() => navigate('/projects')}>
          Back to projects
        </Button>
      </div>
    )
  }

  return (
    <div className="layout-print-page">
      <header className="layout-print-toolbar">
        <div className="layout-print-toolbar-actions">
          <Button variant="secondary" onClick={() => navigate(`/editor/project/${projectId}/panels/${panel.id}`)}>
            Back
          </Button>
          <Button variant={facing === 'front' ? 'primary' : 'secondary'} onClick={() => setFacing('front')}>
            Front
          </Button>
          <Button variant={facing === 'rear' ? 'primary' : 'secondary'} onClick={() => setFacing('rear')}>
            Rear
          </Button>
          <Button onClick={() => window.print()}>Print</Button>
        </div>
        <p className="layout-print-toolbar-meta">
          {project.name} | {panel.name} | {panel.height_ru}U
        </p>
      </header>

      <main className="layout-print-stage">
        <PanelPrintSheet
          panel={panel}
          facing={facing}
          generatedAt={generatedAt}
          projectOwner={project.owner}
          pageNumber={1}
          pageCount={1}
        />
      </main>
    </div>
  )
}
