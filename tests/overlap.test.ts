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
})
