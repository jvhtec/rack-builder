import { useMemo, useState, type DragEvent } from 'react'
import { CONNECTOR_BY_ID } from '../../lib/connectorCatalog'
import { buildRowCellGeometry, getActiveColumns, getPunchedAreaRatio } from '../../lib/panelGrid'
import type { DeviceFacing, PanelLayoutPort, PanelLayoutRow } from '../../types'

interface PanelLayoutCanvasProps {
  heightRu: number
  rows: PanelLayoutRow[]
  ports: PanelLayoutPort[]
  facing: DeviceFacing
  hasLacingBar?: boolean
  selectedPortId?: string | null
  onHoleClick?: (rowIndex: number, holeIndex: number) => void
  onHoleDrop?: (rowIndex: number, holeIndex: number, transferId: string, isPortMove: boolean) => void
  canPlaceAtCell?: (rowIndex: number, holeIndex: number, transferId: string, isPortMove: boolean) => boolean | { ok: boolean; reason?: string }
  onPortClick?: (portId: string) => void
  showGuides?: boolean
  interactive?: boolean
  showScaleMarker?: boolean
  className?: string
}

const PANEL_EAR_WIDTH_PCT = 6.5
const INNER_WIDTH_PCT = 100 - PANEL_EAR_WIDTH_PCT * 2

function resolveImageUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('data:') || path.startsWith('http://') || path.startsWith('https://')) return path
  const base = import.meta.env.BASE_URL || '/'
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  return `${base}${normalizedPath}`
}

function occupancyKey(rowIndex: number, holeIndex: number): string {
  return `${rowIndex}:${holeIndex}`
}

export default function PanelLayoutCanvas({
  heightRu,
  rows,
  ports,
  facing,
  hasLacingBar = false,
  selectedPortId = null,
  onHoleClick,
  onHoleDrop,
  canPlaceAtCell,
  onPortClick,
  showGuides = true,
  interactive = true,
  showScaleMarker = true,
  className = '',
}: PanelLayoutCanvasProps) {
  const safeHeightRu = Math.max(1, heightRu)
  const rowHeightPct = 100 / safeHeightRu
  const idStripRatio = 0.23
  const connectorTopOffsetPct = 1.2
  const connectorBottomOffsetPct = 1.8
  const orderedRows = [...rows].sort((a, b) => a.row_index - b.row_index)
  const rowByIndex = useMemo(() => new Map(orderedRows.map((row) => [row.row_index, row])), [orderedRows])

  const rowCellMap = useMemo(() => {
    const map = new Map<number, ReturnType<typeof buildRowCellGeometry>>()
    for (let rowIndex = 0; rowIndex < safeHeightRu; rowIndex += 1) {
      const row = rowByIndex.get(rowIndex)
      const holeCount = row?.hole_count ?? 16
      const activeColumns = row?.active_column_map.length
        ? row.active_column_map
        : getActiveColumns(holeCount)
      map.set(rowIndex, buildRowCellGeometry(holeCount, activeColumns, facing))
    }
    return map
  }, [facing, rowByIndex, safeHeightRu])

  const occupiedCells = useMemo(() => {
    const map = new Map<string, PanelLayoutPort>()
    for (const port of ports) {
      for (let rowIndex = port.row_index; rowIndex < port.row_index + port.span_h; rowIndex += 1) {
        const row = rowByIndex.get(rowIndex)
        if (!row) continue
        const holeEnd = Math.min(row.hole_count, port.hole_index + port.span_w)
        for (let holeIndex = port.hole_index; holeIndex < holeEnd; holeIndex += 1) {
          map.set(occupancyKey(rowIndex, holeIndex), port)
        }
      }
    }
    return map
  }, [ports, rowByIndex])

  const [dragOverCell, setDragOverCell] = useState<{
    rowIndex: number
    holeIndex: number
    valid: boolean
    reason?: string
  } | null>(null)

  const resolveDragTransfer = (event: DragEvent): { transferId: string; isPortMove: boolean } | null => {
    const portId = event.dataTransfer.getData('application/x-port-id')
    if (portId) return { transferId: portId, isPortMove: true }
    const connectorId = event.dataTransfer.getData('application/x-connector-id')
    if (connectorId) return { transferId: connectorId, isPortMove: false }
    return null
  }

  const validateCellTarget = (
    rowIndex: number,
    holeIndex: number,
    transferId: string,
    isPortMove: boolean,
  ): { ok: boolean; reason?: string } => {
    const validation = canPlaceAtCell?.(rowIndex, holeIndex, transferId, isPortMove)
    if (typeof validation === 'boolean') return { ok: validation }
    if (validation) return { ok: validation.ok, reason: validation.reason }
    return { ok: true }
  }

  const handleCellDrop = (
    event: DragEvent,
    rowIndex: number,
    holeIndex: number,
  ) => {
    if (!interactive || !onHoleDrop) return
    event.preventDefault()
    const transfer = resolveDragTransfer(event)
    if (!transfer) return
    const validation = validateCellTarget(rowIndex, holeIndex, transfer.transferId, transfer.isPortMove)
    if (!validation.ok) {
      setDragOverCell({ rowIndex, holeIndex, valid: false, reason: validation.reason })
      return
    }
    onHoleDrop(rowIndex, holeIndex, transfer.transferId, transfer.isPortMove)
    setDragOverCell(null)
  }

  return (
    <div className={`rounded-xl border border-slate-700 bg-slate-900/40 p-3 shadow-2xl ${className}`.trim()}>
      {showScaleMarker && (
        <div className="mb-3 flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.2em] text-slate-500">
          <span className="h-px w-14 bg-slate-700" />
          19 in
          <span className="h-px w-14 bg-slate-700" />
        </div>
      )}

      <div className="relative mx-auto w-full" style={{ aspectRatio: `${19 / (1.75 * safeHeightRu)}` }}>
        <div className="absolute inset-y-0 left-0 z-10" style={{ width: `${PANEL_EAR_WIDTH_PCT}%` }}>
          <div className="absolute inset-0 rounded-l-lg border-y border-l border-slate-700 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-800" />
          {Array.from({ length: safeHeightRu }).map((_, r) => (
            <div key={`left-slots-${r}`} className="absolute inset-x-0" style={{ top: `${r * rowHeightPct}%`, height: `${rowHeightPct}%` }}>
              <div className="absolute left-[25%] top-[12%] h-[15%] w-[50%] rounded-full border border-black bg-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)]" />
              <div className="absolute left-[25%] bottom-[12%] h-[15%] w-[50%] rounded-full border border-black bg-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)]" />
            </div>
          ))}
        </div>

        <div className="absolute inset-y-0 right-0 z-10" style={{ width: `${PANEL_EAR_WIDTH_PCT}%` }}>
          <div className="absolute inset-0 rounded-r-lg border-y border-r border-slate-700 bg-gradient-to-l from-slate-900 via-slate-800 to-slate-800" />
          {Array.from({ length: safeHeightRu }).map((_, r) => (
            <div key={`right-slots-${r}`} className="absolute inset-x-0" style={{ top: `${r * rowHeightPct}%`, height: `${rowHeightPct}%` }}>
              <div className="absolute right-[25%] top-[12%] h-[15%] w-[50%] rounded-full border border-black bg-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)]" />
              <div className="absolute right-[25%] bottom-[12%] h-[15%] w-[50%] rounded-full border border-black bg-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)]" />
            </div>
          ))}
        </div>

        <div
          className="absolute inset-y-0 overflow-hidden border-y border-slate-700 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950"
          style={{
            left: `${PANEL_EAR_WIDTH_PCT}%`,
            width: `${INNER_WIDTH_PCT}%`,
          }}
        >
          {Array.from({ length: safeHeightRu }).map((_, rowIndex) => {
            const row = rowByIndex.get(rowIndex)
            const cells = rowCellMap.get(rowIndex) ?? []
            const rowTopPct = rowIndex * rowHeightPct
            const idStripHeightPct = rowHeightPct * idStripRatio
            const connectorFieldHeightPct = rowHeightPct - idStripHeightPct
            const punchedAreaRatio = getPunchedAreaRatio(row?.hole_count ?? 16)
            const punchedLeftPct = ((1 - punchedAreaRatio) / 2) * 100

            return (
              <div
                key={`row-${rowIndex}`}
                className="absolute inset-x-0"
                style={{
                  top: `${rowTopPct}%`,
                  height: `${rowHeightPct}%`,
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <div
                  className="absolute inset-x-0 top-0 flex items-center px-2"
                  style={{
                    height: `${idStripHeightPct}%`,
                    background: 'linear-gradient(to bottom, rgba(255,255,255,0.04) 0%, transparent 100%)',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <span className="text-[7px] font-mono tracking-[0.2em] uppercase text-white/25">
                    U{rowIndex + 1}
                  </span>
                  {row ? (
                    <span className="ml-2 text-[7px] font-mono text-white/20">{row.hole_count} holes</span>
                  ) : null}
                </div>

                <div
                  className="pointer-events-none absolute bottom-0 top-[23%] border border-dashed border-white/10 bg-white/[0.015]"
                  style={{
                    left: `${punchedLeftPct}%`,
                    width: `${punchedAreaRatio * 100}%`,
                  }}
                />

                {showGuides && Array.from({ length: 16 }).map((_, col) => (
                  <span
                    key={`guide-${rowIndex}-${col}`}
                    className="absolute inset-y-0 border-r"
                    style={{
                      left: `${(col / 16) * 100}%`,
                      borderColor: 'rgba(255,255,255,0.03)',
                    }}
                  />
                ))}

                {cells.map((cell) => {
                  const isDropTarget =
                    dragOverCell?.rowIndex === rowIndex && dragOverCell?.holeIndex === cell.holeIndex
                  const occupiedBy = occupiedCells.get(occupancyKey(rowIndex, cell.holeIndex)) ?? null
                  const occupiedByOther = !!occupiedBy && occupiedBy.id !== selectedPortId
                  const occupiedBySelected = !!occupiedBy && occupiedBy.id === selectedPortId
                  const invalidDrop = isDropTarget && dragOverCell && !dragOverCell.valid
                  const validDrop = isDropTarget && dragOverCell && dragOverCell.valid
                  return (
                    <button
                      key={`cell-${rowIndex}-${cell.holeIndex}`}
                      type="button"
                      onClick={() => {
                        if (!interactive || !onHoleClick) return
                        onHoleClick(rowIndex, cell.holeIndex)
                      }}
                      onDragOver={(event) => {
                        if (!interactive || !onHoleDrop) return
                        event.preventDefault()
                        event.stopPropagation()
                        const transfer = resolveDragTransfer(event)
                        if (!transfer) return
                        const validation = validateCellTarget(
                          rowIndex,
                          cell.holeIndex,
                          transfer.transferId,
                          transfer.isPortMove,
                        )
                        setDragOverCell({
                          rowIndex,
                          holeIndex: cell.holeIndex,
                          valid: validation.ok,
                          reason: validation.reason,
                        })
                      }}
                      onDragLeave={(event) => {
                        if ((event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)) return
                        setDragOverCell(null)
                      }}
                      onDrop={(event) => handleCellDrop(event, rowIndex, cell.holeIndex)}
                      className={`absolute rounded-sm border transition ${
                        interactive ? 'cursor-pointer' : 'cursor-default'
                      }`}
                      style={{
                        left: `${cell.leftPct}%`,
                        width: `${cell.widthPct}%`,
                        top: `${idStripHeightPct}%`,
                        height: `${connectorFieldHeightPct}%`,
                        borderColor: validDrop
                          ? 'rgba(34,197,94,0.8)'
                          : invalidDrop
                          ? 'rgba(248,113,113,0.85)'
                          : occupiedBySelected
                          ? 'rgba(245,158,11,0.7)'
                          : occupiedByOther
                          ? 'rgba(148,163,184,0.45)'
                          : 'rgba(255,255,255,0.08)',
                        background: validDrop
                          ? 'linear-gradient(to bottom, rgba(34,197,94,0.22), rgba(21,128,61,0.12))'
                          : invalidDrop
                          ? 'linear-gradient(to bottom, rgba(248,113,113,0.22), rgba(127,29,29,0.12))'
                          : occupiedByOther
                          ? 'linear-gradient(to bottom, rgba(100,116,139,0.24), rgba(30,41,59,0.2))'
                          : occupiedBySelected
                          ? 'linear-gradient(to bottom, rgba(245,158,11,0.26), rgba(180,83,9,0.18))'
                          : 'linear-gradient(to bottom, rgba(30,41,59,0.24), rgba(2,6,23,0.2))',
                        boxShadow: validDrop
                          ? 'inset 0 0 0 1px rgba(74,222,128,0.4)'
                          : invalidDrop
                          ? 'inset 0 0 0 1px rgba(248,113,113,0.5)'
                          : 'none',
                      }}
                      title={
                        invalidDrop && dragOverCell?.reason
                          ? dragOverCell.reason
                          : `Row ${rowIndex + 1}, cell ${cell.holeIndex + 1}`
                      }
                    >
                      <span className="absolute left-1 top-1 text-[8px] font-mono text-white/25">
                        {cell.holeIndex + 1}
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })}

          {hasLacingBar && (
            <div
              className="absolute inset-x-0 border-y border-slate-500 bg-slate-700/50"
              style={{
                top: `${Math.max(5, 100 - rowHeightPct * 0.35)}%`,
                height: '4px',
              }}
            />
          )}

          {ports.map((port) => {
            const rowCells = rowCellMap.get(port.row_index) ?? []
            const startCell = rowCells.find((cell) => cell.holeIndex === port.hole_index)
            const endCell = rowCells.find((cell) => cell.holeIndex === (port.hole_index + port.span_w - 1))
            if (!startCell || !endCell) return null

            const leftPct = Math.min(startCell.leftPct, endCell.leftPct)
            const rightPct = Math.max(startCell.leftPct + startCell.widthPct, endCell.leftPct + endCell.widthPct)
            const widthPct = rightPct - leftPct
            const yPct = port.row_index * rowHeightPct + rowHeightPct * idStripRatio + connectorTopOffsetPct
            const heightPct = port.span_h * rowHeightPct - rowHeightPct * idStripRatio - connectorBottomOffsetPct

            const connector = CONNECTOR_BY_ID.get(port.connector_id)
            const label = port.label?.trim() || connector?.name || 'Connector'
            const iconUrl = resolveImageUrl(connector?.image_path)
            const active = selectedPortId === port.id

            return (
              <button
                key={port.id}
                type="button"
                draggable={interactive}
                onDragStart={(event) => {
                  if (!interactive) return
                  event.dataTransfer.setData('application/x-port-id', port.id)
                  event.dataTransfer.effectAllowed = 'move'
                  onPortClick?.(port.id)
                }}
                onClick={() => {
                  if (!interactive) return
                  onPortClick?.(port.id)
                }}
                className={`absolute z-20 overflow-hidden rounded-md border transition-all ${
                  interactive ? 'cursor-grab active:cursor-grabbing hover:brightness-110' : 'cursor-default'
                }`}
                style={{
                  left: `${leftPct}%`,
                  top: `${yPct}%`,
                  width: `${widthPct}%`,
                  height: `${Math.max(6, heightPct)}%`,
                  borderColor: active ? '#fbbf24' : 'rgba(226,232,240,0.7)',
                  boxShadow: active
                    ? '0 0 0 2px rgba(251,191,36,0.45), 0 8px 14px rgba(0,0,0,0.55)'
                    : '0 6px 12px rgba(0,0,0,0.55)',
                  background: 'linear-gradient(to bottom, rgba(15,23,42,0.92), rgba(2,6,23,0.96))',
                }}
                title={`${label} — drag to move`}
              >
                {iconUrl ? (
                  <img
                    src={iconUrl}
                    alt={label}
                    className="absolute inset-0 h-full w-full object-contain p-1"
                    draggable={false}
                  />
                ) : null}
                <div className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5">
                  <span className="block truncate text-[9px] font-semibold text-slate-100">{label}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
