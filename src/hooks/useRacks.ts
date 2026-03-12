import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Rack } from '../types'

export function useRacks() {
  const [racks, setRacks] = useState<Rack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRacks = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('racks')
      .select('*')
      .order('created_at', { ascending: false })
    if (err) {
      setError(err.message)
    } else {
      setRacks((data as Rack[]) ?? [])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchRacks()
  }, [fetchRacks])

  const createRack = async (rack: {
    name: string
    rack_units: number
    depth_mm: number
    width: 'single' | 'dual'
  }) => {
    const { error: err } = await supabase.from('racks').insert(rack as never)
    if (err) throw err
    await fetchRacks()
  }

  const updateRack = async (
    id: string,
    updates: Partial<{
      name: string
      rack_units: number
      depth_mm: number
      width: 'single' | 'dual'
    }>,
  ) => {
    const { error: err } = await supabase
      .from('racks')
      .update({ ...updates, updated_at: new Date().toISOString() } as never)
      .eq('id', id)
    if (err) throw err
    await fetchRacks()
  }

  const deleteRack = async (id: string) => {
    const { error: err } = await supabase.from('racks').delete().eq('id', id)
    if (err) throw err
    await fetchRacks()
  }

  return { racks, loading, error, createRack, updateRack, deleteRack, refetch: fetchRacks }
}
