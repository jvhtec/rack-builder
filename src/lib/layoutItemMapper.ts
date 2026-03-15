import { CONNECTOR_BY_ID } from './connectorCatalog'
import { connectorWeightKg, normalizeActiveColumnMap, toHoleCount } from './panelGrid'
import { buildPanelThumbnailDataUrl } from './panelThumbnail'
import type { Device, DeviceFacing, LayoutItemWithDevice, PanelLayout } from '../types'

export interface LayoutItemRow {
  id: string
  layout_id: string
  device_id: string | null
  panel_layout_id: string | null
  start_u: number
  facing: string
  preferred_lane?: number | null
  preferred_sub_lane?: number | null
  force_full_width?: boolean | null
  custom_name?: string | null
  notes: string | null
  device: Record<string, unknown> | null
  panel_layout?: {
    id: string
    project_id: string
    name: string
    height_ru: number
    facing: DeviceFacing
    has_lacing_bar: boolean
    notes: string | null
    weight_kg: number
    created_at: string
    updated_at: string
    rows?: Array<{
      id: string
      panel_layout_id: string
      row_index: number
      hole_count: number
      active_column_map: unknown
      created_at: string
      updated_at: string
    }>
    ports?: Array<{
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
    }>
  } | null
}

export const LAYOUT_ITEM_SELECT =
  '*, device:devices(*), panel_layout:panel_layouts(*, rows:panel_layout_rows(*), ports:panel_layout_ports(*))'

function mapPanelLayout(raw: NonNullable<LayoutItemRow['panel_layout']>): PanelLayout {
  const rows = (raw.rows ?? []).map((row) => {
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
  })
  const ports = (raw.ports ?? []).map((port) => ({
    id: port.id,
    panel_layout_id: port.panel_layout_id,
    connector_id: port.connector_id,
    row_index: port.row_index,
    hole_index: port.hole_index,
    span_w: port.span_w,
    span_h: port.span_h,
    label: port.label,
    created_at: port.created_at,
    updated_at: port.updated_at,
  }))
  return {
    id: raw.id,
    project_id: raw.project_id,
    name: raw.name,
    height_ru: raw.height_ru,
    facing: raw.facing,
    has_lacing_bar: raw.has_lacing_bar,
    notes: raw.notes,
    weight_kg: Number(raw.weight_kg ?? 0),
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    rows,
    ports,
  }
}

function buildVirtualPanelDevice(panelLayout: PanelLayout): Device {
  const connectorMass = connectorWeightKg(panelLayout.ports ?? [], CONNECTOR_BY_ID)
  return {
    id: `panel:${panelLayout.id}`,
    brand: 'Panel Layout',
    model: panelLayout.name,
    rack_units: panelLayout.height_ru,
    depth_mm: 80,
    weight_kg: Number(panelLayout.weight_kg ?? 0) + connectorMass,
    power_w: 0,
    is_half_rack: false,
    category_id: '__panel_layout__',
    front_image_path: buildPanelThumbnailDataUrl(panelLayout, 'front'),
    rear_image_path: buildPanelThumbnailDataUrl(panelLayout, 'rear'),
    created_at: panelLayout.created_at,
    updated_at: panelLayout.updated_at,
    category: null,
  }
}

export function mapLayoutItemRows(rows: LayoutItemRow[]): LayoutItemWithDevice[] {
  return rows.map((row) => {
    const panelLayout = row.panel_layout ? mapPanelLayout(row.panel_layout) : null
    const rawDevice = row.device as Record<string, unknown> | null
    const device = panelLayout
      ? buildVirtualPanelDevice(panelLayout)
      : {
          ...(rawDevice ?? {}),
          is_half_rack: rawDevice?.is_half_rack === true,
        } as unknown as LayoutItemWithDevice['device']
    return {
      id: row.id,
      layout_id: row.layout_id,
      device_id: row.device_id,
      panel_layout_id: row.panel_layout_id,
      asset_kind: panelLayout ? 'panel_layout' : 'device',
      start_u: row.start_u,
      facing: row.facing as DeviceFacing,
      preferred_lane: row.preferred_lane === 0 || row.preferred_lane === 1 ? row.preferred_lane : null,
      preferred_sub_lane: row.preferred_sub_lane === 0 || row.preferred_sub_lane === 1 ? row.preferred_sub_lane : null,
      force_full_width: row.force_full_width === true,
      custom_name: row.custom_name ?? null,
      notes: row.notes,
      device,
      panel_layout: panelLayout,
    }
  })
}
