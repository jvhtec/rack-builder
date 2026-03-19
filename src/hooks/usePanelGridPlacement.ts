import { useMemo } from 'react'
import type { ConnectorDefinition, DeviceFacing, PanelLayout, PanelLayoutPort, PanelLayoutRow } from '../types'
import {
  autoDistributeAllRows,
  isMountingAllowed,
  rowHasCapacity,
  summarizeRowCapacities,
} from '../lib/panelGrid'

export function usePanelGridPlacement(params: {
  panel: PanelLayout | null
  rows: PanelLayoutRow[]
  ports: PanelLayoutPort[]
  setPorts: (updater: (current: PanelLayoutPort[]) => PanelLayoutPort[]) => void
  facing: DeviceFacing
  connectorById: Map<string, ConnectorDefinition>
  selectedConnectorId: string | null
  setSelectedConnectorId: (id: string | null) => void
  selectedPortId: string | null
  setSelectedPortId: (id: string | null) => void
  setError: (error: string | null) => void
  setDirty: (dirty: boolean) => void
}) {
  const {
    panel, rows, ports, setPorts, facing, connectorById,
    selectedConnectorId, setSelectedConnectorId,
    selectedPortId, setSelectedPortId, setError, setDirty,
  } = params

  const selectedConnector = selectedConnectorId ? connectorById.get(selectedConnectorId) ?? null : null
  const selectedPort = selectedPortId ? ports.find((port) => port.id === selectedPortId) ?? null : null
  const rowCapacities = useMemo(() => summarizeRowCapacities(rows, ports), [rows, ports])
  const rowCapacityByIndex = useMemo(
    () => new Map(rowCapacities.map((entry) => [entry.row_index, entry])),
    [rowCapacities],
  )

  const canDropInRow = (
    rowIndex: number,
    transferId: string,
    isPortMove: boolean,
  ): boolean => {
    if (!panel) return false

    if (isPortMove) {
      const movingPort = ports.find((port) => port.id === transferId)
      if (!movingPort) return false
      if (movingPort.row_index === rowIndex) return true
      return rowHasCapacity(rowIndex, movingPort.span_w, movingPort.span_h, rows, ports, movingPort.id)
    }

    const connector = connectorById.get(transferId)
    if (!connector) return false
    if (!isMountingAllowed(connector.mounting, facing)) return false
    return rowHasCapacity(rowIndex, connector.grid_width, connector.grid_height, rows, ports)
  }

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
      hole_index: 0,
      span_w: connector.grid_width,
      span_h: connector.grid_height,
      label: null,
      created_at: panel.created_at,
      updated_at: panel.updated_at,
    }

    const newPorts = [...ports, newPort]
    const distributed = autoDistributeAllRows(newPorts, rows)
    setPorts(() => distributed)
    setSelectedPortId(newPort.id)
    setError(null)
    setDirty(true)
  }

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
      return
    }

    if (!rowHasCapacity(rowIndex, existing.span_w, existing.span_h, rows, ports, existing.id)) {
      setError('No free space available at this row for the selected connector footprint.')
      return
    }

    const moved: PanelLayoutPort = { ...existing, row_index: rowIndex }
    const newPorts = ports.map((p) => (p.id === portId ? moved : p))
    const distributed = autoDistributeAllRows(newPorts, rows)
    setPorts(() => distributed)
    setSelectedPortId(portId)
    setError(null)
    setDirty(true)
  }

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
    setPorts(() => distributed)
    setSelectedPortId(null)
    setDirty(true)
  }

  return {
    selectedConnector,
    selectedPort,
    rowCapacities,
    rowCapacityByIndex,
    canDropInRow,
    placeConnector,
    movePort,
    handleRowDrop,
    updateSelectedPortLabel,
    removeSelectedPort,
  }
}
