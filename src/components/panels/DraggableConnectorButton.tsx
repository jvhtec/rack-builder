import type { LegacyRef } from 'react'
import { useDrag } from 'react-dnd'
import type { ConnectorDefinition } from '../../types'
import { CONNECTOR_ITEM_TYPE, type ConnectorDragItem } from './panelDndTypes'

export default function DraggableConnectorButton({
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
