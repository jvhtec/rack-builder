import { useEffect, useRef, useState } from 'react'
import type { DeviceFacing, PanelLayout, PanelLayoutPort, PanelLayoutRow } from '../types'
import { getActiveColumns } from '../lib/panelGrid'

const DRAFT_STORAGE_PREFIX = 'panel-layout-draft'
const AUTO_HOLE_COUNT = 16

export interface PanelFormState {
  name: string
  facing: DeviceFacing
  hasLacingBar: boolean
  notes: string
  rows: PanelLayoutRow[]
  ports: PanelLayoutPort[]
}

interface DraftState {
  name: string
  facing: DeviceFacing
  hasLacingBar: boolean
  notes: string
  rows: Array<Pick<PanelLayoutRow, 'row_index' | 'hole_count' | 'active_column_map'>>
  ports: Array<Pick<PanelLayoutPort, 'id' | 'connector_id' | 'row_index' | 'hole_index' | 'span_w' | 'span_h' | 'label'>>
}

function normalizeRowsToAutoGrid(
  panelId: string,
  heightRu: number,
  rows: Array<Partial<PanelLayoutRow>>,
  createdAt: string,
  updatedAt: string,
): PanelLayoutRow[] {
  const byIndex = new Map<number, Partial<PanelLayoutRow>>()
  for (const row of rows) {
    if (typeof row.row_index === 'number') byIndex.set(row.row_index, row)
  }

  return Array.from({ length: Math.max(1, heightRu) }, (_, rowIndex) => {
    const existing = byIndex.get(rowIndex)
    const holeCount = (existing?.hole_count ?? AUTO_HOLE_COUNT) as 4 | 6 | 8 | 12 | 16
    return {
      id: existing?.id ?? `auto-row-${rowIndex}`,
      panel_layout_id: panelId,
      row_index: rowIndex,
      hole_count: holeCount,
      active_column_map: existing?.active_column_map?.length ? existing.active_column_map : getActiveColumns(holeCount),
      created_at: existing?.created_at ?? createdAt,
      updated_at: existing?.updated_at ?? updatedAt,
    }
  })
}

export function usePanelDraft(params: {
  panel: PanelLayout | null
  projectId: string | undefined
  panelLayoutId: string | undefined
  setFormState: (state: PanelFormState) => void
}) {
  const { panel, projectId, panelLayoutId, setFormState } = params

  const [dirty, setDirty] = useState(false)
  const hydratedDraft = useRef(false)
  const prevPanelIdRef = useRef<string | null>(null)

  const draftStorageKey = `${DRAFT_STORAGE_PREFIX}:${projectId ?? 'none'}:${panelLayoutId ?? 'none'}`

  // Hydrate from localStorage or panel data
  useEffect(() => {
    if (!panel) return
    // Reset hydration flag when switching to a different panel
    if (prevPanelIdRef.current !== null && prevPanelIdRef.current !== panel.id) {
      hydratedDraft.current = false
      setDirty(false)
    }
    prevPanelIdRef.current = panel.id
    if (!hydratedDraft.current) {
      const draftRaw = localStorage.getItem(draftStorageKey)
      if (draftRaw) {
        try {
          const draft = JSON.parse(draftRaw) as DraftState
          setFormState({
            name: draft.name,
            facing: draft.facing,
            hasLacingBar: draft.hasLacingBar,
            notes: draft.notes,
            rows: normalizeRowsToAutoGrid(
              panel.id,
              panel.height_ru,
              draft.rows.map((row, index) => ({
                id: `draft-row-${index}`,
                panel_layout_id: panel.id,
                row_index: row.row_index,
                hole_count: row.hole_count,
                active_column_map: row.active_column_map,
                created_at: panel.created_at,
                updated_at: panel.updated_at,
              })),
              panel.created_at,
              panel.updated_at,
            ),
            ports: draft.ports.map((port) => ({
              id: port.id,
              panel_layout_id: panel.id,
              connector_id: port.connector_id,
              row_index: port.row_index,
              hole_index: port.hole_index,
              span_w: port.span_w,
              span_h: port.span_h,
              label: port.label ?? null,
              created_at: panel.created_at,
              updated_at: panel.updated_at,
            })),
          })
          setDirty(true)
          hydratedDraft.current = true
          return
        } catch {
          localStorage.removeItem(draftStorageKey)
        }
      }
      hydratedDraft.current = true
    }

    if (!dirty) {
      setFormState({
        name: panel.name,
        facing: panel.facing,
        hasLacingBar: panel.has_lacing_bar,
        notes: panel.notes ?? '',
        rows: normalizeRowsToAutoGrid(
          panel.id,
          panel.height_ru,
          [...(panel.rows ?? [])].sort((a, b) => a.row_index - b.row_index),
          panel.created_at,
          panel.updated_at,
        ),
        ports: [...(panel.ports ?? [])],
      })
    }
  }, [dirty, draftStorageKey, panel, setFormState])

  return {
    dirty,
    setDirty,
    draftStorageKey,
    clearDraft: () => {
      try {
        localStorage.removeItem(draftStorageKey)
      } catch {
        // ignore
      }
    },
  }
}

export function usePanelDraftAutoSave(params: {
  panel: PanelLayout | null
  dirty: boolean
  draftStorageKey: string
  formState: PanelFormState
}) {
  const { panel, dirty, draftStorageKey, formState } = params

  useEffect(() => {
    if (!panel || !dirty) return
    const timeoutId = window.setTimeout(() => {
      const draft: DraftState = {
        name: formState.name,
        facing: formState.facing,
        hasLacingBar: formState.hasLacingBar,
        notes: formState.notes,
        rows: formState.rows.map((row) => ({
          row_index: row.row_index,
          hole_count: row.hole_count,
          active_column_map: row.active_column_map,
        })),
        ports: formState.ports.map((port) => ({
          id: port.id,
          connector_id: port.connector_id,
          row_index: port.row_index,
          hole_index: port.hole_index,
          span_w: port.span_w,
          span_h: port.span_h,
          label: port.label,
        })),
      }
      localStorage.setItem(draftStorageKey, JSON.stringify(draft))
    }, 500)

    return () => window.clearTimeout(timeoutId)
  }, [dirty, draftStorageKey, formState, panel])
}
