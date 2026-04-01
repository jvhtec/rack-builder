import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Button from '../components/ui/Button'
import type { DeviceFacing, PanelLayout, Project } from '../types'
import { supabase } from '../lib/supabase'
import { mapPanelLayout, type PanelLayoutRecord } from '../lib/panelLayoutMapper'
import PanelPrintSheet from '../components/print/PanelPrintSheet'
import { useTheme } from '../hooks/useTheme'
import ThemeToggle from '../components/ui/ThemeToggle'
import { exportPrintSheetsToPdf } from '../lib/printPdfExport'
import '../components/print/layoutPrint.css'

export default function PanelLayoutPrintPage() {
  const { projectId, panelLayoutId } = useParams<{ projectId: string; panelLayoutId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isDark, toggle } = useTheme()

  const [project, setProject] = useState<Project | null>(null)
  const [panel, setPanel] = useState<PanelLayout | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [generatedAt] = useState(() => new Date())
  const exportRootRef = useRef<HTMLDivElement | null>(null)

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

  const handleExportPdf = async () => {
    if (!exportRootRef.current || !project || !panel) return

    setExportingPdf(true)
    setExportError(null)
    setExportStatus('Preparing export...')

    try {
      await exportPrintSheetsToPdf({
        rootElement: exportRootRef.current,
        fileName: `${project.name}-${panel.name}-${facing}.pdf`,
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
  }

  if (loading) return <div className="layout-print-loading"><p>Preparing panel PDF preview...</p></div>

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
    <div ref={exportRootRef} className="layout-print-page">
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
          <Button onClick={() => void handleExportPdf()} disabled={exportingPdf || loading}>
            {exportingPdf ? 'Exporting...' : exportError ? 'Retry Export PDF' : 'Export PDF'}
          </Button>
          <div className="ml-2 pl-4 border-l border-gray-300 dark:border-slate-700">
            <ThemeToggle isDark={isDark} toggle={toggle} className="text-gray-500 dark:text-slate-400" />
          </div>
        </div>
        <p className="layout-print-toolbar-meta">
          {project.name} | {panel.name} | {panel.height_ru}U
        </p>
        {exportStatus && <p className="layout-print-toolbar-status">{exportStatus}</p>}
        {exportError && <p className="layout-print-toolbar-error">{exportError}</p>}
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
