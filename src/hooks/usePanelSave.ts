import { useState } from 'react'
import type { ConnectorDefinition, DeviceFacing, PanelLayout, PanelLayoutPort, PanelLayoutRow } from '../types'
import { isMountingAllowed } from '../lib/panelGrid'

export function usePanelSave(params: {
  panel: PanelLayout | null
  connectorById: Map<string, ConnectorDefinition>
  name: string
  facing: DeviceFacing
  hasLacingBar: boolean
  notes: string
  rows: PanelLayoutRow[]
  ports: PanelLayoutPort[]
  savePanelLayout: (
    id: string,
    meta: { name: string; facing: DeviceFacing; has_lacing_bar: boolean; notes: string | null },
    rows: Array<Pick<PanelLayoutRow, 'row_index' | 'hole_count' | 'active_column_map'>>,
    ports: Array<Pick<PanelLayoutPort, 'connector_id' | 'row_index' | 'hole_index' | 'span_w' | 'span_h' | 'label'>>,
  ) => Promise<void>
  clearDraft: () => void
  setDirty: (v: boolean) => void
  setError: (error: string | null) => void
}) {
  const {
    panel, connectorById, name, facing, hasLacingBar, notes, rows, ports,
    savePanelLayout, clearDraft, setDirty, setError,
  } = params

  const [saving, setSaving] = useState(false)

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

  return { saving, handleSave }
}
