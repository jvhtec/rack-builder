import type { DeviceFacing, LayoutItemWithDevice, Rack, RackWidth } from '../../types'
import { getDeviceImageUrl } from '../../hooks/useDevices'
import { getItemSlot, getSlotStyle } from '../../lib/rackPositions'
import { selectFacingImagePath } from '../../lib/rackViewModel'
import AutoScaleText from '../shared/AutoScaleText'

function getTopU(item: LayoutItemWithDevice): number {
  return item.start_u + item.device.rack_units - 1
}

function computeMobileColumnRange(
  leftCssPct: string,
  widthCssPct: string,
  rackWidth: RackWidth,
): { startCol: number; endCol: number; spanCols: number } {
  const leftPct = parseFloat(leftCssPct)
  const widthPct = parseFloat(widthCssPct)
  const totalColumns = rackWidth === 'dual' ? 4 : 2
  const colWidth = 100 / totalColumns
  const startCol = Math.round(leftPct / colWidth)
  const spanCols = Math.round(widthPct / colWidth)
  const endCol = startCol + spanCols - 1
  return { startCol, endCol, spanCols }
}

function resolvePlacementImageUrl(item: LayoutItemWithDevice, facing: DeviceFacing): string | null {
  return getDeviceImageUrl(selectFacingImagePath(item, facing))
}

interface MobileRackGridProps {
  rack: Rack
  slots: number[]
  facing: DeviceFacing
  mobileColumnCount: number
  mobileLaneOffset: number
  showDeviceNames: boolean
  simplifiedView: boolean
  selectedDeviceTemplate: string | null
  selectedItemToMove: string | null
  getDeviceAtU: (slotU: number, visualSlotIndex: number) => { item: LayoutItemWithDevice; isGhost: boolean } | undefined
  mobileSlotAssignments: Map<string, ReturnType<typeof getItemSlot>>
  mobileGhostSlotAssignments: Map<string, ReturnType<typeof getItemSlot>>
  onSlotClick: (slotU: number, visualColIndex: number) => void
  onMoveToSlot: (slotU: number, visualColIndex: number) => void
  onItemSelect: (itemId: string | null) => void
  onDeselectTemplate: () => void
  haptic: (type: string) => void
}

export default function MobileRackGrid({
  rack,
  slots,
  facing,
  mobileColumnCount,
  mobileLaneOffset,
  showDeviceNames,
  simplifiedView,
  selectedDeviceTemplate,
  selectedItemToMove,
  getDeviceAtU,
  mobileSlotAssignments,
  mobileGhostSlotAssignments,
  onSlotClick,
  onMoveToSlot,
  onItemSelect,
  onDeselectTemplate,
  haptic,
}: MobileRackGridProps) {
  return (
    <div className="relative w-full max-w-[360px]">
      <div className="bg-slate-900 rounded-t-xl border-x-[10px] border-t-[10px] border-slate-800 shadow-2xl">
        {slots.map((u) => (
          <div
            key={u}
            className="h-10 border-b border-slate-800/70 relative flex items-center transition-colors"
          >
            <div className="w-8 text-[10px] font-mono text-slate-500 flex items-center justify-center border-r border-slate-800 bg-slate-900/50 h-full">
              {u}
            </div>

            <div className="flex-1 h-full relative">
              {Array.from({ length: mobileColumnCount }, (_, colIndex) => {
                const visualColIndex = mobileLaneOffset + colIndex
                const cellEntry = getDeviceAtU(u, visualColIndex)
                const item = cellEntry?.item
                const isGhost = cellEntry?.isGhost ?? false
                const topU = item ? getTopU(item) : null
                const isTop = item && topU === u

                const itemSlot = item && rack
                  ? (
                    isGhost
                      ? (mobileGhostSlotAssignments.get(item.id) ?? getItemSlot(item, rack.width))
                      : (mobileSlotAssignments.get(item.id) ?? getItemSlot(item, rack.width))
                  )
                  : null
                const colWidthPct = 100 / mobileColumnCount
                const { startCol, spanCols } = itemSlot && rack
                  ? (() => {
                    const { left, width } = getSlotStyle(itemSlot, rack.width, facing)
                    return computeMobileColumnRange(left, width, rack.width)
                  })()
                  : { startCol: visualColIndex, spanCols: 1 }
                const isLeadCol = visualColIndex === startCol
                const visibleSpanCols = Math.max(0, Math.min(spanCols, mobileColumnCount - colIndex))

                const isSelectableEmpty = (!item || isGhost) && (!!selectedDeviceTemplate || !!selectedItemToMove)
                const colBaseClass = isSelectableEmpty ? 'bg-indigo-500/15 active:bg-indigo-500/30' : ''
                const colLeft = `${colIndex * colWidthPct}%`
                const colWidth = `${colWidthPct}%`

                const handleColClick = isSelectableEmpty
                  ? () => void (selectedItemToMove ? onMoveToSlot(u, visualColIndex) : onSlotClick(u, visualColIndex))
                  : item && !isGhost
                    ? () => {
                        haptic('nudge')
                        if (selectedItemToMove === item.id) {
                          onItemSelect(null)
                        } else {
                          onItemSelect(item.id)
                          onDeselectTemplate()
                        }
                      }
                    : undefined

                return (
                  <div
                    key={`${u}-${colIndex}`}
                    className={`absolute top-0 h-full border-r border-slate-800/60 ${colBaseClass}`}
                    style={{ left: colLeft, width: colWidth }}
                    onClick={handleColClick}
                  >
                    {isTop && item && isLeadCol && visibleSpanCols > 0 && (
                      <div
                        className="absolute z-10 p-1"
                        style={{
                          height: `${item.device.rack_units * 40 - 1}px`,
                          top: '0px',
                          left: 0,
                          width: `${visibleSpanCols * 100}%`,
                        }}
                      >
                        <div
                          className={`relative w-full h-full rounded overflow-hidden bg-slate-700 border-2 transition-colors ${isGhost ? 'border-slate-400/50 opacity-55 saturate-75' : selectedItemToMove === item.id ? 'border-amber-400 opacity-70' : 'border-indigo-300/70'}`}
                          style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
                          onContextMenu={(e) => e.preventDefault()}
                        >
                          {simplifiedView ? (
                            <div className="absolute inset-1 pointer-events-none">
                              <span className="absolute top-0 left-0 max-w-[40%] z-[1] text-[8px] font-bold uppercase text-white truncate">{item.device.brand}</span>
                              <span className="absolute bottom-0 left-0 max-w-[40%] z-[1] text-[8px] text-slate-400 truncate">{item.device.model}</span>
                              {item.notes && (
                                <AutoScaleText
                                  text={item.notes}
                                  className="absolute inset-0 flex items-center justify-center text-center text-slate-300 whitespace-pre-line overflow-hidden break-words"
                                  minFontPx={4}
                                />
                              )}
                              <span className="absolute bottom-0 right-0 max-w-[50%] z-[1] text-[8px] font-semibold text-blue-300 truncate">{item.custom_name?.trim() || ''}</span>
                            </div>
                          ) : (
                            <>
                              {(() => {
                                const imageUrl = resolvePlacementImageUrl(item, facing)
                                return imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={item.custom_name?.trim() || `${item.device.brand} ${item.device.model}`}
                                    className="w-full h-full object-fill"
                                    draggable={false}
                                    onContextMenu={(e) => e.preventDefault()}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-indigo-500/80" />
                                )
                              })()}

                              {showDeviceNames && (
                                <div className="absolute inset-0 bg-black/35 p-2 flex flex-col justify-end pointer-events-none">
                                  <p className="text-[9px] uppercase font-black text-indigo-100 truncate">
                                    {item.custom_name?.trim() || `${item.device.brand} ${item.device.model}`}
                                  </p>
                                  {item.custom_name && (
                                    <p className="text-[10px] text-indigo-100 truncate">{item.device.brand} {item.device.model}</p>
                                  )}
                                  {item.notes && <p className="text-[10px] text-indigo-100/90 truncate">{item.notes}</p>}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="h-4 w-full bg-slate-800 rounded-b-xl" />
    </div>
  )
}
