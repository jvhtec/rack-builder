import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Button from '../components/ui/Button'
import LayoutPrintSheet from '../components/print/LayoutPrintSheet'
import ProjectPrintCover from '../components/print/ProjectPrintCover'
import ProjectPrintIndex from '../components/print/ProjectPrintIndex'
import PanelPrintSheet from '../components/print/PanelPrintSheet'
import type { Layout, LayoutItemWithDevice, PanelLayout, Project, Rack } from '../types'
import { supabase } from '../lib/supabase'
import { getDeviceImageUrl } from '../hooks/useDevices'
import { LAYOUT_ITEM_SELECT, mapLayoutItemRows, type LayoutItemRow } from '../lib/layoutItemMapper'
import { normalizeActiveColumnMap, toHoleCount } from '../lib/panelGrid'
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

interface PrintLayoutModel {
  layout: Layout
  rack: Rack
  items: LayoutItemWithDevice[]
  totalWeightKg: number
  totalPowerW: number
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
    rows: (record.rows ?? []).map((row) => {
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
    }).sort((a, b) => a.row_index - b.row_index),
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

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => resolve()
    image.src = url
  })
}

export default function ProjectPrintPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [layoutModels, setLayoutModels] = useState<PrintLayoutModel[]>([])
  const [panelModels, setPanelModels] = useState<PanelLayout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imagesReady, setImagesReady] = useState(false)
  const [autoPrintDone, setAutoPrintDone] = useState(false)
  const [generatedAt] = useState(() => new Date())

  const autoPrintRequested = searchParams.get('autoprint') === '1'

  const loadData = useCallback(async () => {
    if (!projectId) {
      setError('Missing project id')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    setImagesReady(false)
    setLayoutModels([])
    setPanelModels([])

    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (projectError || !projectData) {
      setError('Project not found')
      setLoading(false)
      return
    }
    setProject(projectData as Project)

    const { data: layoutData, error: layoutError } = await supabase
      .from('layouts')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    if (layoutError) {
      setError(layoutError.message)
      setLoading(false)
      return
    }

    const typedLayouts = (layoutData as Layout[]) ?? []

    const models: PrintLayoutModel[] = []
    if (typedLayouts.length > 0) {
      const rackIds = Array.from(new Set(typedLayouts.map((layout) => layout.rack_id)))
      const { data: rackData, error: rackError } = await supabase
        .from('racks')
        .select('*')
        .in('id', rackIds)

      if (rackError) {
        setError(rackError.message)
        setLoading(false)
        return
      }

      const rackMap = new Map(((rackData as Rack[]) ?? []).map((rack) => [rack.id, rack]))

      const layoutIds = typedLayouts.map((layout) => layout.id)
      const { data: itemData, error: itemError } = await supabase
        .from('layout_items')
        .select(LAYOUT_ITEM_SELECT)
        .in('layout_id', layoutIds)

      if (itemError) {
        setError(itemError.message)
        setLoading(false)
        return
      }

      const rows = (itemData ?? []) as LayoutItemRow[]
      const mappedItems: LayoutItemWithDevice[] = mapLayoutItemRows(rows)

      const itemsByLayout = mappedItems.reduce<Map<string, LayoutItemWithDevice[]>>((acc, item) => {
        const existing = acc.get(item.layout_id) ?? []
        existing.push(item)
        acc.set(item.layout_id, existing)
        return acc
      }, new Map())

      for (const layout of typedLayouts) {
        const rack = rackMap.get(layout.rack_id)
        if (!rack) continue
        const items = itemsByLayout.get(layout.id) ?? []
        const totals = items.reduce(
          (acc, item) => ({
            totalWeightKg: acc.totalWeightKg + item.device.weight_kg,
            totalPowerW: acc.totalPowerW + item.device.power_w,
          }),
          { totalWeightKg: 0, totalPowerW: 0 },
        )
        models.push({
          layout,
          rack,
          items,
          totalWeightKg: totals.totalWeightKg,
          totalPowerW: totals.totalPowerW,
        })
      }
    }

    const { data: panelData, error: panelError } = await supabase
      .from('panel_layouts')
      .select('*, rows:panel_layout_rows(*), ports:panel_layout_ports(*)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    if (panelError) {
      setError(panelError.message)
      setLoading(false)
      return
    }

    setLayoutModels(models)
    setPanelModels(((panelData ?? []) as PanelLayoutRecord[]).map(mapPanelLayout))
    setLoading(false)
  }, [projectId])

  const imageUrls = useMemo(() => {
    const urls = new Set<string>()
    for (const model of layoutModels) {
      for (const item of model.items) {
        const frontUrl = getDeviceImageUrl(item.device.front_image_path)
        const rearUrl = getDeviceImageUrl(item.device.rear_image_path)
        if (frontUrl) urls.add(frontUrl)
        if (rearUrl) urls.add(rearUrl)
      }
    }
    return Array.from(urls)
  }, [layoutModels])

  const pageCount = 2 + layoutModels.length + panelModels.length

  const layoutIndexRows = layoutModels.map((model, index) => ({
    layoutName: model.layout.name,
    rackName: model.rack.name,
    rackSpec: `${model.rack.rack_units}U | ${model.rack.width} | ${model.rack.depth_mm}mm`,
    totalPowerW: model.totalPowerW,
    totalWeightKg: model.totalWeightKg,
    pageNumber: index + 3,
  }))

  const panelIndexRows = panelModels.map((panel, index) => ({
    layoutName: `Panel: ${panel.name}`,
    rackName: 'Connector Panel',
    rackSpec: `${panel.height_ru}U | ${panel.facing}`,
    totalPowerW: 0,
    totalWeightKg: panel.weight_kg,
    pageNumber: layoutModels.length + index + 3,
  }))

  const indexRows = [...layoutIndexRows, ...panelIndexRows]

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loadData])

  useEffect(() => {
    let cancelled = false
    const resetTimeoutId = window.setTimeout(() => {
      setImagesReady(false)
    }, 0)

    if (imageUrls.length === 0) {
      const readyTimeoutId = window.setTimeout(() => {
        setImagesReady(true)
      }, 0)
      return () => {
        cancelled = true
        window.clearTimeout(resetTimeoutId)
        window.clearTimeout(readyTimeoutId)
      }
    }

    void Promise.allSettled(imageUrls.map((url) => preloadImage(url))).then(() => {
      if (!cancelled) setImagesReady(true)
    })

    return () => {
      cancelled = true
      window.clearTimeout(resetTimeoutId)
    }
  }, [imageUrls])

  useEffect(() => {
    if (!autoPrintRequested || autoPrintDone || loading || error || !imagesReady || (layoutModels.length + panelModels.length === 0)) return
    const timer = window.setTimeout(() => {
      setAutoPrintDone(true)
      window.print()
    }, 250)
    return () => window.clearTimeout(timer)
  }, [autoPrintDone, autoPrintRequested, error, imagesReady, layoutModels.length, panelModels.length, loading])

  if (error) {
    return (
      <div className="layout-print-error">
        <p>{error}</p>
        <Button variant="secondary" onClick={() => navigate('/projects')}>
          Back to projects
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="layout-print-loading">
        <p>Preparing project print preview...</p>
      </div>
    )
  }

  if (!project || (layoutModels.length === 0 && panelModels.length === 0)) {
    return (
      <div className="layout-print-error">
        <p>This project does not have any layouts or panel sheets to print.</p>
        <Button variant="secondary" onClick={() => navigate(`/editor/project/${projectId}`)}>
          Back to editor
        </Button>
      </div>
    )
  }

  return (
    <div className="layout-print-page">
      <header className="layout-print-toolbar">
        <div className="layout-print-toolbar-actions">
          <Button variant="secondary" onClick={() => {
            if (layoutModels.length > 0) {
              navigate(`/editor/project/${projectId}?layout=${layoutModels[0].layout.id}`)
            } else if (panelModels.length > 0) {
              navigate(`/editor/project/${projectId}?panel=${panelModels[0].id}`)
            } else {
              navigate(`/editor/project/${projectId}`)
            }
          }}>
            Back
          </Button>
          <Button onClick={() => window.print()}>Print</Button>
        </div>
        <p className="layout-print-toolbar-meta">
          {project.name} | {layoutModels.length} layouts + {panelModels.length} panels | {imagesReady ? 'Ready' : 'Loading images'}
        </p>
      </header>

      <main className="layout-print-stage layout-print-stage--project">
        <ProjectPrintCover project={project} generatedAt={generatedAt} />
        <ProjectPrintIndex
          projectName={project.name}
          rows={indexRows}
          generatedAt={generatedAt}
          pageNumber={2}
          pageCount={pageCount}
        />

        {layoutModels.map((model, index) => (
          <LayoutPrintSheet
            key={model.layout.id}
            layout={model.layout}
            rack={model.rack}
            items={model.items}
            generatedAt={generatedAt}
            projectOwner={project.owner}
            totalWeightKg={model.totalWeightKg}
            totalPowerW={model.totalPowerW}
            scaleLabel="Fit (auto)"
            useAutoFitScale
            pageNumber={index + 3}
            pageCount={pageCount}
            sheetClassName={index === layoutModels.length - 1 && panelModels.length === 0 ? '' : 'layout-print-page-break'}
          />
        ))}

        {panelModels.map((panel, index) => {
          const pageNumber = layoutModels.length + index + 3
          const isLast = index === panelModels.length - 1
          return (
            <PanelPrintSheet
              key={panel.id}
              panel={panel}
              facing={panel.facing}
              generatedAt={generatedAt}
              projectOwner={project.owner}
              pageNumber={pageNumber}
              pageCount={pageCount}
              sheetClassName={isLast ? '' : 'layout-print-page-break'}
            />
          )
        })}
      </main>
    </div>
  )
}
