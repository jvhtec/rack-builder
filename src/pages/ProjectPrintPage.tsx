import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Button from '../components/ui/Button'
import LayoutPrintSheet from '../components/print/LayoutPrintSheet'
import ProjectPrintCover from '../components/print/ProjectPrintCover'
import ProjectPrintIndex from '../components/print/ProjectPrintIndex'
import type { Layout, LayoutItemWithDevice, Project, Rack } from '../types'
import { supabase } from '../lib/supabase'
import { getDeviceImageUrl } from '../hooks/useDevices'
import '../components/print/layoutPrint.css'

interface LayoutItemRow {
  id: string
  layout_id: string
  device_id: string
  start_u: number
  facing: string
  preferred_lane?: number | null
  preferred_sub_lane?: number | null
  force_full_width?: boolean | null
  custom_name?: string | null
  notes: string | null
  device: Record<string, unknown>
}

interface PrintLayoutModel {
  layout: Layout
  rack: Rack
  items: LayoutItemWithDevice[]
  totalWeightKg: number
  totalPowerW: number
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
    if (typedLayouts.length === 0) {
      setLayoutModels([])
      setLoading(false)
      return
    }

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
      .select('*, device:devices(*)')
      .in('layout_id', layoutIds)

    if (itemError) {
      setError(itemError.message)
      setLoading(false)
      return
    }

    const rows = (itemData ?? []) as LayoutItemRow[]
    const mappedItems: LayoutItemWithDevice[] = rows.map((row) => {
      const rawDevice = row.device as Record<string, unknown>
      return {
        id: row.id,
        layout_id: row.layout_id,
        device_id: row.device_id,
        start_u: row.start_u,
        facing: row.facing as LayoutItemWithDevice['facing'],
        preferred_lane: row.preferred_lane === 0 || row.preferred_lane === 1 ? row.preferred_lane : null,
        preferred_sub_lane: row.preferred_sub_lane === 0 || row.preferred_sub_lane === 1 ? row.preferred_sub_lane : null,
        force_full_width: row.force_full_width === true,
        custom_name: row.custom_name ?? null,
        notes: row.notes,
        device: {
          ...rawDevice,
          is_half_rack: rawDevice.is_half_rack === true,
        } as unknown as LayoutItemWithDevice['device'],
      }
    })

    const itemsByLayout = mappedItems.reduce<Map<string, LayoutItemWithDevice[]>>((acc, item) => {
      const existing = acc.get(item.layout_id) ?? []
      existing.push(item)
      acc.set(item.layout_id, existing)
      return acc
    }, new Map())

    const models: PrintLayoutModel[] = []
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

    setLayoutModels(models)
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

  const pageCount = 2 + layoutModels.length

  const indexRows = layoutModels.map((model, index) => ({
    layoutName: model.layout.name,
    rackName: model.rack.name,
    rackSpec: `${model.rack.rack_units}U | ${model.rack.width} | ${model.rack.depth_mm}mm`,
    totalPowerW: model.totalPowerW,
    totalWeightKg: model.totalWeightKg,
    pageNumber: index + 3,
  }))

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
    if (!autoPrintRequested || autoPrintDone || loading || error || !imagesReady || layoutModels.length === 0) return
    const timer = window.setTimeout(() => {
      setAutoPrintDone(true)
      window.print()
    }, 250)
    return () => window.clearTimeout(timer)
  }, [autoPrintDone, autoPrintRequested, error, imagesReady, layoutModels.length, loading])

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

  if (!project || layoutModels.length === 0) {
    return (
      <div className="layout-print-error">
        <p>This project does not have any layouts to print.</p>
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
          <Button variant="secondary" onClick={() => navigate(`/editor/project/${projectId}?layout=${layoutModels[0].layout.id}`)}>
            Back
          </Button>
          <Button onClick={() => window.print()}>Print</Button>
        </div>
        <p className="layout-print-toolbar-meta">
          {project.name} | {layoutModels.length} layouts | {imagesReady ? 'Ready' : 'Loading images'}
        </p>
      </header>

      <main className="layout-print-stage layout-print-stage--project">
        <ProjectPrintCover project={project} generatedAt={generatedAt} pageNumber={1} pageCount={pageCount} />
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
            pageNumber={index + 3}
            pageCount={pageCount}
            sheetClassName={index === layoutModels.length - 1 ? '' : 'layout-print-page-break'}
          />
        ))}
      </main>
    </div>
  )
}
