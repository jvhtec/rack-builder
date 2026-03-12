import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { DeviceFacing, LayoutItemWithDevice } from '../types'
import { hasOverlap, isWithinBounds } from '../lib/overlap'

interface LayoutItemRow {
  id: string
  layout_id: string
  device_id: string
  start_u: number
  facing: string
  notes: string | null
  device: Record<string, unknown>
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
      const mapped: LayoutItemWithDevice[] = rows.map((row) => ({
        id: row.id,
        layout_id: row.layout_id,
        device_id: row.device_id,
        start_u: row.start_u,
        facing: row.facing as DeviceFacing,
        notes: row.notes,
        device: row.device as unknown as LayoutItemWithDevice['device'],
      }))
      setItems(mapped)
      setError(null)
    }
    setLoading(false)
  }, [layoutId])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const addItem = async (
    deviceId: string,
    startU: number,
    facing: DeviceFacing,
    deviceRackUnits: number,
  ) => {
    if (!layoutId) return

    if (!isWithinBounds(startU, deviceRackUnits, totalRackUnits)) {
      throw new Error('Device exceeds rack bounds')
    }

    if (hasOverlap(startU, deviceRackUnits, facing, items)) {
      throw new Error('Position overlaps with existing device')
    }

    const { error: err } = await supabase.from('layout_items').insert({
      layout_id: layoutId,
      device_id: deviceId,
      start_u: startU,
      facing,
    })
    if (err) throw err
    await fetchItems()
  }

  const removeItem = async (itemId: string) => {
    const { error: err } = await supabase.from('layout_items').delete().eq('id', itemId)
    if (err) throw err
    await fetchItems()
  }

  const moveItem = async (itemId: string, newStartU: number, facing: DeviceFacing) => {
    const item = items.find((i) => i.id === itemId)
    if (!item) return

    if (!isWithinBounds(newStartU, item.device.rack_units, totalRackUnits)) {
      throw new Error('Device exceeds rack bounds')
    }

    if (hasOverlap(newStartU, item.device.rack_units, facing, items, itemId)) {
      throw new Error('Position overlaps with existing device')
    }

    const { error: err } = await supabase
      .from('layout_items')
      .update({ start_u: newStartU, facing })
      .eq('id', itemId)
    if (err) throw err
    await fetchItems()
  }

  const updateItemNotes = async (itemId: string, notes: string) => {
    const { error: err } = await supabase
      .from('layout_items')
      .update({ notes })
      .eq('id', itemId)
    if (err) throw err
    await fetchItems()
  }

  return { items, loading, error, addItem, removeItem, moveItem, updateItemNotes, refetch: fetchItems }
}
