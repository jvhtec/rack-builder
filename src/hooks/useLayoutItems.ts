import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { DeviceFacing, LayoutItemWithDevice } from '../types'
import { isWithinBounds } from '../lib/overlap'

interface LayoutItemRow {
  id: string
  layout_id: string
  device_id: string
  start_u: number
  facing: string
  preferred_lane?: number | null
  preferred_sub_lane?: number | null
  force_full_width?: boolean | null
  custom_name?: string | null
  notes: string | null
  device: Record<string, unknown>
}

function isMissingPreferredLaneColumn(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
  return message.includes('preferred_lane')
}

function isMissingCustomNameColumn(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
  return message.includes('custom_name')
}

export function useLayoutItems(layoutId: string | undefined, totalRackUnits: number) {
  const [items, setItems] = useState<LayoutItemWithDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    if (!layoutId) return
    setLoading(true)
    const { data, error: err } = await supabase
      .from('layout_items')
      .select('*, device:devices(*)')
      .eq('layout_id', layoutId)

    if (err) {
      setError(err.message)
    } else {
      const rows = (data ?? []) as LayoutItemRow[]
      const mapped: LayoutItemWithDevice[] = rows.map((row) => {
        const rawDevice = row.device as Record<string, unknown>
        return {
          id: row.id,
          layout_id: row.layout_id,
          device_id: row.device_id,
          start_u: row.start_u,
          facing: row.facing as DeviceFacing,
          preferred_lane: row.preferred_lane === 0 || row.preferred_lane === 1 ? row.preferred_lane : null,
          preferred_sub_lane: row.preferred_sub_lane === 0 || row.preferred_sub_lane === 1 ? row.preferred_sub_lane : null,
          force_full_width: row.force_full_width === true,
          custom_name: row.custom_name ?? null,
          notes: row.notes,
          device: {
            ...rawDevice,
            is_half_rack: rawDevice.is_half_rack === true,
          } as unknown as LayoutItemWithDevice['device'],
        }
      })
      setItems(mapped)
      setError(null)
    }
    setLoading(false)
  }, [layoutId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchItems()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [fetchItems])

  const addItem = async (
    deviceId: string,
    startU: number,
    facing: DeviceFacing,
    deviceRackUnits: number,
    preferredLane?: 0 | 1,
    allowOverlap = false,
    preferredSubLane?: 0 | 1,
  ) => {
    if (!layoutId) throw new Error('Missing layout id')

    if (!isWithinBounds(startU, deviceRackUnits, totalRackUnits)) {
      throw new Error('Device exceeds rack bounds')
    }

    if (!allowOverlap) {
      // Basic overlap check for full-rack single-rack placements only
      const newTop = startU + deviceRackUnits - 1
      const hasConflict = items
        .filter((item) => item.facing === facing)
        .some((item) => {
          const existingTop = item.start_u + item.device.rack_units - 1
          return startU <= existingTop && newTop >= item.start_u
        })
      if (hasConflict) throw new Error('Position overlaps with existing device')
    }

    const payload = {
      layout_id: layoutId,
      device_id: deviceId,
      start_u: startU,
      facing,
      preferred_lane: preferredLane ?? null,
      preferred_sub_lane: preferredSubLane ?? null,
    }
    let { data, error: err } = await supabase
      .from('layout_items')
      .insert(payload)
      .select('id')
      .single()

    if (err && isMissingPreferredLaneColumn(err)) {
      const fallback = await supabase
        .from('layout_items')
        .insert({
          layout_id: layoutId,
          device_id: deviceId,
          start_u: startU,
          facing,
        })
        .select('id')
        .single()
      data = fallback.data
      err = fallback.error
    }

    if (err) throw err
    const createdId = (data as { id: string }).id
    await fetchItems()
    return createdId
  }

  const removeItem = async (itemId: string) => {
    const { error: err } = await supabase.from('layout_items').delete().eq('id', itemId)
    if (err) throw err
    await fetchItems()
  }

  const moveItem = async (
    itemId: string,
    newStartU: number,
    facing: DeviceFacing,
    preferredLane?: 0 | 1,
    allowOverlap = false,
    preferredSubLane?: 0 | 1,
  ) => {
    const item = items.find((i) => i.id === itemId)
    if (!item) return

    if (!isWithinBounds(newStartU, item.device.rack_units, totalRackUnits)) {
      throw new Error('Device exceeds rack bounds')
    }

    if (!allowOverlap) {
      const newTop = newStartU + item.device.rack_units - 1
      const hasConflict = items
        .filter((i) => i.facing === facing && i.id !== itemId)
        .some((existing) => {
          const existingTop = existing.start_u + existing.device.rack_units - 1
          return newStartU <= existingTop && newTop >= existing.start_u
        })
      if (hasConflict) throw new Error('Position overlaps with existing device')
    }

    let { error: err } = await supabase
      .from('layout_items')
      .update({
        start_u: newStartU,
        facing,
        preferred_lane: preferredLane ?? null,
        preferred_sub_lane: preferredSubLane ?? null,
      })
      .eq('id', itemId)

    if (err && isMissingPreferredLaneColumn(err)) {
      const fallback = await supabase
        .from('layout_items')
        .update({ start_u: newStartU, facing })
        .eq('id', itemId)
      err = fallback.error
    }

    if (err) throw err
    await fetchItems()
  }

  const updateItemDetails = async (
    itemId: string,
    updates: Partial<{ notes: string; custom_name: string | null; force_full_width: boolean }>,
  ) => {
    let { error: err } = await supabase
      .from('layout_items')
      .update(updates)
      .eq('id', itemId)

    if (err && isMissingCustomNameColumn(err) && 'custom_name' in updates) {
      const fallback = await supabase
        .from('layout_items')
        .update({ notes: updates.notes })
        .eq('id', itemId)
      err = fallback.error
    }

    if (err) throw err
    await fetchItems()
  }

  return { items, loading, error, addItem, removeItem, moveItem, updateItemDetails, refetch: fetchItems }
}
