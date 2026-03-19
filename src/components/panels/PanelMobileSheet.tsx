import type { ConnectorDefinition, DeviceFacing, PanelLayoutPort, PanelLayoutRow } from '../../types'
import type { PanelRowCapacity } from '../../lib/panelGrid'
import { isMountingAllowed } from '../../lib/panelGrid'
import { DarkInput, DarkLabel, DarkSelect } from '../ui/DarkForm'

const CATEGORY_DOT: Record<string, string> = {
  audio: '#f59e0b',
  data: '#06b6d4',
  power: '#3b82f6',
  multipin: '#a78bfa',
  other: '#6b7280',
}

interface PanelMobileSheetProps {
  mobileSheet: 'connectors' | 'properties' | 'port-edit'
  onClose: () => void
  // Connector library
  grouped: { category: string; items: ConnectorDefinition[] }[]
  connectorById: Map<string, ConnectorDefinition>
  selectedConnectorId: string | null
  setSelectedConnectorId: (id: string | null) => void
  setSelectedPortId: (id: string | null) => void
  facing: DeviceFacing
  // Port edit
  selectedPort: PanelLayoutPort | null
  updateSelectedPortLabel: (label: string) => void
  removeSelectedPort: () => void
  // Properties
  name: string
  setName: (v: string) => void
  setFacing: (v: DeviceFacing) => void
  hasLacingBar: boolean
  setHasLacingBar: (v: boolean) => void
  notes: string
  setNotes: (v: string) => void
  setDirty: (v: boolean) => void
  rows: PanelLayoutRow[]
  rowCapacityByIndex: Map<number, PanelRowCapacity>
  // Navigation
  onExportPdf: () => void
}

export default function PanelMobileSheet({
  mobileSheet, onClose,
  grouped, connectorById, selectedConnectorId, setSelectedConnectorId, setSelectedPortId, facing,
  selectedPort, updateSelectedPortLabel, removeSelectedPort,
  name, setName, setFacing, hasLacingBar, setHasLacingBar, notes, setNotes, setDirty,
  rows, rowCapacityByIndex,
  onExportPdf,
}: PanelMobileSheetProps) {
  const selectedPortConnector = selectedPort
    ? connectorById.get(selectedPort.connector_id) ?? null
    : null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end overflow-hidden">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
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
          <button onClick={onClose} className="p-2 text-slate-300 -mr-2">✕</button>
        </div>

        {/* Sheet content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {/* Connector Library */}
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
                            onClose()
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

          {/* Port Edit */}
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
                onClick={() => { removeSelectedPort(); onClose() }}
                className="w-full rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2.5 text-xs font-semibold text-red-400 min-h-11"
              >
                Remove Connector
              </button>
            </div>
          )}

          {/* Properties */}
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
                onClick={onExportPdf}
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs text-slate-300 min-h-11"
              >
                Export PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
