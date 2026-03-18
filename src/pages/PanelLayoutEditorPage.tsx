import { useCallback, useMemo, useState, type LegacyRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { TouchBackend } from 'react-dnd-touch-backend'
import { useDrag } from 'react-dnd'
import { useConnectors } from '../hooks/useConnectors'
import {
  autoDistributeAllRows,
  isMountingAllowed,
  rowHasCapacity,
  summarizeRowCapacities,
} from '../lib/panelGrid'
import { usePanelLayouts } from '../hooks/usePanelLayouts'
import type { ConnectorDefinition, DeviceFacing, PanelLayoutPort, PanelLayoutRow } from '../types'
import { useTheme } from '../hooks/useTheme'
import { useResponsiveLayout } from '../hooks/useResponsiveLayout'
import { usePanelDraft, usePanelDraftAutoSave, type PanelFormState } from '../hooks/usePanelDraft'
import ThemeToggle from '../components/ui/ThemeToggle'
import PanelLayoutCanvas from '../components/panels/PanelLayoutCanvas'
import { CONNECTOR_ITEM_TYPE, type ConnectorDragItem } from '../components/panels/panelDndTypes'


// ─── Dark workspace form primitives ──────────────────────────────────────────

function DarkLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-slate-400 md:text-sm">
      {children}
    </span>
  )
}

function DarkInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <DarkLabel>{label}</DarkLabel>
      <input
        className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/60 md:text-lg"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

function DarkSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <DarkLabel>{label}</DarkLabel>
      <select
        className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-slate-100 transition focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/60 md:text-lg"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

// ─── Category accent colors (chip only, not full bg) ─────────────────────────
const CATEGORY_DOT: Record<string, string> = {
  audio: '#f59e0b',
  data: '#06b6d4',
  power: '#3b82f6',
  multipin: '#a78bfa',
  other: '#6b7280',
}

// ─── DraggableConnectorButton ────────────────────────────────────────────────

function DraggableConnectorButton({
  connector,
  selected,
  allowed,
  onSelect,
}: {
  connector: ConnectorDefinition
  selected: boolean
  allowed: boolean
  onSelect: () => void
}) {
  const [{ isDragging }, dragRef] = useDrag<ConnectorDragItem, unknown, { isDragging: boolean }>({
    type: CONNECTOR_ITEM_TYPE,
    item: {
      type: CONNECTOR_ITEM_TYPE,
      connectorId: connector.id,
      gridWidth: connector.grid_width,
      gridHeight: connector.grid_height,
    },
    canDrag: allowed,
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  })

  return (
    <button
      ref={dragRef as unknown as LegacyRef<HTMLButtonElement>}
      type="button"
      onClick={onSelect}
      className={`w-full select-none rounded-lg border px-5 py-3.5 text-left transition ${
        selected
          ? 'border-amber-500/60 bg-amber-500/10 text-amber-100'
          : allowed
          ? 'border-slate-700/50 bg-slate-800/40 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
          : 'border-slate-800 bg-slate-900/30 text-slate-600'
      }`}
      style={{
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      <p className="text-base font-semibold leading-tight">{connector.name}</p>
      <p className="mt-1.5 text-sm text-slate-500">
        {connector.grid_width}×{connector.grid_height} grid
        {!allowed ? <span className="text-red-500/70"> · not allowed</span> : null}
      </p>
    </button>
  )
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
  const [saving, setSaving] = useState(false)

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

  const selectedConnector = selectedConnectorId ? connectorById.get(selectedConnectorId) ?? null : null
  const selectedPort = selectedPortId ? ports.find((port) => port.id === selectedPortId) ?? null : null
  const rowCapacities = useMemo(() => summarizeRowCapacities(rows, ports), [rows, ports])
  const rowCapacityByIndex = useMemo(
    () => new Map(rowCapacities.map((entry) => [entry.row_index, entry])),
    [rowCapacities],
  )

  /** Check if a row can accept a connector/port during drag hover. */
  const canDropInRow = (
    rowIndex: number,
    transferId: string,
    isPortMove: boolean,
  ): boolean => {
    if (!panel) return false

    if (isPortMove) {
      const movingPort = ports.find((port) => port.id === transferId)
      if (!movingPort) return false
      // Allow drop on same row (reorder) or on a row with capacity
      if (movingPort.row_index === rowIndex) return true
      return rowHasCapacity(rowIndex, movingPort.span_w, movingPort.span_h, rows, ports, movingPort.id)
    }

    const connector = connectorById.get(transferId)
    if (!connector) return false
    if (!isMountingAllowed(connector.mounting, facing)) return false
    return rowHasCapacity(rowIndex, connector.grid_width, connector.grid_height, rows, ports)
  }

  /** Place a new connector on a row and auto-distribute. */
  const placeConnector = (rowIndex: number, forcedConnectorId?: string) => {
    if (!panel) return
    const connector = forcedConnectorId
      ? connectorById.get(forcedConnectorId) ?? null
      : selectedConnector
    if (!connector) return
    if (forcedConnectorId) setSelectedConnectorId(forcedConnectorId)
    if (!isMountingAllowed(connector.mounting, facing)) {
      setError(`"${connector.name}" cannot be mounted on ${facing} panels.`)
      return
    }
    if (!rowHasCapacity(rowIndex, connector.grid_width, connector.grid_height, rows, ports)) {
      setError('No free space available for this connector footprint on the selected row.')
      return
    }

    const newPort: PanelLayoutPort = {
      id: `draft-port-${crypto.randomUUID()}`,
      panel_layout_id: panel.id,
      connector_id: connector.id,
      row_index: rowIndex,
      hole_index: 0, // placeholder — auto-distribute will set the real position
      span_w: connector.grid_width,
      span_h: connector.grid_height,
      label: null,
      created_at: panel.created_at,
      updated_at: panel.updated_at,
    }

    const newPorts = [...ports, newPort]
    const distributed = autoDistributeAllRows(newPorts, rows)
    setPorts(distributed)
    setSelectedPortId(newPort.id)
    setError(null)
    setDirty(true)
  }

  /** Move an already-placed port to a new row (or reorder within same row). */
  const movePort = (portId: string, rowIndex: number) => {
    if (!panel) return
    const existing = ports.find((p) => p.id === portId)
    if (!existing) return

    const connector = connectorById.get(existing.connector_id)
    if (connector && !isMountingAllowed(connector.mounting, facing)) {
      setError(`"${connector.name}" cannot be mounted on ${facing} panels.`)
      return
    }

    if (existing.row_index === rowIndex) {
      // Same row — no-op for now (order is maintained by auto-distribute)
      return
    }

    // Check capacity on target row
    if (!rowHasCapacity(rowIndex, existing.span_w, existing.span_h, rows, ports, existing.id)) {
      setError('No free space available at this row for the selected connector footprint.')
      return
    }

    const moved: PanelLayoutPort = { ...existing, row_index: rowIndex }
    const newPorts = ports.map((p) => (p.id === portId ? moved : p))
    const distributed = autoDistributeAllRows(newPorts, rows)
    setPorts(distributed)
    setSelectedPortId(portId)
    setError(null)
    setDirty(true)
  }

  /** Called by canvas on drop — distinguishes library drop vs. port move. */
  const handleRowDrop = (rowIndex: number, transferId: string, isPortMove: boolean) => {
    if (isPortMove) {
      movePort(transferId, rowIndex)
    } else {
      placeConnector(rowIndex, transferId)
    }
  }

  const updateSelectedPortLabel = (label: string) => {
    if (!selectedPort) return
    setPorts((current) => current.map((port) => (
      port.id === selectedPort.id
        ? { ...port, label: label || null }
        : port
    )))
    setDirty(true)
  }

  const removeSelectedPort = () => {
    if (!selectedPort) return
    const remaining = ports.filter((port) => port.id !== selectedPort.id)
    const distributed = autoDistributeAllRows(remaining, rows)
    setPorts(distributed)
    setSelectedPortId(null)
    setDirty(true)
  }

  const handleSave = async () => {
    if (!panel) return

    // Validate all placed ports are compatible with the current facing
    const invalidPorts = ports.filter((port) => {
      const connector = connectorById.get(port.connector_id)
      return connector && !isMountingAllowed(connector.mounting, facing)
    })
    if (invalidPorts.length > 0) {
      const names = invalidPorts
        .map((p) => connectorById.get(p.connector_id)?.name ?? p.connector_id)
        .join(', ')
      setError(`Cannot save: the following connectors are not allowed on ${facing} panels: ${names}. Remove or change facing first.`)
      return
    }

    setSaving(true)
    setError(null)
    try {
      await savePanelLayout(
        panel.id,
        { name: name.trim(), facing, has_lacing_bar: hasLacingBar, notes: notes.trim() || null },
        rows.map((row) => ({
          row_index: row.row_index,
          hole_count: row.hole_count,
          active_column_map: row.active_column_map,
        })),
        ports.map((port) => ({
          connector_id: port.connector_id,
          row_index: port.row_index,
          hole_index: port.hole_index,
          span_w: port.span_w,
          span_h: port.span_h,
          label: port.label ?? null,
        })),
      )
      clearDraft()
      setDirty(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save panel layout.')
    } finally {
      setSaving(false)
    }
  }

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

        {/* Placement mode indicator (fixed, above canvas) */}
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
              <div
                className="mx-auto"
                style={{
                  width: `${mobileZoom * 100}%`,
                }}
              >
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

        {/* Inline port action bar (floats above footer when a port is selected) */}
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
                  onClick={() => {
                    setMobileSheet('port-edit')
                  }}
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
          <div className="fixed inset-0 z-50 flex flex-col justify-end overflow-hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileSheet(null)} />
            <div
              className="relative bg-slate-900 rounded-t-2xl shadow-2xl flex flex-col"
              style={{
                maxHeight: '80svh',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="h-1 w-10 rounded-full bg-slate-700" />
              </div>

              {/* Sheet header */}
              <div className="px-4 pb-3 flex items-center justify-between shrink-0">
                <h2 className="font-bold text-sm uppercase tracking-widest text-slate-400">
                  {mobileSheet === 'connectors'
                    ? 'Add Connector'
                    : mobileSheet === 'port-edit'
                    ? 'Edit Connector'
                    : 'Panel Settings'}
                </h2>
                <button onClick={() => setMobileSheet(null)} className="p-2 text-slate-300 -mr-2">✕</button>
              </div>

              {/* Sheet content */}
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                {/* ── Connector Library ── */}
                {mobileSheet === 'connectors' && (
                  <div className="space-y-4">
                    {grouped.map((group) => (
                      <section key={group.category}>
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: CATEGORY_DOT[group.category] ?? '#6b7280' }}
                          />
                          <h3 className="text-[9px] font-bold uppercase tracking-widest"
                            style={{ color: CATEGORY_DOT[group.category] ?? '#6b7280' }}>
                            {group.category}
                          </h3>
                        </div>
                        <div className="space-y-1.5">
                          {group.items.map((connector) => {
                            const isSelected = selectedConnectorId === connector.id
                            const isAllowed = isMountingAllowed(connector.mounting, facing)
                            return (
                              <button
                                key={connector.id}
                                type="button"
                                onClick={() => {
                                  setSelectedConnectorId(connector.id)
                                  setSelectedPortId(null)
                                  setMobileSheet(null)
                                }}
                                disabled={!isAllowed}
                                className={`w-full rounded-lg border px-3 py-2.5 text-left transition min-h-11 ${
                                  isSelected
                                    ? 'border-amber-500/60 bg-amber-500/10 text-amber-100'
                                    : isAllowed
                                    ? 'border-slate-700/50 bg-slate-800/40 text-slate-300 active:bg-slate-800'
                                    : 'border-slate-800 bg-slate-900/30 text-slate-600'
                                }`}
                              >
                                <p className="text-xs font-medium leading-tight">{connector.name}</p>
                                <p className="mt-0.5 text-[10px] text-slate-500">
                                  {connector.grid_width}×{connector.grid_height} grid · {connector.mounting}
                                  {!isAllowed ? <span className="text-red-500/70"> · {facing} not supported</span> : null}
                                </p>
                              </button>
                            )
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                )}

                {/* ── Port Edit ── */}
                {mobileSheet === 'port-edit' && selectedPort && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                      <p className="text-xs font-medium text-slate-200">
                        {selectedPortConnector?.name ?? 'Unknown'}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {selectedPort.span_w}×{selectedPort.span_h} grid · Row {selectedPort.row_index + 1}
                      </p>
                    </div>
                    <DarkInput
                      label="Label override"
                      value={selectedPort.label ?? ''}
                      onChange={updateSelectedPortLabel}
                      placeholder={selectedPortConnector?.name ?? 'Label'}
                    />
                    <button
                      type="button"
                      onClick={() => { removeSelectedPort(); setMobileSheet(null) }}
                      className="w-full rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2.5 text-xs font-semibold text-red-400 min-h-11"
                    >
                      Remove Connector
                    </button>
                  </div>
                )}

                {/* ── Properties ── */}
                {mobileSheet === 'properties' && (
                  <div className="space-y-5">
                    <DarkInput label="Name" value={name} onChange={(v) => { setName(v); setDirty(true) }} />
                    <DarkSelect
                      label="Facing"
                      value={facing}
                      onChange={(v) => { setFacing(v as DeviceFacing); setDirty(true) }}
                      options={[
                        { value: 'front', label: 'Front' },
                        { value: 'rear', label: 'Rear' },
                      ]}
                    />
                    <label className="flex cursor-pointer items-center gap-3 min-h-11">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={hasLacingBar}
                          onChange={(e) => { setHasLacingBar(e.target.checked); setDirty(true) }}
                        />
                        <div className="h-5 w-9 rounded-full border border-slate-700 bg-slate-800 transition peer-checked:border-amber-500/60 peer-checked:bg-amber-500/20" />
                        <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-slate-500 transition peer-checked:translate-x-4 peer-checked:bg-amber-400" />
                      </div>
                      <span className="text-xs text-slate-300">Show lacing bar</span>
                    </label>
                    <div>
                      <DarkLabel>Notes</DarkLabel>
                      <textarea
                        className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500/60 transition resize-none"
                        rows={3}
                        value={notes}
                        onChange={(e) => { setNotes(e.target.value); setDirty(true) }}
                        placeholder="Optional notes…"
                      />
                    </div>

                    {/* Row capacities */}
                    <div className="border-t border-slate-800 pt-4 space-y-2">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Row Usage</h3>
                      {rows.map((row) => {
                        const capacity = rowCapacityByIndex.get(row.row_index)
                        return (
                          <div key={row.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-800/30 p-2">
                            <span className="text-[10px] font-mono text-slate-500 w-6">U{row.row_index + 1}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-amber-500/60 transition-all"
                                style={{ width: `${capacity ? Math.round((capacity.occupied_holes / capacity.hole_count) * 100) : 0}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 w-12 text-right">
                              {capacity ? `${capacity.occupied_holes}/${capacity.hole_count}` : `${row.hole_count}`}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Print link */}
                    <button
                      onClick={() => navigate(`/editor/project/${projectId}/panels/${panel.id}/print`)}
                      className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs text-slate-300 min-h-11"
                    >
                      Export PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Desktop Layout ──────────────────────────────────────────────────────────
  return (
    // Full workspace: theme-aware background, full-height layout
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
        <aside className="flex w-[27rem] shrink-0 flex-col border-l border-slate-800 bg-slate-900/80 overflow-y-auto">
          <div className="border-b border-slate-800 px-5 py-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Panel Properties</h2>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
            {/* Core props */}
            <DarkInput label="Name" value={name} onChange={(v) => { setName(v); setDirty(true) }} />

            <DarkSelect
              label="Facing"
              value={facing}
              onChange={(v) => { setFacing(v as DeviceFacing); setDirty(true) }}
              options={[
                { value: 'front', label: 'Front' },
                { value: 'rear', label: 'Rear' },
              ]}
            />

            <label className="flex cursor-pointer items-center gap-3">
              <div className="relative">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={hasLacingBar}
                  onChange={(e) => { setHasLacingBar(e.target.checked); setDirty(true) }}
                />
                <div className="h-5 w-9 rounded-full border border-slate-700 bg-slate-800 transition peer-checked:border-amber-500/60 peer-checked:bg-amber-500/20" />
                <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-slate-500 transition peer-checked:translate-x-4 peer-checked:bg-amber-400" />
              </div>
              <span className="text-sm text-slate-300">Show lacing bar</span>
            </label>

            <div>
              <DarkLabel>Notes</DarkLabel>
              <textarea
                className="w-full resize-none rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-base text-slate-100 placeholder-slate-500 transition focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                rows={3}
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setDirty(true) }}
                placeholder="Optional notes…"
              />
            </div>

            {/* Auto grid status */}
            <div className="border-t border-slate-800 pt-4 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Auto Spacing</h3>
              <p className="text-sm text-slate-500">
                Connectors are automatically spaced evenly within each row. Drop connectors onto a row to place them.
              </p>
              {rows.map((row) => (
                <div key={row.id} className="rounded-lg border border-slate-800 bg-slate-800/30 p-4">
                  <p className="mb-2 text-sm font-mono uppercase tracking-widest text-slate-500">U{row.row_index + 1}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    {(() => {
                      const capacity = rowCapacityByIndex.get(row.row_index)
                      if (!capacity) return `${row.hole_count} slots`
                      return `${capacity.occupied_holes}/${capacity.hole_count} used · ${capacity.free_holes} free`
                    })()}
                  </p>
                </div>
              ))}
            </div>

            {/* Selected connector */}
            {selectedPort ? (
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-widest text-amber-500/80">Selected Connector</h3>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-3">
                  <p className="text-base font-medium text-slate-200">
                    {connectorById.get(selectedPort.connector_id)?.name ?? 'Unknown'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {selectedPort.span_w}×{selectedPort.span_h} grid · row {selectedPort.row_index + 1}
                  </p>
                  <DarkInput
                    label="Label override"
                    value={selectedPort.label ?? ''}
                    onChange={updateSelectedPortLabel}
                    placeholder={connectorById.get(selectedPort.connector_id)?.name ?? 'Label'}
                  />
                  <button
                    type="button"
                    onClick={removeSelectedPort}
                    className="w-full rounded-md border border-red-900/50 bg-red-950/40 px-3 py-3 text-base font-semibold text-red-400 transition hover:bg-red-950/70 hover:text-red-300"
                  >
                    Remove Connector
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-t border-slate-800 pt-4">
                <p className="text-sm text-slate-600">Click a placed connector to edit its label or remove it.</p>
              </div>
            )}
          </div>
        </aside>
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
