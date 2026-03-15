import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Button from '../components/ui/Button'
import LayoutPrintSheet from '../components/print/LayoutPrintSheet'
import type { Layout, LayoutItemWithDevice, Project, Rack } from '../types'
import { supabase } from '../lib/supabase'
import { getDeviceImageUrl } from '../hooks/useDevices'
import { LAYOUT_ITEM_SELECT, mapLayoutItemRows, type LayoutItemRow } from '../lib/layoutItemMapper'
import '../components/print/layoutPrint.css'

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => resolve()
    image.src = url
  })
}

export default function LayoutPrintPage() {
  const { projectId, layoutId } = useParams<{ projectId: string; layoutId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [layout, setLayout] = useState<Layout | null>(null)
  const [rack, setRack] = useState<Rack | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [items, setItems] = useState<LayoutItemWithDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imagesReady, setImagesReady] = useState(false)
  const [scale, setScale] = useState(1)
  const [autoPrintDone, setAutoPrintDone] = useState(false)
  const [generatedAt] = useState(() => new Date())

  const drawingFrameRef = useRef<HTMLDivElement | null>(null)
  const drawingContentRef = useRef<HTMLDivElement | null>(null)

  const autoPrintRequested = searchParams.get('autoprint') === '1'

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
    const mapped: LayoutItemWithDevice[] = mapLayoutItemRows(rows)

    setRack(rackData as Rack)
    setItems(mapped)
    setLoading(false)
  }, [layoutId, projectId])

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

  useEffect(() => {
    if (!autoPrintRequested || autoPrintDone || loading || error || !layout || !rack || !imagesReady) return
    const timer = window.setTimeout(() => {
      setAutoPrintDone(true)
      window.print()
    }, 250)
    return () => window.clearTimeout(timer)
  }, [autoPrintRequested, autoPrintDone, loading, error, layout, rack, imagesReady])

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
        <p>Preparing A3 print preview...</p>
      </div>
    )
  }

  return (
    <div className="layout-print-page">
      <header className="layout-print-toolbar">
        <div className="layout-print-toolbar-actions">
          <Button variant="secondary" onClick={() => navigate(`/editor/project/${projectId}?layout=${layoutId}`)}>
            Back
          </Button>
          <Button onClick={() => window.print()}>Print</Button>
        </div>
        <p className="layout-print-toolbar-meta">
          {layout.name} | {rack.name} | {rackTotals.weightKg.toFixed(2)} kg | {rackTotals.powerW} W | {imagesReady ? 'Ready' : 'Loading images'}
        </p>
      </header>

      <main className="layout-print-stage">
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
          pageCount={1}
          scale={scale}
          drawingFrameRef={drawingFrameRef}
          drawingContentRef={drawingContentRef}
        />
      </main>
    </div>
  )
}
