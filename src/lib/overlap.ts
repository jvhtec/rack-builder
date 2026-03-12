import type { DeviceFacing, LayoutItemWithDevice } from '../types'

export function hasOverlap(
  startU: number,
  rackUnits: number,
  facing: DeviceFacing,
  items: LayoutItemWithDevice[],
  excludeItemId?: string,
): boolean {
  const newTop = startU + rackUnits - 1
  return items
    .filter((item) => item.facing === facing && item.id !== excludeItemId)
    .some((item) => {
      const existingTop = item.start_u + item.device.rack_units - 1
      return startU <= existingTop && newTop >= item.start_u
    })
}

export function isWithinBounds(
  startU: number,
  rackUnits: number,
  totalRackUnits: number,
): boolean {
  return startU >= 1 && startU + rackUnits - 1 <= totalRackUnits
}
