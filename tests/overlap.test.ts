import { describe, expect, it } from 'vitest'
import { findDepthConflict } from '../src/lib/overlap'
import { getItemSlot, preferenceToSlot } from '../src/lib/rackPositions'
import type { DeviceFacing, LayoutItemWithDevice } from '../src/types'

function makeItem(args: {
  id: string
  facing: DeviceFacing
  startU: number
  rackUnits: number
  depthMm: number
  preferredLane: 0 | 1 | null
  preferredSubLane?: 0 | 1 | null
  isHalfRack?: boolean
  earOffsetMm?: number
}): LayoutItemWithDevice {
  return {
    id: args.id,
    layout_id: 'layout-1',
    device_id: args.id,
    panel_layout_id: null,
    asset_kind: 'device',
    start_u: args.startU,
    facing: args.facing,
    preferred_lane: args.preferredLane,
    preferred_sub_lane: args.preferredSubLane ?? null,
    force_full_width: false,
    custom_name: null,
    ear_offset_mm: args.earOffsetMm ?? 0,
    notes: null,
    device: {
      id: args.id,
      brand: 'Brand',
      model: 'Model',
      rack_units: args.rackUnits,
      depth_mm: args.depthMm,
      weight_kg: 0,
      power_w: 0,
      is_half_rack: args.isHalfRack ?? false,
      category_id: 'cat-1',
      front_image_path: 'front.png',
      rear_image_path: 'rear.png',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      category: null,
    },
    panel_layout: null,
  }
}

describe('depth overlap rules', () => {
  it('reports depth collision only when target slot footprint overlaps opposite side', () => {
    const frontItem = makeItem({
      id: 'front-1',
      facing: 'front',
      startU: 10,
      rackUnits: 2,
      depthMm: 500,
      preferredLane: 0,
    })
    const oppositeSlots = new Map([[frontItem.id, getItemSlot(frontItem, 'dual')]])

    const sameFootprintConflict = findDepthConflict(
      10,
      2,
      'rear',
      400,
      [frontItem],
      800,
      undefined,
      preferenceToSlot('dual', false, 0),
      'dual',
      oppositeSlots,
    )
    expect(sameFootprintConflict).not.toBeNull()
    expect(sameFootprintConflict?.combinedDepthMm).toBe(900)

    const differentFootprintConflict = findDepthConflict(
      10,
      2,
      'rear',
      400,
      [frontItem],
      800,
      undefined,
      preferenceToSlot('dual', false, 1),
      'dual',
      oppositeSlots,
    )
    expect(differentFootprintConflict).toBeNull()
  })

  it('positive ear offsets reduce inward depth and can resolve conflicts', () => {
    // Front 500mm + Rear 400mm = 900mm > 800mm rack → conflict without offsets
    const frontItem = makeItem({
      id: 'front-1',
      facing: 'front',
      startU: 10,
      rackUnits: 2,
      depthMm: 500,
      preferredLane: 0,
      earOffsetMm: 100, // inward depth = 500 - 100 = 400
    })

    // With front offset 100 and rear offset 100:
    // inward front = 400, inward rear = 400 - 100 = 300, combined = 700 < 800 → no conflict
    const conflict = findDepthConflict(
      10, 2, 'rear', 400,
      [frontItem], 800,
      undefined, undefined, undefined, undefined,
      100, // rear device ear offset
    )
    expect(conflict).toBeNull()
  })

  it('negative ear offsets increase inward depth and can cause conflicts', () => {
    // Front 300mm + Rear 400mm = 700mm < 800mm rack → no conflict without offsets
    const frontItem = makeItem({
      id: 'front-1',
      facing: 'front',
      startU: 10,
      rackUnits: 2,
      depthMm: 300,
      preferredLane: null,
      earOffsetMm: -100, // inward depth = 300 - (-100) = 400
    })

    // With front offset -100 and rear offset -100:
    // inward front = 400, inward rear = 400 - (-100) = 500, combined = 900 > 800 → conflict
    const conflict = findDepthConflict(
      10, 2, 'rear', 400,
      [frontItem], 800,
      undefined, undefined, undefined, undefined,
      -100, // rear device ear offset
    )
    expect(conflict).not.toBeNull()
    expect(conflict?.combinedDepthMm).toBe(900)
  })
})
