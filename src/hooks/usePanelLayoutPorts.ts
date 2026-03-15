import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PanelLayoutPort } from '../types'

interface PanelLayoutPortRecord extends PanelLayoutPort {}

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

export function usePanelLayoutPorts(panelLayoutId: string | undefined) {
  const [ports, setPorts] = useState<PanelLayoutPort[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPorts = useCallback(async () => {
    if (!panelLayoutId) {
      setPorts([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error: err } = await supabase
      .from('panel_layout_ports')
      .select('*')
      .eq('panel_layout_id', panelLayoutId)
      .order('created_at', { ascending: true })
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    setPorts(((data ?? []) as PanelLayoutPortRecord[]).map(mapPort))
    setError(null)
    setLoading(false)
  }, [panelLayoutId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchPorts()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [fetchPorts])

  return { ports, loading, error, refetch: fetchPorts }
}
