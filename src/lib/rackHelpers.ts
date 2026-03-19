import type { DeviceFacing, LayoutItemWithDevice, RackWidth } from '../types'
import { getDeviceImageUrl } from '../hooks/useDevices'
import { selectFacingImagePath } from './rackViewModel'

/**
 * Maps a visual mobile column index to the logical (preferredLane, preferredSubLane)
 * pair, accounting for rear-view mirroring.
 */
export function visualColToLanePreference(
  colIndex: number,
  rackWidth: RackWidth,
  facing: DeviceFacing,
  isHalfRack: boolean,
): { preferredLane: 0 | 1 | undefined; preferredSubLane: 0 | 1 | undefined } {
  const mirror = facing === 'rear'
  if (rackWidth === 'single') {
    if (!isHalfRack) return { preferredLane: undefined, preferredSubLane: undefined }
    const logicalLane = (mirror ? 1 - colIndex : colIndex) as 0 | 1
    return { preferredLane: logicalLane, preferredSubLane: undefined }
  }
  // Dual rack — 4 visual columns
  const visualLane = colIndex >= 2 ? 1 : 0
  const visualSub = colIndex % 2
  if (!isHalfRack) {
    const logicalLane = (mirror ? 1 - visualLane : visualLane) as 0 | 1
    return { preferredLane: logicalLane, preferredSubLane: undefined }
  }
  const logicalLane = (mirror ? 1 - visualLane : visualLane) as 0 | 1
  const logicalSub = (mirror ? 1 - visualSub : visualSub) as 0 | 1
  return { preferredLane: logicalLane, preferredSubLane: logicalSub }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object') {
    const maybeMessage = 'message' in error && typeof error.message === 'string' ? error.message : ''
    const maybeDetails = 'details' in error && typeof error.details === 'string' ? error.details : ''
    const maybeHint = 'hint' in error && typeof error.hint === 'string' ? error.hint : ''
    const parts = [maybeMessage, maybeDetails, maybeHint].filter(Boolean)
    if (parts.length > 0) return parts.join(' ')
  }
  return 'Unknown backend error.'
}

export function resolvePlacementImageUrl(item: LayoutItemWithDevice, facing: DeviceFacing): string | null {
  return getDeviceImageUrl(selectFacingImagePath(item, facing))
}
