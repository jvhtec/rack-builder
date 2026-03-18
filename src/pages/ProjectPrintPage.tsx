import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '../components/ui/Button'
import LayoutPrintSheet from '../components/print/LayoutPrintSheet'
import RackBomSheet, { getBomPageCount } from '../components/print/RackBomSheet'
import ProjectPrintCover from '../components/print/ProjectPrintCover'
import ProjectPrintIndex from '../components/print/ProjectPrintIndex'
import PanelPrintSheet from '../components/print/PanelPrintSheet'
import type { Layout, LayoutItemWithDevice, PanelLayout, Project, Rack } from '../types'
import { supabase } from '../lib/supabase'
import { getDeviceImageUrl } from '../hooks/useDevices'
import { useConnectors } from '../hooks/useConnectors'
import { LAYOUT_ITEM_SELECT, mapLayoutItemRows, type LayoutItemRow } from '../lib/layoutItemMapper'
import { mapPanelLayout, type PanelLayoutRecord } from '../lib/panelLayoutMapper'
import { useTheme } from '../hooks/useTheme'
import ThemeToggle from '../components/ui/ThemeToggle'
import { exportPrintSheetsToPdf } from '../lib/printPdfExport'
import '../components/print/layoutPrint.css'

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
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve()
    image.onerror = () => resolve()
    image.src = url
  })
}

export default function ProjectPrintPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { isDark, toggle } = useTheme()

  const [project, setProject] = useState<Project | null>(null)
  const [layoutModels, setLayoutModels] = useState<PrintLayoutModel[]>([])
  const [panelModels, setPanelModels] = useState<PanelLayout[]>([])
  const { connectorById } = useConnectors()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imagesReady, setImagesReady] = useState(false)
  const [includeSimplified, setIncludeSimplified] = useState(false)
  const [includeBom, setIncludeBom] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [generatedAt] = useState(() => new Date())
  const exportRootRef = useRef<HTMLDivElement | null>(null)

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
      const mappedItems: LayoutItemWithDevice[] = mapLayoutItemRows(rows, connectorById)

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
  }, [connectorById, projectId])

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

  // Compute per-layout page counts (main + optional simplified + BOM pages)
  const layoutStartPages = useMemo(() => {
    const starts: number[] = []
    let cursor = 3 // pages 1=cover, 2=index, layouts start at 3
    for (const model of layoutModels) {
      starts.push(cursor)
      cursor += 1 // main page
      if (includeSimplified) cursor += 1
      if (includeBom) {
        const uniqueDevices = new Set(model.items.map((i) => i.device.id)).size
        cursor += getBomPageCount(uniqueDevices)
      }
    }
    return starts
  }, [layoutModels, includeSimplified, includeBom])

  const layoutPagesTotal = layoutStartPages.length > 0
    ? (layoutStartPages[layoutStartPages.length - 1] - 3) + 1
      + (includeSimplified ? 1 : 0)
      + (includeBom ? getBomPageCount(new Set(layoutModels[layoutModels.length - 1]?.items.map((i) => i.device.id)).size) : 0)
    : 0
  const panelStartPage = 3 + layoutPagesTotal
  const pageCount = 2 + layoutPagesTotal + panelModels.length

  const layoutIndexRows = layoutModels.map((model, index) => ({
    layoutName: model.layout.name,
    rackName: model.rack.name,
    rackSpec: `${model.rack.rack_units}U | ${model.rack.width} | ${model.rack.depth_mm}mm`,
    totalPowerW: model.totalPowerW,
    totalWeightKg: model.totalWeightKg,
    pageNumber: layoutStartPages[index] ?? 3,
  }))

  const panelIndexRows = panelModels.map((panel, index) => ({
    layoutName: panel.name,
    rackName: `${panel.height_ru}U panel`,
    rackSpec: panel.facing,
    totalPowerW: 0,
    totalWeightKg: panel.weight_kg,
    pageNumber: panelStartPage + index,
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

  const handleExportPdf = useCallback(async () => {
    if (!exportRootRef.current || !project) return

    setExportingPdf(true)
    setExportError(null)
    setExportStatus('Preparing export...')

    try {
      await exportPrintSheetsToPdf({
        rootElement: exportRootRef.current,
        fileName: `${project.name}-project.pdf`,
        format: 'a3',
        orientation: 'landscape',
        qualityMode: 'balanced',
        onProgress: (progress) => setExportStatus(progress.message),
      })
      setExportStatus('PDF download started.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export PDF.'
      setExportError(message)
      setExportStatus(null)
    } finally {
      setExportingPdf(false)
    }
  }, [project])

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
        <p>Preparing project PDF preview...</p>
      </div>
    )
  }

  if (!project || (layoutModels.length === 0 && panelModels.length === 0)) {
    return (
      <div className="layout-print-error">
        <p>This project does not have any layouts or panel sheets to export.</p>
        <Button variant="secondary" onClick={() => navigate(`/editor/project/${projectId}`)}>
          Back to editor
        </Button>
      </div>
    )
  }

  return (
    <div ref={exportRootRef} className="layout-print-page">
      <header className="layout-print-toolbar">
        <div className="layout-print-toolbar-actions">
          <Button variant="secondary" onClick={() => {
            if (layoutModels.length > 0) {
              navigate(`/editor/project/${projectId}?layout=${layoutModels[0].layout.id}`)
            } else if (panelModels.length > 0) {
              navigate(`/editor/project/${projectId}`)
            } else {
              navigate(`/editor/project/${projectId}`)
            }
          }}>
            Back
          </Button>
          <Button
            onClick={() => void handleExportPdf()}
            disabled={exportingPdf || loading || !imagesReady || (layoutModels.length + panelModels.length === 0)}
          >
            {exportingPdf ? 'Exporting...' : exportError ? 'Retry Export PDF' : 'Export PDF'}
          </Button>
          <label className="layout-print-toolbar-label">
            <input
              type="checkbox"
              checked={includeSimplified}
              onChange={(e) => setIncludeSimplified(e.target.checked)}
            />
            Include simplified view
          </label>
          <label className="layout-print-toolbar-label">
            <input
              type="checkbox"
              checked={includeBom}
              onChange={(e) => setIncludeBom(e.target.checked)}
            />
            Include BOM
          </label>
          <div className="ml-2 pl-4 border-l border-gray-300 dark:border-slate-700">
            <ThemeToggle isDark={isDark} toggle={toggle} className="text-gray-500 dark:text-slate-400" />
          </div>
        </div>
        <p className="layout-print-toolbar-meta">
          {project.name} | {layoutModels.length} layouts + {panelModels.length} panels | {imagesReady ? 'Ready' : 'Loading images'}
        </p>
        {exportStatus && <p className="layout-print-toolbar-status">{exportStatus}</p>}
        {exportError && <p className="layout-print-toolbar-error">{exportError}</p>}
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

        {layoutModels.map((model, index) => {
          const layoutPageNumber = layoutStartPages[index] ?? 3
          const isLastLayout = index === layoutModels.length - 1
          const hasMoreAfterMain = includeSimplified || includeBom || !isLastLayout || panelModels.length > 0
          const hasMoreAfterSimplified = includeBom || !isLastLayout || panelModels.length > 0
          const hasMoreAfterBom = !isLastLayout || panelModels.length > 0

          let subPageOffset = 1

          return (
            <Fragment key={model.layout.id}>
              <LayoutPrintSheet
                layout={model.layout}
                rack={model.rack}
                items={model.items}
                generatedAt={generatedAt}
                projectOwner={project.owner}
                totalWeightKg={model.totalWeightKg}
                totalPowerW={model.totalPowerW}
                scaleLabel="Fit (auto)"
                useAutoFitScale
                pageNumber={layoutPageNumber}
                pageCount={pageCount}
                sheetClassName={hasMoreAfterMain ? 'layout-print-page-break' : ''}
              />
              {includeSimplified && (
                <LayoutPrintSheet
                  layout={model.layout}
                  rack={model.rack}
                  items={model.items}
                  generatedAt={generatedAt}
                  projectOwner={project.owner}
                  totalWeightKg={model.totalWeightKg}
                  totalPowerW={model.totalPowerW}
                  scaleLabel="Fit (auto)"
                  useAutoFitScale
                  simplifiedView
                  pageNumber={layoutPageNumber + subPageOffset++}
                  pageCount={pageCount}
                  sheetClassName={hasMoreAfterSimplified ? 'layout-print-page-break' : ''}
                />
              )}
              {includeBom && (
                <RackBomSheet
                  layout={model.layout}
                  rack={model.rack}
                  items={model.items}
                  generatedAt={generatedAt}
                  projectOwner={project.owner}
                  totalWeightKg={model.totalWeightKg}
                  totalPowerW={model.totalPowerW}
                  startPageNumber={layoutPageNumber + subPageOffset}
                  pageCount={pageCount}
                  sheetClassName={hasMoreAfterBom ? 'layout-print-page-break' : ''}
                />
              )}
            </Fragment>
          )
        })}

        {panelModels.map((panel, index) => {
          const pageNumber = panelStartPage + index
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
