import type { ConnectorDefinition, DeviceFacing, PanelLayoutPort, PanelLayoutRow } from '../../types'
import type { PanelRowCapacity } from '../../lib/panelGrid'
import { DarkInput, DarkLabel, DarkSelect } from '../ui/DarkForm'

interface PanelPropertiesSidebarProps {
  name: string
  setName: (v: string) => void
  facing: DeviceFacing
  setFacing: (v: DeviceFacing) => void
  hasLacingBar: boolean
  setHasLacingBar: (v: boolean) => void
  notes: string
  setNotes: (v: string) => void
  setDirty: (v: boolean) => void
  rows: PanelLayoutRow[]
  rowCapacityByIndex: Map<number, PanelRowCapacity>
  selectedPort: PanelLayoutPort | null
  connectorById: Map<string, ConnectorDefinition>
  updateSelectedPortLabel: (label: string) => void
  removeSelectedPort: () => void
}

export default function PanelPropertiesSidebar({
  name, setName,
  facing, setFacing,
  hasLacingBar, setHasLacingBar,
  notes, setNotes,
  setDirty,
  rows, rowCapacityByIndex,
  selectedPort, connectorById,
  updateSelectedPortLabel, removeSelectedPort,
}: PanelPropertiesSidebarProps) {
  return (
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
  )
}
