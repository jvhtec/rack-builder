import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildDefaultRows, type HoleCount } from '../lib/panelGrid'
import { mapPanelLayout, type PanelLayoutRecord } from '../lib/panelLayoutMapper'
import type { DeviceFacing, PanelLayout, PanelLayoutPort, PanelLayoutRow } from '../types'

export function usePanelLayouts(projectId: string | undefined) {
  const [panelLayouts, setPanelLayouts] = useState<PanelLayout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const fetchPanelLayouts = useCallback(async () => {
    if (!projectId) {
      setPanelLayouts([])
      setError(null)
      setLoading(false)
      return
    }

    const requestId = ++requestIdRef.current
    setLoading(true)
    const { data, error: err } = await supabase
      .from('panel_layouts')
      .select('*, rows:panel_layout_rows(*), ports:panel_layout_ports(*)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    if (requestId !== requestIdRef.current) return

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    const mapped = ((data ?? []) as PanelLayoutRecord[]).map(mapPanelLayout)
    setPanelLayouts(mapped)
    setError(null)
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    const ref = requestIdRef
    const timeoutId = window.setTimeout(() => {
      void fetchPanelLayouts()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
      ref.current++
    }
  }, [fetchPanelLayouts])

  const createPanelLayout = async (payload: {
    name: string
    height_ru: number
    facing: DeviceFacing
    has_lacing_bar: boolean
    notes?: string | null
    weight_kg?: number
    default_hole_count?: HoleCount
  }) => {
    if (!projectId) throw new Error('Missing project id')
    const safeHeight = Math.max(1, Math.min(6, Math.round(payload.height_ru)))
    const holeCount = payload.default_hole_count ?? 16

    const { data, error: createError } = await supabase
      .from('panel_layouts')
      .insert({
        project_id: projectId,
        name: payload.name.trim(),
        height_ru: safeHeight,
        facing: payload.facing,
        has_lacing_bar: payload.has_lacing_bar,
        notes: payload.notes ?? null,
        weight_kg: payload.weight_kg ?? 0,
      })
      .select('*')
      .single()

    if (createError || !data) throw createError ?? new Error('Failed to create panel layout')

    const panel = mapPanelLayout(data as PanelLayoutRecord)
    const rows = buildDefaultRows(panel.id, safeHeight, holeCount)
    const { error: rowsError } = await supabase.from('panel_layout_rows').insert(rows)
    if (rowsError) {
      // Clean up the orphaned panel layout
      await supabase.from('panel_layouts').delete().eq('id', panel.id)
      throw rowsError
    }

    await fetchPanelLayouts()
    return panel.id
  }

  const updatePanelLayout = async (
    id: string,
    updates: Partial<Pick<PanelLayout, 'name' | 'facing' | 'has_lacing_bar' | 'notes' | 'weight_kg'>>,
  ) => {
    const { error: updateError } = await supabase
      .from('panel_layouts')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (updateError) throw updateError
    await fetchPanelLayouts()
  }

  const replaceRows = async (
    panelLayoutId: string,
    rows: Array<Pick<PanelLayoutRow, 'row_index' | 'hole_count' | 'active_column_map'>>,
  ) => {
    const { error: rpcError } = await supabase.rpc('rpc_replace_panel_layout_rows', {
      p_panel_layout_id: panelLayoutId,
      p_rows: rows.map((row) => ({
        row_index: row.row_index,
        hole_count: row.hole_count,
        active_column_map: row.active_column_map,
      })),
    })
    if (rpcError) throw rpcError

    await fetchPanelLayouts()
  }

  const replacePorts = async (
    panelLayoutId: string,
    ports: Array<Pick<PanelLayoutPort, 'connector_id' | 'row_index' | 'hole_index' | 'span_w' | 'span_h' | 'label'>>,
  ) => {
    const { error: rpcError } = await supabase.rpc('rpc_replace_panel_layout_ports', {
      p_panel_layout_id: panelLayoutId,
      p_ports: ports.map((port) => ({
        connector_id: port.connector_id,
        row_index: port.row_index,
        hole_index: port.hole_index,
        span_w: port.span_w,
        span_h: port.span_h,
        label: port.label ?? null,
      })),
    })
    if (rpcError) throw rpcError

    await fetchPanelLayouts()
  }

  const duplicatePanelLayout = async (layout: PanelLayout) => {
    if (!projectId) throw new Error('Missing project id')
    const { data, error: createError } = await supabase
      .from('panel_layouts')
      .insert({
        project_id: projectId,
        name: `${layout.name} Copy`,
        height_ru: layout.height_ru,
        facing: layout.facing,
        has_lacing_bar: layout.has_lacing_bar,
        notes: layout.notes,
        weight_kg: layout.weight_kg,
      })
      .select('*')
      .single()
    if (createError || !data) throw createError ?? new Error('Failed to duplicate panel layout')

    const clone = data as PanelLayoutRecord
    const rowPayload = (layout.rows ?? []).map((row) => ({
      panel_layout_id: clone.id,
      row_index: row.row_index,
      hole_count: row.hole_count,
      active_column_map: row.active_column_map,
    }))
    const portPayload = (layout.ports ?? []).map((port) => ({
      panel_layout_id: clone.id,
      connector_id: port.connector_id,
      row_index: port.row_index,
      hole_index: port.hole_index,
      span_w: port.span_w,
      span_h: port.span_h,
      label: port.label,
    }))

    if (rowPayload.length > 0) {
      const { error: rowsError } = await supabase.from('panel_layout_rows').insert(rowPayload)
      if (rowsError) {
        await supabase.from('panel_layouts').delete().eq('id', clone.id)
        throw rowsError
      }
    }
    if (portPayload.length > 0) {
      const { error: portsError } = await supabase.from('panel_layout_ports').insert(portPayload)
      if (portsError) {
        await supabase.from('panel_layouts').delete().eq('id', clone.id)
        throw portsError
      }
    }

    await fetchPanelLayouts()
    return clone.id
  }

  const deletePanelLayout = async (id: string) => {
    const { count, error: usageError } = await supabase
      .from('layout_items')
      .select('id', { count: 'exact', head: true })
      .eq('panel_layout_id', id)
    if (usageError) throw usageError
    if ((count ?? 0) > 0) {
      throw new Error('Panel layout is currently used in one or more rack layouts.')
    }

    const { error: deleteError } = await supabase
      .from('panel_layouts')
      .delete()
      .eq('id', id)
    if (deleteError) throw deleteError

    await fetchPanelLayouts()
  }

  return {
    panelLayouts,
    loading,
    error,
    createPanelLayout,
    updatePanelLayout,
    replaceRows,
    replacePorts,
    duplicatePanelLayout,
    deletePanelLayout,
    refetch: fetchPanelLayouts,
  }
}
