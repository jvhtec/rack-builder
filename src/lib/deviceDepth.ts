import type { LayoutItemWithDevice } from '../types'

/**
 * Depth the device occupies measured inward from its mounting face,
 * accounting for ear offset.
 *
 * ear_offset_mm > 0 pushes the device outward (toward its face),
 * reducing inward reach. ear_offset_mm < 0 pushes it inward,
 * increasing inward reach.
 *
 * Result is clamped to minimum 0.
 */
export function inwardDepthMm(item: LayoutItemWithDevice): number {
  return Math.max(0, item.device.depth_mm - (item.ear_offset_mm ?? 0))
}
