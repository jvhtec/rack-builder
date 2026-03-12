import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Layout } from '../types'

export function useLayouts() {
  const [layouts, setLayouts] = useState<Layout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLayouts = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('layouts')
      .select('*')
      .order('created_at', { ascending: false })
    if (err) {
      setError(err.message)
    } else {
      setLayouts((data as Layout[]) ?? [])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLayouts()
  }, [fetchLayouts])

  const createLayout = async (layout: { rack_id: string; name: string }) => {
    const { data, error: err } = await supabase
      .from('layouts')
      .insert(layout)
      .select()
      .single()
    if (err) throw err
    await fetchLayouts()
    return data as Layout
  }

  const updateLayout = async (id: string, updates: Partial<{ name: string; rack_id: string }>) => {
    const { error: err } = await supabase
      .from('layouts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (err) throw err
    await fetchLayouts()
  }

  const deleteLayout = async (id: string) => {
    const { error: err } = await supabase.from('layouts').delete().eq('id', id)
    if (err) throw err
    await fetchLayouts()
  }

  return { layouts, loading, error, createLayout, updateLayout, deleteLayout, refetch: fetchLayouts }
}
