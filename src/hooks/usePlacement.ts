import { useCallback, useMemo } from 'react'
import type { DeviceFacing, LayoutItemWithDevice, Rack, RackWidth } from '../types'
import { findDepthConflict, isWithinBounds } from '../lib/overlap'
import {
  findPositionConflict,
  getItemSlot,
  getSlotStyle,
  type ItemSlot,
  preferenceToSlot,
} from '../lib/rackPositions'
import { buildRackFaceViewModel } from '../lib/rackViewModel'

function toFiniteNumber(value: unknown): number | null {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function describeSlot(slot: ItemSlot, rackWidth: RackWidth): string {
  if (rackWidth === 'single') {
    if (slot.outer === null) return 'full width'
    return slot.outer === 0 ? 'left half' : 'right half'
  }
  if (slot.inner === null) return slot.outer === 0 ? 'left bay' : 'right bay'
  const bayLabel = slot.outer === 0 ? 'left bay' : 'right bay'
  const halfLabel = slot.inner === 0 ? 'left half' : 'right half'
  return `${bayLabel} / ${halfLabel}`
}

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

export function usePlacement(params: {
  rack: Rack | null
  items: LayoutItemWithDevice[]
  facing: DeviceFacing
}) {
  const { rack, items, facing } = params

  const oppositeFacingItems = useMemo(
    () => items.filter((item) => item.facing !== facing),
    [items, facing],
  )
  const oppositeFacingSlotAssignments = useMemo(
    () => rack
      ? new Map(oppositeFacingItems.map((item) => [item.id, getItemSlot(item, rack.width)]))
      : new Map<string, ReturnType<typeof getItemSlot>>(),
    [oppositeFacingItems, rack],
  )
  const mobileRackView = useMemo(
    () => rack ? buildRackFaceViewModel(items, facing, rack.width) : null,
    [facing, items, rack],
  )
  const mobileItems = mobileRackView?.activeItems ?? []
  const mobileSlotAssignments =
    mobileRackView?.activeSlotByItemId ?? new Map<string, ReturnType<typeof getItemSlot>>()
  const mobileGhostItems = mobileRackView?.ghostItems ?? []
  const mobileGhostSlotAssignments =
    mobileRackView?.ghostSlotByItemId ?? new Map<string, ReturnType<typeof getItemSlot>>()

  const getPlacementIssue = useCallback((
    slotU: number,
    rackUnits: number,
    isHalfRack: boolean,
    forceFullWidth: boolean,
    depthMm: number,
    rackEarOffsetMm = 0,
    excludeItemId?: string,
    preferredLane?: 0 | 1,
    preferredSubLane?: 0 | 1,
  ): string | null => {
    if (!rack) return 'Rack is not available.'

    const normalizedSlotU = toFiniteNumber(slotU)
    const normalizedRackUnits = toFiniteNumber(rackUnits)
    if (
      normalizedSlotU === null
      || normalizedRackUnits === null
      || !isWithinBounds(normalizedSlotU, normalizedRackUnits, rack.rack_units)
    ) {
      return `Out of rack bounds: U${slotU} with ${rackUnits}U in a ${rack.rack_units}U rack.`
    }

    const targetSlot = preferenceToSlot(rack.width, isHalfRack && !forceFullWidth, preferredLane, preferredSubLane)
    const overlap = findPositionConflict(
      normalizedSlotU,
      normalizedRackUnits,
      targetSlot,
      mobileItems,
      rack.width,
      excludeItemId,
    )
    if (overlap) {
      const endU = overlap.startU + overlap.rackUnits - 1
      const conflictEndU = overlap.conflictingStartU + overlap.conflictingRackUnits - 1
      return `Same-side overlap in ${describeSlot(targetSlot, rack.width)}: U${overlap.startU}-U${endU} conflicts with ${overlap.conflictingItemName} at U${overlap.conflictingStartU}-U${conflictEndU}.`
    }

    const depthConflict = findDepthConflict(
      normalizedSlotU,
      normalizedRackUnits,
      facing,
      depthMm,
      rackEarOffsetMm,
      items,
      rack.depth_mm,
      excludeItemId,
      targetSlot,
      rack.width,
      oppositeFacingSlotAssignments,
    )
    if (depthConflict) {
      return `Depth conflict: ${depthConflict.currentDepthMm}mm + ${depthConflict.oppositeDepthMm}mm = ${depthConflict.combinedDepthMm}mm exceeds rack depth ${depthConflict.rackDepthMm}mm (${depthConflict.conflictingItemName}).`
    }

    return null
  }, [facing, items, mobileItems, oppositeFacingSlotAssignments, rack])

  const getDeviceAtU = useCallback((slotU: number, visualSlotIndex: number) => {
    if (!rack) return undefined

    const findAtPosition = (
      candidateItems: LayoutItemWithDevice[],
      slotById: Map<string, ReturnType<typeof getItemSlot>>,
      isGhost: boolean,
    ) => {
      const matched = candidateItems.find((item) => {
        if (slotU < item.start_u || slotU > getTopU(item)) return false
        const slot = slotById.get(item.id) ?? getItemSlot(item, rack.width)
        const { left, width } = getSlotStyle(slot, rack.width, facing)
        const { startCol, endCol } = computeMobileColumnRange(left, width, rack.width)
        return visualSlotIndex >= startCol && visualSlotIndex <= endCol
      })
      if (!matched) return undefined
      return { item: matched, isGhost }
    }

    return (
      findAtPosition(mobileItems, mobileSlotAssignments, false)
      ?? findAtPosition(mobileGhostItems, mobileGhostSlotAssignments, true)
    )
  }, [facing, mobileGhostItems, mobileGhostSlotAssignments, mobileItems, mobileSlotAssignments, rack])

  return {
    mobileItems,
    mobileSlotAssignments,
    mobileGhostItems,
    mobileGhostSlotAssignments,
    getPlacementIssue,
    getDeviceAtU,
  }
}
