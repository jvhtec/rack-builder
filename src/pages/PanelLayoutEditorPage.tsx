import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { TouchBackend } from 'react-dnd-touch-backend'
import { useConnectors } from '../hooks/useConnectors'
import { isMountingAllowed } from '../lib/panelGrid'
import { usePanelLayouts } from '../hooks/usePanelLayouts'
import type { DeviceFacing, PanelLayoutPort, PanelLayoutRow } from '../types'
import { useTheme } from '../hooks/useTheme'
import { useResponsiveLayout } from '../hooks/useResponsiveLayout'
import { usePanelDraft, usePanelDraftAutoSave, type PanelFormState } from '../hooks/usePanelDraft'
import { usePanelGridPlacement } from '../hooks/usePanelGridPlacement'
import { usePanelSave } from '../hooks/usePanelSave'
import ThemeToggle from '../components/ui/ThemeToggle'
import DraggableConnectorButton from '../components/panels/DraggableConnectorButton'
import PanelLayoutCanvas from '../components/panels/PanelLayoutCanvas'
import PanelMobileSheet from '../components/panels/PanelMobileSheet'
import PanelPropertiesSidebar from '../components/panels/PanelPropertiesSidebar'


// ─── Category accent colors ──────────────────────────────────────────────────
const CATEGORY_DOT: Record<string, string> = {
  audio: '#f59e0b',
  data: '#06b6d4',
  power: '#3b82f6',
  multipin: '#a78bfa',
  other: '#6b7280',
}

// ─── Main Editor ─────────────────────────────────────────────────────────────

function PanelLayoutEditorInner({ isMobile, isPortrait, isTouchDevice }: { isMobile: boolean; isPortrait: boolean; isTouchDevice: boolean }) {
  const isMobileLike = isMobile || isTouchDevice
  const { projectId, panelLayoutId } = useParams<{ projectId: string; panelLayoutId: string }>()
  const navigate = useNavigate()
  const { isDark, toggle } = useTheme()
  const {
    panelLayouts,
    loading,
    savePanelLayout,
  } = usePanelLayouts(projectId)
  const { connectorById, grouped } = useConnectors()
  const panel = useMemo(
    () => panelLayouts.find((entry) => entry.id === panelLayoutId) ?? null,
    [panelLayoutId, panelLayouts],
  )

  // Mobile sheet state
  const [mobileSheet, setMobileSheet] = useState<'connectors' | 'properties' | 'port-edit' | null>(null)

  const [name, setName] = useState('')
  const [facing, setFacing] = useState<DeviceFacing>('front')
  const [hasLacingBar, setHasLacingBar] = useState(false)
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<PanelLayoutRow[]>([])
  const [ports, setPorts] = useState<PanelLayoutPort[]>([])
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null)
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null)
  const [mobileZoom, setMobileZoom] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const setFormState = useCallback((state: PanelFormState) => {
    setName(state.name)
    setFacing(state.facing)
    setHasLacingBar(state.hasLacingBar)
    setNotes(state.notes)
    setRows(state.rows)
    setPorts(state.ports)
  }, [])

  const { dirty, setDirty, draftStorageKey, clearDraft } = usePanelDraft({
    panel, projectId, panelLayoutId, setFormState,
  })

  const formState = useMemo<PanelFormState>(
    () => ({ name, facing, hasLacingBar, notes, rows, ports }),
    [name, facing, hasLacingBar, notes, rows, ports],
  )

  usePanelDraftAutoSave({ panel, dirty, draftStorageKey, formState })

  const {
    selectedPort, rowCapacityByIndex,
    canDropInRow, placeConnector, handleRowDrop,
    updateSelectedPortLabel, removeSelectedPort,
  } = usePanelGridPlacement({
    panel, rows, ports,
    setPorts: (updater) => setPorts(updater),
    facing, connectorById,
    selectedConnectorId, setSelectedConnectorId,
    selectedPortId, setSelectedPortId,
    setError, setDirty,
  })

  const { saving, handleSave } = usePanelSave({
    panel, connectorById, name, facing, hasLacingBar, notes, rows, ports,
    savePanelLayout, clearDraft, setDirty, setError,
  })

  if (isMobileLike && isPortrait) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-slate-950 text-slate-100"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="text-6xl" style={{ transform: 'rotate(90deg)' }}>📱</div>
        <div className="text-center px-8">
          <p className="text-lg font-bold text-slate-100 mb-2">Rotate your device</p>
          <p className="text-sm text-slate-400">
            The panel layout editor requires landscape orientation.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-amber-500" />
          Loading panel editor…
        </div>
      </div>
    )
  }

  if (!panel || !projectId) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-red-400">Panel layout not found.</p>
        <button
          className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition"
          onClick={() => navigate('/projects')}
        >
          Back to projects
        </button>
      </div>
    )
  }

  // save button state
  const saveLabel = saving ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'
  const saveActive = !saving && !!name.trim() && dirty

  // ─── Mobile Layout ──────────────────────────────────────────────────────────
  if (isMobileLike) {
    const selectedPortConnector = selectedPort
      ? connectorById.get(selectedPort.connector_id) ?? null
      : null

    const zoomPercent = Math.round(mobileZoom * 100)
    const zoomOutDisabled = mobileZoom <= 0.6
    const zoomInDisabled = mobileZoom >= 1.8
    const zoomResetDisabled = mobileZoom === 1

    return (
      <div className="flex flex-col h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 overflow-hidden">
        {/* Mobile header */}
        <header
          className="flex items-center justify-between px-4 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shrink-0 z-30"
          style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}
        >
          <button
            onClick={() => navigate(`/editor/project/${projectId}/panels`)}
            className="text-gray-600 dark:text-slate-300 text-sm font-semibold"
          >
            &larr; Back
          </button>
          <div className="flex flex-col items-center min-w-0 px-2">
            <h1 className="text-sm font-bold truncate max-w-[150px] dark:text-white">{panel.name}</h1>
            <span className="text-[10px] text-gray-500 dark:text-slate-500">{panel.height_ru}U · {facing} · {ports.length} connectors</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle isDark={isDark} toggle={toggle} className="text-gray-500 dark:text-slate-400" />
            <button
              onClick={() => void handleSave()}
              disabled={!saveActive}
              className={`text-sm font-semibold px-2 ${saveActive ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-slate-600'}`}
            >
              {saving ? '…' : dirty ? 'Save' : 'Saved'}
            </button>
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="bg-red-950/60 border-b border-red-900/40 px-4 py-2 text-xs text-red-400 shrink-0">
            {error}
            <button className="ml-2 text-red-500" onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* Placement mode indicator */}
        {selectedConnectorId && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between shrink-0 z-20">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <span className="text-xs text-amber-300 truncate">
                <strong>{connectorById.get(selectedConnectorId)?.name}</strong> — tap a row to place
              </span>
            </div>
            <button
              onClick={() => setSelectedConnectorId(null)}
              className="ml-2 shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Canvas area */}
        <main
          className="flex-1 overflow-auto"
          style={{
            background: 'radial-gradient(ellipse at 50% 0%, #1e293b 0%, #0a0f1a 70%)',
            paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))',
          }}
        >
          <div className="p-4 flex flex-col items-center gap-3">
            <div className="w-full max-w-lg flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setMobileZoom((prev) => Math.max(0.6, +(prev - 0.1).toFixed(2)))}
                disabled={zoomOutDisabled}
                aria-disabled={zoomOutDisabled}
                className={`min-h-9 min-w-9 rounded-md border px-2 text-sm font-bold transition ${
                  zoomOutDisabled
                    ? 'cursor-not-allowed border-slate-800 bg-slate-900/30 text-slate-600'
                    : 'border-slate-700 bg-slate-900/70 text-slate-200'
                }`}
                aria-label="Zoom out panel"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => setMobileZoom(1)}
                disabled={zoomResetDisabled}
                aria-disabled={zoomResetDisabled}
                className={`rounded-md border px-3 py-1.5 text-[11px] font-semibold transition ${
                  zoomResetDisabled
                    ? 'cursor-not-allowed border-slate-800 bg-slate-900/30 text-slate-600'
                    : 'border-slate-700 bg-slate-900/60 text-slate-300'
                }`}
                aria-label="Reset panel zoom"
              >
                Zoom {zoomPercent}%
              </button>
              <button
                type="button"
                onClick={() => setMobileZoom((prev) => Math.min(1.8, +(prev + 0.1).toFixed(2)))}
                disabled={zoomInDisabled}
                aria-disabled={zoomInDisabled}
                className={`min-h-9 min-w-9 rounded-md border px-2 text-sm font-bold transition ${
                  zoomInDisabled
                    ? 'cursor-not-allowed border-slate-800 bg-slate-900/30 text-slate-600'
                    : 'border-slate-700 bg-slate-900/70 text-slate-200'
                }`}
                aria-label="Zoom in panel"
              >
                +
              </button>
            </div>

            {/* Row usage summary */}
            <div className="w-full max-w-lg flex flex-wrap gap-1.5 justify-center">
              {rows.map((row) => {
                const capacity = rowCapacityByIndex.get(row.row_index)
                const pct = capacity ? Math.round((capacity.occupied_holes / capacity.hole_count) * 100) : 0
                return (
                  <div key={row.id} className="rounded-md border border-slate-800 bg-slate-900/60 px-2 py-1">
                    <span className="text-[9px] font-mono text-slate-500">U{row.row_index + 1}</span>
                    <span className="ml-1 text-[9px] text-slate-400">{pct}%</span>
                  </div>
                )
              })}
            </div>

            <div className="w-full self-stretch overflow-x-auto -mx-4 px-4">
              <div className="mx-auto" style={{ width: `${mobileZoom * 100}%` }}>
                <PanelLayoutCanvas
                  connectorById={connectorById}
                  heightRu={panel.height_ru}
                  rows={rows}
                  ports={ports}
                  facing={facing}
                  hasLacingBar={hasLacingBar}
                  selectedPortId={selectedPortId}
                  onRowClick={(rowIndex) => placeConnector(rowIndex)}
                  onRowDrop={handleRowDrop}
                  canDropInRow={canDropInRow}
                  onPortClick={(portId) => {
                    setSelectedPortId(portId === selectedPortId ? null : portId)
                    setSelectedConnectorId(null)
                  }}
                  interactive
                />
              </div>
            </div>

            <p className="text-[10px] text-slate-600 max-w-xs text-center">
              Select a connector below, then tap a row to place. Tap placed connectors to edit.
            </p>
          </div>
        </main>

        {/* Inline port action bar */}
        {selectedPort && !mobileSheet && (
          <div
            className="fixed inset-x-0 z-40 px-4 pb-2 pointer-events-none"
            style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
          >
            <div className="pointer-events-auto mx-auto max-w-lg rounded-xl border border-amber-500/30 bg-slate-900/95 shadow-2xl shadow-black/40 backdrop-blur-sm">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-amber-200 truncate">
                    {selectedPortConnector?.name ?? 'Connector'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Row {selectedPort.row_index + 1} · {selectedPort.span_w}×{selectedPort.span_h}
                    {selectedPort.label ? ` · "${selectedPort.label}"` : ''}
                  </p>
                </div>
                <button
                  onClick={() => setMobileSheet('port-edit')}
                  className="shrink-0 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-[10px] font-bold text-slate-300 uppercase"
                >
                  Edit
                </button>
                <button
                  onClick={() => removeSelectedPort()}
                  className="shrink-0 rounded-md border border-red-900/50 bg-red-950/60 px-3 py-1.5 text-[10px] font-bold text-red-400 uppercase"
                >
                  Remove
                </button>
                <button
                  onClick={() => setSelectedPortId(null)}
                  className="shrink-0 text-slate-500 px-1"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile footer */}
        <footer
          className="bg-slate-900 border-t border-slate-800 flex items-center justify-around shrink-0 z-30"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)', minHeight: 'calc(4rem + env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={() => setMobileSheet('connectors')}
            className={`flex flex-col items-center gap-1 px-6 py-2 ${selectedConnectorId ? 'text-amber-400' : 'text-slate-400'}`}
          >
            <span className="text-lg">▦</span>
            <span className="text-[10px] font-bold uppercase">Connectors</span>
          </button>
          <button
            onClick={() => setMobileSheet('properties')}
            className="flex flex-col items-center gap-1 px-6 py-2 text-slate-400"
          >
            <span className="text-lg">⚙</span>
            <span className="text-[10px] font-bold uppercase">Settings</span>
          </button>
        </footer>

        {/* Bottom sheet drawer */}
        {mobileSheet && (
          <PanelMobileSheet
            mobileSheet={mobileSheet}
            onClose={() => setMobileSheet(null)}
            grouped={grouped}
            connectorById={connectorById}
            selectedConnectorId={selectedConnectorId}
            setSelectedConnectorId={setSelectedConnectorId}
            setSelectedPortId={setSelectedPortId}
            facing={facing}
            selectedPort={selectedPort}
            updateSelectedPortLabel={updateSelectedPortLabel}
            removeSelectedPort={removeSelectedPort}
            name={name}
            setName={setName}
            setFacing={setFacing}
            hasLacingBar={hasLacingBar}
            setHasLacingBar={setHasLacingBar}
            notes={notes}
            setNotes={setNotes}
            setDirty={setDirty}
            rows={rows}
            rowCapacityByIndex={rowCapacityByIndex}
            onExportPdf={() => navigate(`/editor/project/${projectId}/panels/${panel.id}/print`)}
          />
        )}
      </div>
    )
  }

  // ─── Desktop Layout ──────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-screen flex-col gap-0 bg-gray-100 dark:bg-slate-950 text-gray-900 dark:text-slate-100 -m-4 md:-m-6 md:text-[17px]">

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-6 border-b border-gray-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 px-8 py-5 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(`/editor/project/${projectId}/panels`)}
            className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-5 py-2.5 text-base font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
          >
            <svg className="h-5 w-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 12L6 8l4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Panels
          </button>
          <div className="h-5 w-px bg-gray-200 dark:bg-slate-700" />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-slate-100 md:text-2xl">{panel.name}</h1>
            <p className="text-sm text-gray-500 dark:text-slate-500">{panel.height_ru}U • {rows.length} rows • {ports.length} connectors</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {error && (
            <p className="max-w-md truncate text-base text-red-400">{error}</p>
          )}
          <button
            onClick={() => navigate(`/editor/project/${projectId}/panels/${panel.id}/print`)}
            className="rounded-md border border-slate-700 bg-slate-800 px-5 py-2.5 text-base font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
          >
            Export PDF
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={!saveActive}
            className={`rounded-md px-6 py-2.5 text-base font-semibold transition ${
              saveActive
                ? 'bg-amber-500 text-slate-900 hover:bg-amber-400 shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
            }`}
          >
            {saveLabel}
          </button>
          <div className="ml-2 pl-4 border-l border-gray-200 dark:border-slate-700">
            <ThemeToggle isDark={isDark} toggle={toggle} className="text-gray-500 dark:text-slate-400" />
          </div>
        </div>
      </header>

      {/* ── Three-column workspace ─────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left panel: Connector Library */}
        <aside className="flex w-[22rem] shrink-0 flex-col border-r border-slate-800 bg-slate-900/80">
          <div className="border-b border-slate-800 px-5 py-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Connector Library</h2>
            <p className="mt-1 text-sm text-slate-600">Click to select, or drag onto a row</p>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
            {grouped.map((group) => (
              <section key={group.category}>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: CATEGORY_DOT[group.category] ?? '#6b7280' }}
                  />
                  <h3 className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: CATEGORY_DOT[group.category] ?? '#6b7280' }}>
                    {group.category}
                  </h3>
                </div>
                <div className="space-y-1">
                  {group.items.map((connector) => {
                    const isSelected = selectedConnectorId === connector.id
                    const isAllowed = isMountingAllowed(connector.mounting, facing)
                    return (
                      <DraggableConnectorButton
                        key={connector.id}
                        connector={connector}
                        selected={isSelected}
                        allowed={isAllowed}
                        onSelect={() => setSelectedConnectorId(connector.id)}
                      />
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </aside>

        {/* Center: Canvas workspace */}
        <main className="flex flex-1 flex-col items-center justify-start gap-8 overflow-auto px-3 py-8 md:px-4"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, #1e293b 0%, #0a0f1a 70%)' }}>

          {selectedConnectorId && (
            <div className="flex items-center gap-3 rounded-full border border-amber-500/30 bg-amber-500/10 px-6 py-2.5 text-base text-amber-300">
              <svg className="h-5 w-5" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="8" r="7" />
              </svg>
              <strong>{connectorById.get(selectedConnectorId)?.name}</strong> selected — click a row or drag to place
              <button
                className="ml-2 text-amber-400/60 hover:text-amber-300 transition"
                onClick={() => setSelectedConnectorId(null)}
              >
                ✕
              </button>
            </div>
          )}

          <div className="w-full max-w-none">
            <PanelLayoutCanvas
              connectorById={connectorById}
              heightRu={panel.height_ru}
              rows={rows}
              ports={ports}
              facing={facing}
              hasLacingBar={hasLacingBar}
              selectedPortId={selectedPortId}
              onRowClick={(rowIndex) => placeConnector(rowIndex)}
              onRowDrop={handleRowDrop}
              canDropInRow={canDropInRow}
              onPortClick={setSelectedPortId}
              interactive
            />
          </div>

          <p className="max-w-xl text-center text-sm text-slate-500">
            Drop connectors onto a row and spacing adjusts automatically. Drag placed connectors between rows to reorder.
          </p>
        </main>

        {/* Right panel: Properties */}
        <PanelPropertiesSidebar
          name={name}
          setName={setName}
          facing={facing}
          setFacing={setFacing}
          hasLacingBar={hasLacingBar}
          setHasLacingBar={setHasLacingBar}
          notes={notes}
          setNotes={setNotes}
          setDirty={setDirty}
          rows={rows}
          rowCapacityByIndex={rowCapacityByIndex}
          selectedPort={selectedPort}
          connectorById={connectorById}
          updateSelectedPortLabel={updateSelectedPortLabel}
          removeSelectedPort={removeSelectedPort}
        />
      </div>
    </div>
  )
}

// ─── DndProvider wrapper ─────────────────────────────────────────────────────

export default function PanelLayoutEditorPage() {
  const { isMobile, isTouchLikeDevice, isPortrait } = useResponsiveLayout()

  const dndBackend = isTouchLikeDevice ? TouchBackend : HTML5Backend
  const dndOptions = isTouchLikeDevice
    ? {
        enableMouseEvents: true,
        delayTouchStart: 120,
        touchSlop: 8,
        ignoreContextMenu: true,
      }
    : undefined

  return (
    <DndProvider backend={dndBackend} options={dndOptions}>
      <PanelLayoutEditorInner isMobile={isMobile} isPortrait={isPortrait} isTouchDevice={isTouchLikeDevice} />
    </DndProvider>
  )
}
