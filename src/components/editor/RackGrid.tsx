import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { DeviceFacing, Rack, LayoutItemWithDevice } from '../../types'
import RackSlot from './RackSlot'
import PlacedDevice from './PlacedDevice'
import {
  buildSlots,
  getAutoSlotHeight,
  getSlotTopPx,
  getTopU,
  overlaps,
  RACK_DUAL_WIDTH,
  RACK_SINGLE_WIDTH,
  RACK_SLOT_HEIGHT_PX,
  RACK_RAIL_WIDTH_PX,
} from './rackGeometry'
import './rackBlueprint.css'

interface LaneAssignments {
  laneByItemId: Map<string, number>
  laneItems: [LayoutItemWithDevice[], LayoutItemWithDevice[]]
}

function buildLaneAssignments(
  items: LayoutItemWithDevice[],
  lanePreferenceByItemId?: Map<string, 0 | 1>,
): LaneAssignments {
  const laneByItemId = new Map<string, number>()
  const laneItems: [LayoutItemWithDevice[], LayoutItemWithDevice[]] = [[], []]
  const ordered = [...items].sort((a, b) => {
    if (a.start_u !== b.start_u) return a.start_u - b.start_u
    return a.id.localeCompare(b.id)
  })

  for (const item of ordered) {
    const preferredLane = lanePreferenceByItemId?.get(item.id)
    const laneOrder: number[] = preferredLane === 1 ? [1, 0] : [0, 1]

    for (const lane of laneOrder) {
      const blocked = laneItems[lane].some((existing) => overlaps(item.start_u, item.device.rack_units, existing))
      if (!blocked) {
        laneByItemId.set(item.id, lane)
        laneItems[lane].push(item)
        break
      }
    }

    if (!laneByItemId.has(item.id)) {
      // Overflow fallback: still render item.
      laneByItemId.set(item.id, 0)
      laneItems[0].push(item)
    }
  }

  return { laneByItemId, laneItems }
}

interface RackGridProps {
  rack: Rack
  items: LayoutItemWithDevice[]
  facing: DeviceFacing
  showDeviceDetails?: boolean
  lanePreferenceByItemId?: Map<string, 0 | 1>
  onDropNew: (deviceId: string, startU: number, rackUnits: number, preferredLane?: 0 | 1) => void
  onDropMove: (itemId: string, newStartU: number, preferredLane?: 0 | 1) => void
  onRemove: (itemId: string) => void
  onEditNotes: (item: LayoutItemWithDevice) => void
}

export default function RackGrid({
  rack,
  items,
  facing,
  showDeviceDetails = true,
  lanePreferenceByItemId,
  onDropNew,
  onDropMove,
  onRemove,
  onEditNotes,
}: RackGridProps) {
  const filteredItems = items.filter((item) => item.facing === facing)
  const oppositeFacingItems = items.filter((item) => item.facing !== facing)
  const showOppositePreview = filteredItems.length === 0 && oppositeFacingItems.length > 0
  const visibleItems = showOppositePreview ? oppositeFacingItems : filteredItems
  const isDualRack = rack.width === 'dual'
  const laneCount = isDualRack ? 2 : 1
  const rackRef = useRef<HTMLDivElement | null>(null)
  const [slotHeight, setSlotHeight] = useState(RACK_SLOT_HEIGHT_PX)
  const rackWidth = isDualRack ? RACK_DUAL_WIDTH : RACK_SINGLE_WIDTH

  useEffect(() => {
    const node = rackRef.current
    if (!node) return

    const updateHeight = (nextWidth: number) => {
      const nextHeight = getAutoSlotHeight(nextWidth, laneCount)
      setSlotHeight((prev) => (prev === nextHeight ? prev : nextHeight))
    }

    updateHeight(node.getBoundingClientRect().width)

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) updateHeight(entry.contentRect.width)
    })

    observer.observe(node)
    return () => observer.disconnect()
  }, [laneCount])

  const rackStyle = {
    width: rackWidth,
    '--rack-slot-height': `${slotHeight}px`,
    '--rack-rail-width': `${RACK_RAIL_WIDTH_PX}px`,
  } as CSSProperties
  const laneAssignments = isDualRack
    ? buildLaneAssignments(visibleItems, lanePreferenceByItemId)
    : {
        laneByItemId: new Map<string, number>(visibleItems.map((item) => [item.id, 0])),
        laneItems: [visibleItems, []] as [LayoutItemWithDevice[], LayoutItemWithDevice[]],
      }
  const oppositeItems = showOppositePreview ? [] : oppositeFacingItems
  const oppositeLaneAssignments = isDualRack
    ? buildLaneAssignments(oppositeItems, lanePreferenceByItemId)
    : {
        laneByItemId: new Map<string, number>(oppositeItems.map((item) => [item.id, 0])),
        laneItems: [oppositeItems, []] as [LayoutItemWithDevice[], LayoutItemWithDevice[]],
      }
  const ghostItems = oppositeItems.filter((ghostItem) => {
    const ghostLane = oppositeLaneAssignments.laneByItemId.get(ghostItem.id) ?? 0
    const top = getTopU(ghostItem)
    return !visibleItems.some((activeItem) => {
      const activeLane = laneAssignments.laneByItemId.get(activeItem.id) ?? 0
      if (activeLane !== ghostLane) return false
      return ghostItem.start_u <= getTopU(activeItem) && top >= activeItem.start_u
    })
  })

  const canPlaceAtSlot = (
    slotU: number,
    rackUnits: number,
    excludeItemId?: string,
    preferredLane?: 0 | 1,
  ): boolean => {
    if (!isDualRack) {
      const droppedTop = slotU + rackUnits - 1
      return !filteredItems
        .filter((item) => item.id !== excludeItemId)
        .some((item) => slotU <= getTopU(item) && droppedTop >= item.start_u)
    }

    const baseItems = excludeItemId
      ? filteredItems.filter((item) => item.id !== excludeItemId)
      : filteredItems
    const basePreferences = excludeItemId
      ? new Map(
          [...(lanePreferenceByItemId?.entries() ?? [])]
            .filter(([itemId]) => itemId !== excludeItemId),
        )
      : lanePreferenceByItemId
    const { laneItems } = buildLaneAssignments(baseItems, basePreferences)
    const targetLanes: number[] = typeof preferredLane === 'number' ? [preferredLane] : [0, 1]
    return targetLanes.some((lane) => !laneItems[lane].some((existing) => overlaps(slotU, rackUnits, existing)))
  }

  const slots = buildSlots(rack.rack_units)

  return (
    <div className="rack-blueprint-container">
      <div className="rack-u-labels">
        {slots.map((u) => (
          <div key={`label-${u}`} className="rack-u-label-row" style={{ height: slotHeight }}>
            <span className="rack-u-label-text">{u}</span>
            <div className="rack-u-label-line" />
          </div>
        ))}
      </div>

      <div className="rack-blueprint-wrapper">
        <div className="rack-casing-top"></div>
        <div ref={rackRef} className="rack-blueprint" style={rackStyle}>
          <div className="rack-blueprint-header">
            {rack.name} — {rack.rack_units}U — {facing === 'front' ? 'Front' : 'Rear'} View
          </div>

          <div className="rack-blueprint-body relative">
            <div className="rack-blueprint-rails">
              <div className="rack-blueprint-rail rack-blueprint-rail-left" />
              <div className="rack-blueprint-rail rack-blueprint-rail-right" />
              {laneCount === 2 && <div className="rack-blueprint-divider" />}
            </div>

            {slots.map((u) => (
              <RackSlot
                key={u}
                slotU={u}
                totalRackUnits={rack.rack_units}
                facing={facing}
                items={visibleItems}
                laneCount={laneCount}
                slotHeight={slotHeight}
                canPlaceAtSlot={canPlaceAtSlot}
                onDropNew={onDropNew}
                onDropMove={onDropMove}
              />
            ))}

            <div className="rack-device-layer">
              {ghostItems.map((item) => {
                const topPx = getSlotTopPx(rack.rack_units, item.start_u, item.device.rack_units, slotHeight)
                const laneIndex = oppositeLaneAssignments.laneByItemId.get(item.id) ?? 0
                const laneLeft = laneCount === 1 ? '0%' : `${laneIndex * 50}%`
                const laneWidth = laneCount === 1 ? '100%' : '50%'

                return (
                  <div
                    key={`ghost-${item.id}`}
                    className="rack-ghost-wrap"
                    style={{
                      zIndex: 5,
                      top: `${topPx}px`,
                      left: laneLeft,
                      width: laneWidth,
                      height: `${item.device.rack_units * slotHeight}px`,
                    }}
                  >
                    <div className="rack-ghost-outline">
                      {showDeviceDetails && (
                        <div className="rack-ghost-label">{item.custom_name?.trim() || `${item.device.brand} ${item.device.model}`}</div>
                      )}
                    </div>
                  </div>
                )
              })}

              {visibleItems.map((item) => {
                const topPx = getSlotTopPx(rack.rack_units, item.start_u, item.device.rack_units, slotHeight)
                const laneIndex = laneAssignments.laneByItemId.get(item.id) ?? 0
                const laneLeft = laneCount === 1 ? '0%' : `${laneIndex * 50}%`
                const laneWidth = laneCount === 1 ? '100%' : '50%'

                return (
                  <div
                    key={item.id}
                    className="rack-device-wrap"
                    style={{
                      zIndex: 10,
                      top: `${topPx}px`,
                      left: laneLeft,
                      width: laneWidth,
                    }}
                  >
                    <PlacedDevice
                      item={item}
                      facing={facing}
                      slotHeight={slotHeight}
                      showDeviceDetails={showDeviceDetails}
                      interactive={!showOppositePreview}
                      onRemove={onRemove}
                      onEditNotes={onEditNotes}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div className="rack-casing-bottom"></div>
        <div className="rack-casters">
          <div className="rack-caster"></div>
          <div className="rack-caster"></div>
        </div>
      </div>
    </div>
  )
}
