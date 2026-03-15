import { useEffect, useMemo, useRef, useState, type LegacyRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { TouchBackend } from 'react-dnd-touch-backend'
import { useDrag } from 'react-dnd'
import { groupedConnectors, CONNECTOR_BY_ID } from '../lib/connectorCatalog'
import {
  autoDistributeAllRows,
  isMountingAllowed,
  rowHasCapacity,
  summarizeRowCapacities,
  getActiveColumns,
} from '../lib/panelGrid'
import { usePanelLayouts } from '../hooks/usePanelLayouts'
import type { ConnectorDefinition, DeviceFacing, PanelLayoutPort, PanelLayoutRow } from '../types'
import PanelLayoutCanvas from '../components/panels/PanelLayoutCanvas'
import { CONNECTOR_ITEM_TYPE, type ConnectorDragItem } from '../components/panels/panelDndTypes'

const DRAFT_STORAGE_PREFIX = 'panel-layout-draft'
const AUTO_HOLE_COUNT = 16

interface DraftState {
  name: string
  facing: DeviceFacing
  hasLacingBar: boolean
  notes: string
  rows: Array<Pick<PanelLayoutRow, 'row_index' | 'hole_count' | 'active_column_map'>>
  ports: Array<Pick<PanelLayoutPort, 'id' | 'connector_id' | 'row_index' | 'hole_index' | 'span_w' | 'span_h' | 'label'>>
}

function normalizeRowsToAutoGrid(
  panelId: string,
  heightRu: number,
  rows: Array<Partial<PanelLayoutRow>>,
  createdAt: string,
  updatedAt: string,
): PanelLayoutRow[] {
  const byIndex = new Map<number, Partial<PanelLayoutRow>>()
  for (const row of rows) {
    if (typeof row.row_index === 'number') byIndex.set(row.row_index, row)
  }

  return Array.from({ length: Math.max(1, heightRu) }, (_, rowIndex) => {
    const existing = byIndex.get(rowIndex)
    const holeCount = (existing?.hole_count ?? AUTO_HOLE_COUNT) as 4 | 6 | 8 | 12 | 16
    return {
      id: existing?.id ?? `auto-row-${rowIndex}`,
      panel_layout_id: panelId,
      row_index: rowIndex,
      hole_count: holeCount,
      active_column_map: existing?.active_column_map?.length ? existing.active_column_map : getActiveColumns(holeCount),
      created_at: existing?.created_at ?? createdAt,
      updated_at: existing?.updated_at ?? updatedAt,
    }
  })
}

// ─── Dark workspace form primitives ──────────────────────────────────────────

function DarkLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
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
        className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500/60 transition"
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
        className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500/60 transition"
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
      className={`w-full rounded-lg border px-3 py-2 text-left transition select-none ${
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
      <p className="text-xs font-medium leading-tight">{connector.name}</p>
      <p className="mt-0.5 text-[10px] text-slate-500">
        {connector.grid_width}×{connector.grid_height} grid
        {!allowed ? <span className="text-red-500/70"> · not allowed</span> : null}
      </p>
    </button>
  )
}

// ─── Main Editor ─────────────────────────────────────────────────────────────

function PanelLayoutEditorInner({ isMobile }: { isMobile: boolean }) {
  const { projectId, panelLayoutId } = useParams<{ projectId: string; panelLayoutId: string }>()
  const navigate = useNavigate()
  const {
    panelLayouts,
    loading,
    updatePanelLayout,
    replaceRows,
    replacePorts,
  } = usePanelLayouts(projectId)
  const panel = useMemo(
    () => panelLayouts.find((entry) => entry.id === panelLayoutId) ?? null,
    [panelLayoutId, panelLayouts],
  )

  // Mobile sheet state: 'connectors' | 'properties' | null
  const [mobileSheet, setMobileSheet] = useState<'connectors' | 'properties' | null>(null)

  const [name, setName] = useState('')
  const [facing, setFacing] = useState<DeviceFacing>('front')
  const [hasLacingBar, setHasLacingBar] = useState(false)
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<PanelLayoutRow[]>([])
  const [ports, setPorts] = useState<PanelLayoutPort[]>([])
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null)
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const hydratedDraft = useRef(false)
  const prevPanelIdRef = useRef<string | null>(null)

  const draftStorageKey = `${DRAFT_STORAGE_PREFIX}:${projectId ?? 'none'}:${panelLayoutId ?? 'none'}`

  useEffect(() => {
    if (!panel) return
    // Reset hydration flag when switching to a different panel
    if (prevPanelIdRef.current !== null && prevPanelIdRef.current !== panel.id) {
      hydratedDraft.current = false
      setDirty(false)
    }
    prevPanelIdRef.current = panel.id
    if (!hydratedDraft.current) {
      const draftRaw = localStorage.getItem(draftStorageKey)
      if (draftRaw) {
        try {
          const draft = JSON.parse(draftRaw) as DraftState
          setName(draft.name)
          setFacing(draft.facing)
          setHasLacingBar(draft.hasLacingBar)
          setNotes(draft.notes)
          setRows(
            normalizeRowsToAutoGrid(
              panel.id,
              panel.height_ru,
              draft.rows.map((row, index) => ({
                id: `draft-row-${index}`,
                panel_layout_id: panel.id,
                row_index: row.row_index,
                hole_count: row.hole_count,
                active_column_map: row.active_column_map,
                created_at: panel.created_at,
                updated_at: panel.updated_at,
              })),
              panel.created_at,
              panel.updated_at,
            ),
          )
          setPorts(
            draft.ports.map((port) => ({
              id: port.id,
              panel_layout_id: panel.id,
              connector_id: port.connector_id,
              row_index: port.row_index,
              hole_index: port.hole_index,
              span_w: port.span_w,
              span_h: port.span_h,
              label: port.label ?? null,
              created_at: panel.created_at,
              updated_at: panel.updated_at,
            })),
          )
          setDirty(true)
          hydratedDraft.current = true
          return
        } catch {
          localStorage.removeItem(draftStorageKey)
        }
      }
      hydratedDraft.current = true
    }

    if (!dirty) {
      setName(panel.name)
      setFacing(panel.facing)
      setHasLacingBar(panel.has_lacing_bar)
      setNotes(panel.notes ?? '')
      setRows(
        normalizeRowsToAutoGrid(
          panel.id,
          panel.height_ru,
          [...(panel.rows ?? [])].sort((a, b) => a.row_index - b.row_index),
          panel.created_at,
          panel.updated_at,
        ),
      )
      setPorts([...(panel.ports ?? [])])
    }
  }, [dirty, draftStorageKey, panel])

  useEffect(() => {
    if (!panel || !dirty) return
    const timeoutId = window.setTimeout(() => {
      const draft: DraftState = {
        name,
        facing,
        hasLacingBar,
        notes,
        rows: rows.map((row) => ({
          row_index: row.row_index,
          hole_count: row.hole_count,
          active_column_map: row.active_column_map,
        })),
        ports: ports.map((port) => ({
          id: port.id,
          connector_id: port.connector_id,
          row_index: port.row_index,
          hole_index: port.hole_index,
          span_w: port.span_w,
          span_h: port.span_h,
          label: port.label,
        })),
      }
      localStorage.setItem(draftStorageKey, JSON.stringify(draft))
    }, 500)

    return () => window.clearTimeout(timeoutId)
  }, [dirty, draftStorageKey, facing, hasLacingBar, name, notes, panel, ports, rows])

  const selectedConnector = selectedConnectorId ? CONNECTOR_BY_ID.get(selectedConnectorId) ?? null : null
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

    const connector = CONNECTOR_BY_ID.get(transferId)
    if (!connector) return false
    if (!isMountingAllowed(connector.mounting, facing)) return false
    return rowHasCapacity(rowIndex, connector.grid_width, connector.grid_height, rows, ports)
  }

  /** Place a new connector on a row and auto-distribute. */
  const placeConnector = (rowIndex: number, forcedConnectorId?: string) => {
    if (!panel) return
    const connector = forcedConnectorId
      ? CONNECTOR_BY_ID.get(forcedConnectorId) ?? null
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

    const connector = CONNECTOR_BY_ID.get(existing.connector_id)
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
      const connector = CONNECTOR_BY_ID.get(port.connector_id)
      return connector && !isMountingAllowed(connector.mounting, facing)
    })
    if (invalidPorts.length > 0) {
      const names = invalidPorts
        .map((p) => CONNECTOR_BY_ID.get(p.connector_id)?.name ?? p.connector_id)
        .join(', ')
      setError(`Cannot save: the following connectors are not allowed on ${facing} panels: ${names}. Remove or change facing first.`)
      return
    }

    setSaving(true)
    setError(null)
    try {
      await updatePanelLayout(panel.id, {
        name: name.trim(),
        facing,
        has_lacing_bar: hasLacingBar,
        notes: notes.trim() || null,
      })
      await replaceRows(
        panel.id,
        rows.map((row) => ({
          row_index: row.row_index,
          hole_count: row.hole_count,
          active_column_map: row.active_column_map,
        })),
      )
      await replacePorts(
        panel.id,
        ports.map((port) => ({
          connector_id: port.connector_id,
          row_index: port.row_index,
          hole_index: port.hole_index,
          span_w: port.span_w,
          span_h: port.span_h,
          label: port.label ?? null,
        })),
      )
      localStorage.removeItem(draftStorageKey)
      setDirty(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save panel layout.')
    } finally {
      setSaving(false)
    }
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
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
        {/* Mobile header */}
        <header
          className="flex items-center justify-between px-4 bg-slate-900 border-b border-slate-800 shrink-0 z-30"
          style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}
        >
          <button
            onClick={() => navigate(`/editor/project/${projectId}/panels`)}
            className="text-slate-300 text-sm font-semibold"
          >
            ← Back
          </button>
          <div className="flex flex-col items-center min-w-0 px-2">
            <h1 className="text-sm font-bold truncate max-w-[180px]">{panel.name}</h1>
            <span className="text-[10px] text-slate-500">{panel.height_ru}U · {ports.length} connectors</span>
          </div>
          <button
            onClick={() => void handleSave()}
            disabled={!saveActive}
            className={`text-sm font-semibold ${saveActive ? 'text-amber-400' : 'text-slate-600'}`}
          >
            {saving ? '…' : dirty ? 'Save' : 'Saved'}
          </button>
        </header>

        {/* Error banner */}
        {error && (
          <div className="bg-red-950/60 border-b border-red-900/40 px-4 py-2 text-xs text-red-400 shrink-0">
            {error}
            <button className="ml-2 text-red-500" onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* Canvas area */}
        <main
          className="flex-1 overflow-auto p-4 flex flex-col items-center gap-3"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, #1e293b 0%, #0a0f1a 70%)' }}
        >
          {selectedConnectorId && (
            <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[10px] text-amber-300">
              <strong>{CONNECTOR_BY_ID.get(selectedConnectorId)?.name}</strong> — tap a row to place
              <button className="ml-1 text-amber-400/60" onClick={() => setSelectedConnectorId(null)}>✕</button>
            </div>
          )}
          <div className="w-full max-w-lg">
            <PanelLayoutCanvas
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
        </main>

        {/* Mobile footer */}
        <footer
          className="bg-slate-900 border-t border-slate-800 flex items-center justify-around shrink-0 z-30"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)', minHeight: 'calc(4rem + env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={() => setMobileSheet('connectors')}
            className={`flex flex-col items-center gap-1 ${selectedConnectorId ? 'text-amber-400' : 'text-slate-400'}`}
          >
            <span className="text-lg">▦</span>
            <span className="text-[10px] font-bold uppercase">Connectors</span>
          </button>
          <button
            onClick={() => setMobileSheet('properties')}
            className="flex flex-col items-center gap-1 text-slate-400"
          >
            <span className="text-lg">⚙</span>
            <span className="text-[10px] font-bold uppercase">Properties</span>
          </button>
        </footer>

        {/* Mobile sheet drawer */}
        {mobileSheet && (
          <div className="fixed inset-0 z-50 flex overflow-hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileSheet(null)} />
            <div className="relative ml-auto w-80 max-w-[85%] bg-slate-900 h-full shadow-2xl flex flex-col">
              <div
                className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0"
                style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
              >
                <h2 className="font-bold text-sm uppercase tracking-widest text-slate-400">
                  {mobileSheet === 'connectors' ? 'Connector Library' : 'Properties'}
                </h2>
                <button onClick={() => setMobileSheet(null)} className="p-2 text-slate-300">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {mobileSheet === 'connectors' && (
                  <div className="space-y-4">
                    {groupedConnectors().map((group) => (
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
                        <div className="space-y-1">
                          {group.items.map((connector) => {
                            const isSelected = selectedConnectorId === connector.id
                            const isAllowed = isMountingAllowed(connector.mounting, facing)
                            return (
                              <button
                                key={connector.id}
                                type="button"
                                onClick={() => {
                                  setSelectedConnectorId(connector.id)
                                  setMobileSheet(null)
                                }}
                                className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                                  isSelected
                                    ? 'border-amber-500/60 bg-amber-500/10 text-amber-100'
                                    : isAllowed
                                    ? 'border-slate-700/50 bg-slate-800/40 text-slate-300'
                                    : 'border-slate-800 bg-slate-900/30 text-slate-600'
                                }`}
                              >
                                <p className="text-xs font-medium leading-tight">{connector.name}</p>
                                <p className="mt-0.5 text-[10px] text-slate-500">
                                  {connector.grid_width}×{connector.grid_height} grid
                                  {!isAllowed ? <span className="text-red-500/70"> · not allowed</span> : null}
                                </p>
                              </button>
                            )
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                )}

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
                          <div key={row.id} className="rounded-lg border border-slate-800 bg-slate-800/30 p-2">
                            <p className="text-[10px] text-slate-400">
                              U{row.row_index + 1}: {capacity ? `${capacity.occupied_holes}/${capacity.hole_count} used` : `${row.hole_count} slots`}
                            </p>
                          </div>
                        )
                      })}
                    </div>

                    {/* Selected port */}
                    {selectedPort && (
                      <div className="border-t border-slate-800 pt-4 space-y-3">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-amber-500/80">Selected Connector</h3>
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-3">
                          <p className="text-xs font-medium text-slate-200">
                            {CONNECTOR_BY_ID.get(selectedPort.connector_id)?.name ?? 'Unknown'}
                          </p>
                          <DarkInput
                            label="Label override"
                            value={selectedPort.label ?? ''}
                            onChange={updateSelectedPortLabel}
                            placeholder={CONNECTOR_BY_ID.get(selectedPort.connector_id)?.name ?? 'Label'}
                          />
                          <button
                            type="button"
                            onClick={() => { removeSelectedPort(); setMobileSheet(null) }}
                            className="w-full rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-950/70 transition"
                          >
                            Remove Connector
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Print link */}
                    <button
                      onClick={() => navigate(`/editor/project/${projectId}/panels/${panel.id}/print`)}
                      className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300"
                    >
                      Print Layout
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
    // Full workspace: dark background, full-height layout
    <div className="flex h-full flex-col gap-0 bg-slate-950 text-slate-100 min-h-screen -m-4 md:-m-6">

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-4 border-b border-slate-800 bg-slate-950/90 px-5 py-3 backdrop-blur-sm sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(`/editor/project/${projectId}/panels`)}
            className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 12L6 8l4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Panels
          </button>
          <div className="h-5 w-px bg-slate-700" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-slate-100">{panel.name}</h1>
            <p className="text-[10px] text-slate-500">{panel.height_ru}U • {rows.length} rows • {ports.length} connectors</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {error && (
            <p className="text-xs text-red-400 max-w-xs truncate">{error}</p>
          )}
          <button
            onClick={() => navigate(`/editor/project/${projectId}/panels/${panel.id}/print`)}
            className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            Print
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={!saveActive}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold transition ${
              saveActive
                ? 'bg-amber-500 text-slate-900 hover:bg-amber-400 shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
            }`}
          >
            {saveLabel}
          </button>
        </div>
      </header>

      {/* ── Three-column workspace ─────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left panel: Connector Library */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900/80">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Connector Library</h2>
            <p className="mt-0.5 text-[10px] text-slate-600">Click to select, or drag onto a row</p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
            {groupedConnectors().map((group) => (
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
        <main className="flex flex-1 flex-col items-center justify-start overflow-auto p-6 gap-4"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, #1e293b 0%, #0a0f1a 70%)' }}>

          {selectedConnectorId && (
            <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-300">
              <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="8" r="7" />
              </svg>
              <strong>{CONNECTOR_BY_ID.get(selectedConnectorId)?.name}</strong> selected — click a row or drag to place
              <button
                className="ml-2 text-amber-400/60 hover:text-amber-300 transition"
                onClick={() => setSelectedConnectorId(null)}
              >
                ✕
              </button>
            </div>
          )}

          <div className="w-full max-w-6xl">
            <PanelLayoutCanvas
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

          <p className="text-[10px] text-slate-600 max-w-lg text-center">
            Drop connectors onto a row and spacing adjusts automatically. Drag placed connectors between rows to reorder.
          </p>
        </main>

        {/* Right panel: Properties */}
        <aside className="flex w-72 shrink-0 flex-col border-l border-slate-800 bg-slate-900/80 overflow-y-auto">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Panel Properties</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
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

            {/* Auto grid status */}
            <div className="border-t border-slate-800 pt-4 space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Auto Spacing</h3>
              <p className="text-[10px] text-slate-500">
                Connectors are automatically spaced evenly within each row. Drop connectors onto a row to place them.
              </p>
              {rows.map((row) => (
                <div key={row.id} className="rounded-lg border border-slate-800 bg-slate-800/30 p-3">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">U{row.row_index + 1}</p>
                  <p className="mt-2 text-[10px] text-slate-500">
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
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-amber-500/80">Selected Connector</h3>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-3">
                  <p className="text-xs font-medium text-slate-200">
                    {CONNECTOR_BY_ID.get(selectedPort.connector_id)?.name ?? 'Unknown'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {selectedPort.span_w}×{selectedPort.span_h} grid · row {selectedPort.row_index + 1}
                  </p>
                  <DarkInput
                    label="Label override"
                    value={selectedPort.label ?? ''}
                    onChange={updateSelectedPortLabel}
                    placeholder={CONNECTOR_BY_ID.get(selectedPort.connector_id)?.name ?? 'Label'}
                  />
                  <button
                    type="button"
                    onClick={removeSelectedPort}
                    className="w-full rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-950/70 hover:text-red-300 transition"
                  >
                    Remove Connector
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-t border-slate-800 pt-4">
                <p className="text-[10px] text-slate-600">Click a placed connector to edit its label or remove it.</p>
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
  const [isMobile, setIsMobile] = useState<boolean>(() => window.innerWidth < 768)
  const [isTouchLikeDevice, setIsTouchLikeDevice] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    const coarsePointerQuery = window.matchMedia('(pointer: coarse)')
    const updateTouchLike = () => {
      setIsTouchLikeDevice(coarsePointerQuery.matches || 'ontouchstart' in window)
    }
    updateTouchLike()
    coarsePointerQuery.addEventListener('change', updateTouchLike)
    return () => coarsePointerQuery.removeEventListener('change', updateTouchLike)
  }, [])

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
      <PanelLayoutEditorInner isMobile={isMobile} />
    </DndProvider>
  )
}
