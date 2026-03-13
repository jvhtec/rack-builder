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

/**
 * Returns true when a device being placed at `startU`/`rackUnits` on `facing`
 * with depth `deviceDepthMm` would physically collide with an opposing-face device
 * given the rack's total internal depth (`rackDepthMm`).
 *
 * Two devices on opposite faces conflict at the same vertical positions when:
 *   front_depth + rear_depth > rack_depth
 */
export function hasDepthConflict(
  startU: number,
  rackUnits: number,
  facing: DeviceFacing,
  deviceDepthMm: number,
  items: LayoutItemWithDevice[],
  rackDepthMm: number,
  excludeItemId?: string,
): boolean {
  const newTop = startU + rackUnits - 1
  const oppositeFacing: DeviceFacing = facing === 'front' ? 'rear' : 'front'
  return items
    .filter((item) => item.facing === oppositeFacing && item.id !== excludeItemId)
    .some((item) => {
      const existingTop = item.start_u + item.device.rack_units - 1
      // Only relevant if they vertically overlap
      if (startU > existingTop || newTop < item.start_u) return false
      return deviceDepthMm + item.device.depth_mm > rackDepthMm
    })
}
