import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { DeviceFacing, Rack, LayoutItemWithDevice } from '../../types'
import RackSlot from './RackSlot'
import PlacedDevice from './PlacedDevice'
import {
  buildSlots,
  getAutoSlotHeight,
  getSlotTopPx,
  RACK_DUAL_WIDTH,
  RACK_SINGLE_WIDTH,
  RACK_SLOT_HEIGHT_PX,
  RACK_RAIL_WIDTH_PX,
} from './rackGeometry'
import {
  buildSlotAssignments,
  canPlaceAtPosition,
  getItemSlot,
  getSlotStyle,
  preferenceToSlot,
} from '../../lib/rackPositions'
import { hasDepthConflict } from '../../lib/overlap'
import './rackBlueprint.css'

interface RackGridProps {
  rack: Rack
  items: LayoutItemWithDevice[]
  facing: DeviceFacing
  showDeviceDetails?: boolean
  lanePreferenceByItemId?: Map<string, 0 | 1>
  onDropNew: (deviceId: string, startU: number, rackUnits: number, preferredLane?: 0 | 1, preferredSubLane?: 0 | 1) => void
  onDropMove: (itemId: string, newStartU: number, preferredLane?: 0 | 1, preferredSubLane?: 0 | 1) => void
  onRemove: (itemId: string) => void
  onEditNotes: (item: LayoutItemWithDevice) => void
}

export default function RackGrid({
  rack,
  items,
  facing,
  showDeviceDetails = true,
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

  const slotAssignments = buildSlotAssignments(visibleItems, rack.width)
  const oppositeItems = showOppositePreview ? [] : oppositeFacingItems
  const oppositeSlotAssignments = buildSlotAssignments(oppositeItems, rack.width)

  const ghostItems = oppositeItems.filter((ghostItem) => {
    const ghostSlot = oppositeSlotAssignments.get(ghostItem.id) ?? getItemSlot(ghostItem, rack.width)
    const ghostTop = ghostItem.start_u + ghostItem.device.rack_units - 1
    return !visibleItems.some((activeItem) => {
      const activeSlot = slotAssignments.get(activeItem.id) ?? getItemSlot(activeItem, rack.width)
      // Check horizontal conflict
      const { left: gLeft, width: gWidth } = getSlotStyle(ghostSlot, rack.width)
      const { left: aLeft, width: aWidth } = getSlotStyle(activeSlot, rack.width)
      if (gLeft !== aLeft || gWidth !== aWidth) return false
      const activeTop = activeItem.start_u + activeItem.device.rack_units - 1
      return ghostItem.start_u <= activeTop && ghostTop >= activeItem.start_u
    })
  })

  const canPlaceAtSlot = (
    slotU: number,
    rackUnits: number,
    isHalfRack: boolean,
    depthMm: number,
    excludeItemId?: string,
    preferredLane?: 0 | 1,
    preferredSubLane?: 0 | 1,
  ): boolean => {
    const targetSlot = preferenceToSlot(rack.width, isHalfRack, preferredLane, preferredSubLane)
    if (!canPlaceAtPosition(slotU, rackUnits, targetSlot, filteredItems, rack.width, excludeItemId)) return false
    // Depth-aware front/rear conflict check using all items (not just filteredItems)
    if (hasDepthConflict(slotU, rackUnits, facing, depthMm, items, rack.depth_mm, excludeItemId)) return false
    return true
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
                const slot = oppositeSlotAssignments.get(item.id) ?? getItemSlot(item, rack.width)
                const { left: laneLeft, width: laneWidth } = getSlotStyle(slot, rack.width, facing)

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
                const slot = slotAssignments.get(item.id) ?? getItemSlot(item, rack.width)
                const { left: laneLeft, width: laneWidth } = getSlotStyle(slot, rack.width, facing)

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
