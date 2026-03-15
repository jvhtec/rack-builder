import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildDefaultRows, normalizeActiveColumnMap, toHoleCount, type HoleCount } from '../lib/panelGrid'
import type { DeviceFacing, PanelLayout, PanelLayoutPort, PanelLayoutRow } from '../types'

interface PanelLayoutRowRecord {
  id: string
  panel_layout_id: string
  row_index: number
  hole_count: number
  active_column_map: unknown
  created_at: string
  updated_at: string
}

interface PanelLayoutPortRecord {
  id: string
  panel_layout_id: string
  connector_id: string
  row_index: number
  hole_index: number
  span_w: number
  span_h: number
  label: string | null
  created_at: string
  updated_at: string
}

interface PanelLayoutRecord extends Omit<PanelLayout, 'rows' | 'ports' | 'height_ru'> {
  height_ru: number
  rows?: PanelLayoutRowRecord[]
  ports?: PanelLayoutPortRecord[]
}

function mapRow(row: PanelLayoutRowRecord): PanelLayoutRow {
  const holeCount = toHoleCount(row.hole_count)
  return {
    id: row.id,
    panel_layout_id: row.panel_layout_id,
    row_index: row.row_index,
    hole_count: holeCount,
    active_column_map: normalizeActiveColumnMap(row.active_column_map, holeCount),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapPort(row: PanelLayoutPortRecord): PanelLayoutPort {
  return {
    id: row.id,
    panel_layout_id: row.panel_layout_id,
    connector_id: row.connector_id,
    row_index: row.row_index,
    hole_index: row.hole_index,
    span_w: row.span_w,
    span_h: row.span_h,
    label: row.label,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapPanelLayout(record: PanelLayoutRecord): PanelLayout {
  return {
    id: record.id,
    project_id: record.project_id,
    name: record.name,
    height_ru: record.height_ru,
    facing: record.facing,
    has_lacing_bar: record.has_lacing_bar,
    notes: record.notes,
    weight_kg: Number(record.weight_kg ?? 0),
    created_at: record.created_at,
    updated_at: record.updated_at,
    rows: (record.rows ?? []).map(mapRow).sort((a, b) => a.row_index - b.row_index),
    ports: (record.ports ?? []).map(mapPort),
  }
}

export function usePanelLayouts(projectId: string | undefined) {
  const [panelLayouts, setPanelLayouts] = useState<PanelLayout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPanelLayouts = useCallback(async () => {
    if (!projectId) {
      setPanelLayouts([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error: err } = await supabase
      .from('panel_layouts')
      .select('*, rows:panel_layout_rows(*), ports:panel_layout_ports(*)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

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
    const timeoutId = window.setTimeout(() => {
      void fetchPanelLayouts()
    }, 0)

    return () => window.clearTimeout(timeoutId)
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
    if (rowsError) throw rowsError

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
    const { error: deleteError } = await supabase
      .from('panel_layout_rows')
      .delete()
      .eq('panel_layout_id', panelLayoutId)
    if (deleteError) throw deleteError

    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from('panel_layout_rows')
        .insert(
          rows.map((row) => ({
            panel_layout_id: panelLayoutId,
            row_index: row.row_index,
            hole_count: row.hole_count,
            active_column_map: row.active_column_map,
          })),
        )
      if (insertError) throw insertError
    }

    await fetchPanelLayouts()
  }

  const replacePorts = async (
    panelLayoutId: string,
    ports: Array<Pick<PanelLayoutPort, 'connector_id' | 'row_index' | 'hole_index' | 'span_w' | 'span_h' | 'label'>>,
  ) => {
    const { error: deleteError } = await supabase
      .from('panel_layout_ports')
      .delete()
      .eq('panel_layout_id', panelLayoutId)
    if (deleteError) throw deleteError

    if (ports.length > 0) {
      const { error: insertError } = await supabase
        .from('panel_layout_ports')
        .insert(
          ports.map((port) => ({
            panel_layout_id: panelLayoutId,
            connector_id: port.connector_id,
            row_index: port.row_index,
            hole_index: port.hole_index,
            span_w: port.span_w,
            span_h: port.span_h,
            label: port.label ?? null,
          })),
        )
      if (insertError) throw insertError
    }

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
      if (rowsError) throw rowsError
    }
    if (portPayload.length > 0) {
      const { error: portsError } = await supabase.from('panel_layout_ports').insert(portPayload)
      if (portsError) throw portsError
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
