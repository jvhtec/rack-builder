import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useProjectAuth } from '../hooks/useProjectAuth'
import PasswordPrompt from '../components/ui/PasswordPrompt'
import Button from '../components/ui/Button'
import LayoutPrintSheet from '../components/print/LayoutPrintSheet'
import type { Layout, LayoutItemWithDevice, Project, Rack } from '../types'
import { supabase } from '../lib/supabase'
import { useTheme } from '../hooks/useTheme'
import ThemeToggle from '../components/ui/ThemeToggle'
import { getDeviceImageUrl } from '../hooks/useDevices'
import { useConnectors } from '../hooks/useConnectors'
import { LAYOUT_ITEM_SELECT, mapLayoutItemRows, type LayoutItemRow } from '../lib/layoutItemMapper'
import { exportPrintSheetsToPdf } from '../lib/printPdfExport'
import '../components/print/layoutPrint.css'

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve()
    image.onerror = () => resolve()
    image.src = url
  })
}

export default function LayoutPrintPage() {
  const { projectId, layoutId } = useParams<{ projectId: string; layoutId: string }>()
  const navigate = useNavigate()
  const { isDark, toggle } = useTheme()

  const [layout, setLayout] = useState<Layout | null>(null)
  const [rack, setRack] = useState<Rack | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [items, setItems] = useState<LayoutItemWithDevice[]>([])
  const { connectorById } = useConnectors()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imagesReady, setImagesReady] = useState(false)
  const [scale, setScale] = useState(1)
  const [includeSimplified, setIncludeSimplified] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [generatedAt] = useState(() => new Date())
  const exportRootRef = useRef<HTMLDivElement | null>(null)

  const { isAuthenticated, showPrompt, handleSubmit: handleAuthSubmit, handleCancel: handleAuthCancel } = useProjectAuth(project)

  const drawingFrameRef = useRef<HTMLDivElement | null>(null)
  const drawingContentRef = useRef<HTMLDivElement | null>(null)

  const scaleLabel = useMemo(() => `Fit (shared) ${scale.toFixed(2)}x`, [scale])
  const rackTotals = useMemo(() => {
    return items.reduce(
      (acc, item) => ({
        weightKg: acc.weightKg + item.device.weight_kg,
        powerW: acc.powerW + item.device.power_w,
      }),
      { weightKg: 0, powerW: 0 },
    )
  }, [items])

  const imageUrls = useMemo(() => {
    const urls = new Set<string>()
    for (const item of items) {
      const frontUrl = getDeviceImageUrl(item.device.front_image_path)
      const rearUrl = getDeviceImageUrl(item.device.rear_image_path)
      if (frontUrl) urls.add(frontUrl)
      if (rearUrl) urls.add(rearUrl)
    }
    return Array.from(urls)
  }, [items])

  const loadData = useCallback(async () => {
    if (!layoutId || !projectId) {
      setError('Missing project or layout id')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    setImagesReady(false)

    const { data: layoutData, error: layoutError } = await supabase
      .from('layouts')
      .select('*')
      .eq('id', layoutId)
      .eq('project_id', projectId)
      .single()

    if (layoutError) {
      setError('Layout not found in project')
      setLoading(false)
      return
    }

    const typedLayout = layoutData as Layout
    setLayout(typedLayout)

    const { data: projectData } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()
    setProject((projectData as Project) ?? null)

    const { data: rackData, error: rackError } = await supabase
      .from('racks')
      .select('*')
      .eq('id', typedLayout.rack_id)
      .single()

    if (rackError) {
      setError('Rack not found')
      setLoading(false)
      return
    }

    const { data: itemData, error: itemError } = await supabase
      .from('layout_items')
      .select(LAYOUT_ITEM_SELECT)
      .eq('layout_id', layoutId)

    if (itemError) {
      setError(itemError.message)
      setLoading(false)
      return
    }

    const rows = (itemData ?? []) as LayoutItemRow[]
    const mapped: LayoutItemWithDevice[] = mapLayoutItemRows(rows, connectorById)

    setRack(rackData as Rack)
    setItems(mapped)
    setLoading(false)
  }, [connectorById, layoutId, projectId])

  const recalculateScale = useCallback(() => {
    const frame = drawingFrameRef.current
    const content = drawingContentRef.current
    if (!frame || !content) return

    const frameWidth = frame.clientWidth
    const frameHeight = frame.clientHeight
    const contentWidth = content.scrollWidth
    const contentHeight = content.scrollHeight

    if (frameWidth <= 0 || frameHeight <= 0 || contentWidth <= 0 || contentHeight <= 0) {
      setScale(1)
      return
    }

    const nextScale = Math.min(frameWidth / contentWidth, frameHeight / contentHeight, 1)
    setScale((previous) => (Math.abs(previous - nextScale) < 0.001 ? previous : nextScale))
  }, [])

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
    const frame = drawingFrameRef.current
    const content = drawingContentRef.current
    if (!frame || !content) return

    const frameId = window.requestAnimationFrame(() => recalculateScale())
    const observer = new ResizeObserver(() => recalculateScale())
    observer.observe(frame)
    observer.observe(content)

    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frameId)
    }
  }, [recalculateScale, rack?.id])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => recalculateScale())
    return () => window.cancelAnimationFrame(frameId)
  }, [recalculateScale, items, imagesReady])

  const handleExportPdf = useCallback(async () => {
    if (!exportRootRef.current || !layout || !rack) return

    setExportingPdf(true)
    setExportError(null)
    setExportStatus('Preparing export...')

    try {
      await exportPrintSheetsToPdf({
        rootElement: exportRootRef.current,
        fileName: `${project?.name ?? 'project'}-${layout.name}.pdf`,
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
  }, [layout, project?.name, rack])

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

  if (loading || !layout || !rack) {
    return (
      <div className="layout-print-loading">
        <p>Preparing A3 PDF preview...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <PasswordPrompt
        isOpen={showPrompt}
        onSubmit={handleAuthSubmit}
        onCancel={() => { handleAuthCancel(); navigate('/projects') }}
        title="Password Required"
        description="This project is password-protected."
      />
    )
  }

  return (
    <div ref={exportRootRef} className="layout-print-page">
      <header className="layout-print-toolbar">
        <div className="layout-print-toolbar-actions">
          <Button variant="secondary" onClick={() => navigate(`/editor/project/${projectId}?layout=${layoutId}`)}>
            Back
          </Button>
          <Button onClick={() => void handleExportPdf()} disabled={exportingPdf || loading || !imagesReady}>
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
          <div className="ml-2 pl-4 border-l border-gray-300 dark:border-slate-700">
            <ThemeToggle isDark={isDark} toggle={toggle} className="text-gray-500 dark:text-slate-400" />
          </div>
        </div>
        <p className="layout-print-toolbar-meta">
          {layout.name} | {rack.name} | {rackTotals.weightKg.toFixed(2)} kg | {rackTotals.powerW} W | {imagesReady ? 'Ready' : 'Loading images'}
        </p>
        {exportStatus && <p className="layout-print-toolbar-status">{exportStatus}</p>}
        {exportError && <p className="layout-print-toolbar-error">{exportError}</p>}
      </header>

      <main className={`layout-print-stage ${includeSimplified ? 'layout-print-stage--project' : ''}`}>
        <LayoutPrintSheet
          layout={layout}
          rack={rack}
          items={items}
          generatedAt={generatedAt}
          projectOwner={project?.owner}
          totalWeightKg={rackTotals.weightKg}
          totalPowerW={rackTotals.powerW}
          scaleLabel={scaleLabel}
          pageNumber={1}
          pageCount={includeSimplified ? 2 : 1}
          scale={scale}
          drawingFrameRef={drawingFrameRef}
          drawingContentRef={drawingContentRef}
          sheetClassName={includeSimplified ? 'layout-print-page-break' : undefined}
        />
        {includeSimplified && (
          <LayoutPrintSheet
            layout={layout}
            rack={rack}
            items={items}
            generatedAt={generatedAt}
            projectOwner={project?.owner}
            totalWeightKg={rackTotals.weightKg}
            totalPowerW={rackTotals.powerW}
            scaleLabel={scaleLabel}
            pageNumber={2}
            pageCount={2}
            useAutoFitScale
            simplifiedView
          />
        )}
      </main>
    </div>
  )
}
