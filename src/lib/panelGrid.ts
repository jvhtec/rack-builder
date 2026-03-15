import type { ConnectorDefinition, DeviceFacing, PanelLayoutPort, PanelLayoutRow } from '../types'

export const HOLE_COUNT_OPTIONS = [4, 6, 8, 12, 16] as const
export type HoleCount = (typeof HOLE_COUNT_OPTIONS)[number]

export const PUNCHED_AREA_RATIO_BY_HOLE_COUNT: Record<HoleCount, number> = {
  4: 0.56,
  6: 0.66,
  8: 0.74,
  12: 0.86,
  16: 0.94,
}

export const ACTIVE_COLUMNS_BY_HOLE_COUNT: Record<HoleCount, number[]> = {
  4: [2, 6, 10, 14],
  6: [1, 4, 6, 9, 12, 14],
  8: [1, 3, 5, 7, 9, 11, 13, 15],
  12: [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15],
  16: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
}

export function toHoleCount(value: number): HoleCount {
  if (value === 4 || value === 6 || value === 8 || value === 12 || value === 16) return value
  return 16
}

export function getActiveColumns(holeCount: number): number[] {
  return [...ACTIVE_COLUMNS_BY_HOLE_COUNT[toHoleCount(holeCount)]]
}

export function getPunchedAreaRatio(holeCount: number): number {
  return PUNCHED_AREA_RATIO_BY_HOLE_COUNT[toHoleCount(holeCount)]
}

export interface PanelRowCellGeometry {
  holeIndex: number
  leftPct: number
  widthPct: number
}

export function buildRowCellGeometry(
  holeCount: number,
  activeColumnMap: unknown,
  facing: DeviceFacing,
): PanelRowCellGeometry[] {
  const normalizedHoleCount = toHoleCount(holeCount)
  const normalizedMap = normalizeActiveColumnMap(activeColumnMap, normalizedHoleCount)
  const sortedVisual = normalizedMap
    .map((column, holeIndex) => ({
      holeIndex,
      visualColumn: facing === 'rear' ? 15 - column : column,
    }))
    .sort((a, b) => a.visualColumn - b.visualColumn)

  if (sortedVisual.length === 0) return []

  const ratio = getPunchedAreaRatio(normalizedHoleCount)
  const punchedLeft = (1 - ratio) / 2

  const visualColumns = sortedVisual.map((entry) => entry.visualColumn)
  const boundariesInGridUnits: number[] = new Array(visualColumns.length + 1)
  if (visualColumns.length === 1) {
    boundariesInGridUnits[0] = visualColumns[0] - 0.5
    boundariesInGridUnits[1] = visualColumns[0] + 0.5
  } else {
    boundariesInGridUnits[0] = visualColumns[0] - (visualColumns[1] - visualColumns[0]) / 2
    boundariesInGridUnits[visualColumns.length] =
      visualColumns[visualColumns.length - 1] +
      (visualColumns[visualColumns.length - 1] - visualColumns[visualColumns.length - 2]) / 2
    for (let index = 1; index < visualColumns.length; index += 1) {
      boundariesInGridUnits[index] = (visualColumns[index - 1] + visualColumns[index]) / 2
    }
  }

  const minBoundary = boundariesInGridUnits[0]
  const maxBoundary = boundariesInGridUnits[boundariesInGridUnits.length - 1]
  const boundarySpan = maxBoundary - minBoundary
  const scaledBoundaries = boundariesInGridUnits.map((boundary) => {
    if (boundarySpan <= 0.000001) return punchedLeft
    const normalized = (boundary - minBoundary) / boundarySpan
    return punchedLeft + normalized * ratio
  })

  return sortedVisual.map((entry, index) => ({
    holeIndex: entry.holeIndex,
    leftPct: scaledBoundaries[index] * 100,
    widthPct: Math.max(0.01, (scaledBoundaries[index + 1] - scaledBoundaries[index]) * 100),
  }))
}

export function isMountingAllowed(mounting: ConnectorDefinition['mounting'], panelFacing: DeviceFacing): boolean {
  if (mounting === 'both') return true
  return mounting === panelFacing
}

export function normalizeActiveColumnMap(
  value: unknown,
  holeCount: number,
): number[] {
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => Number(entry))
      .filter((entry) => Number.isInteger(entry) && entry >= 0 && entry < 16)
    const uniqueSorted = Array.from(new Set(normalized)).sort((a, b) => a - b)
    if (uniqueSorted.length === holeCount) return uniqueSorted
  }
  return getActiveColumns(holeCount)
}

export function buildDefaultRows(
  panelLayoutId: string,
  heightRu: number,
  holeCount: HoleCount,
): Array<Pick<PanelLayoutRow, 'panel_layout_id' | 'row_index' | 'hole_count' | 'active_column_map'>> {
  return Array.from({ length: heightRu }, (_, rowIndex) => ({
    panel_layout_id: panelLayoutId,
    row_index: rowIndex,
    hole_count: holeCount,
    active_column_map: getActiveColumns(holeCount),
  }))
}

interface PlacementCandidate {
  row_index: number
  hole_index: number
  span_w: number
  span_h: number
  id?: string
}

function mapsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

function normalizeRowActiveMap(row: PanelLayoutRow): number[] {
  const normalized = normalizeActiveColumnMap(row.active_column_map, row.hole_count)
  if (normalized.length === row.hole_count) return normalized
  return getActiveColumns(row.hole_count)
}

function validateCandidateAgainstRows(
  rowMap: Map<number, PanelLayoutRow>,
  candidate: PlacementCandidate,
): { ok: true } | { ok: false; reason: string } {
  if (candidate.hole_index < 0 || candidate.span_w < 1 || candidate.span_h < 1) {
    return { ok: false, reason: 'Invalid connector footprint.' }
  }

  const targetRow = rowMap.get(candidate.row_index)
  if (!targetRow) return { ok: false, reason: 'Target row does not exist.' }

  const rowEnd = candidate.row_index + candidate.span_h - 1
  const targetMap = normalizeRowActiveMap(targetRow)

  for (let rowIndex = candidate.row_index; rowIndex <= rowEnd; rowIndex += 1) {
    const row = rowMap.get(rowIndex)
    if (!row) return { ok: false, reason: 'Connector exceeds panel row bounds.' }

    if (candidate.hole_index + candidate.span_w > row.hole_count) {
      return { ok: false, reason: 'Connector exceeds available holes on this row.' }
    }

    if (candidate.span_h > 1) {
      if (row.hole_count !== targetRow.hole_count) {
        return {
          ok: false,
          reason: 'Multi-row connectors require identical hole density across spanned rows.',
        }
      }
      const rowMapValues = normalizeRowActiveMap(row)
      if (!mapsEqual(rowMapValues, targetMap)) {
        return {
          ok: false,
          reason: 'Multi-row connectors require matching hole map alignment across spanned rows.',
        }
      }
    }
  }

  return { ok: true }
}

function logicalRectOverlap(a: PlacementCandidate, b: PlacementCandidate): boolean {
  const aRowEnd = a.row_index + a.span_h - 1
  const bRowEnd = b.row_index + b.span_h - 1
  const aHoleEnd = a.hole_index + a.span_w - 1
  const bHoleEnd = b.hole_index + b.span_w - 1
  const rowOverlap = a.row_index <= bRowEnd && aRowEnd >= b.row_index
  const holeOverlap = a.hole_index <= bHoleEnd && aHoleEnd >= b.hole_index
  return rowOverlap && holeOverlap
}

export function canPlacePort(
  rows: PanelLayoutRow[],
  existingPorts: PanelLayoutPort[],
  candidate: PlacementCandidate,
): { ok: boolean; reason?: string } {
  const rowMap = new Map(rows.map((row) => [row.row_index, row]))
  const candidateValidation = validateCandidateAgainstRows(rowMap, candidate)
  if (!candidateValidation.ok) return candidateValidation

  const conflict = existingPorts
    .filter((port) => port.id !== candidate.id)
    .some((port) => logicalRectOverlap(candidate, port))
  if (conflict) return { ok: false, reason: 'Connector overlaps with another connector.' }

  return { ok: true }
}

export interface PanelRowCapacity {
  row_index: number
  hole_count: number
  occupied_holes: number
  free_holes: number
}

export function summarizeRowCapacities(
  rows: PanelLayoutRow[],
  ports: PanelLayoutPort[],
): PanelRowCapacity[] {
  const sortedRows = [...rows].sort((a, b) => a.row_index - b.row_index)
  const rowByIndex = new Map(sortedRows.map((row) => [row.row_index, row]))
  const occupancy = new Map<number, boolean[]>()
  for (const row of sortedRows) {
    occupancy.set(row.row_index, Array.from({ length: row.hole_count }, () => false))
  }

  for (const port of ports) {
    for (let rowIndex = port.row_index; rowIndex < port.row_index + port.span_h; rowIndex += 1) {
      const row = rowByIndex.get(rowIndex)
      const rowSlots = occupancy.get(rowIndex)
      if (!row || !rowSlots) continue
      const start = Math.max(0, port.hole_index)
      const end = Math.min(row.hole_count, port.hole_index + port.span_w)
      for (let holeIndex = start; holeIndex < end; holeIndex += 1) {
        rowSlots[holeIndex] = true
      }
    }
  }

  return sortedRows.map((row) => {
    const rowSlots = occupancy.get(row.row_index) ?? []
    const occupied = rowSlots.reduce((count, used) => count + (used ? 1 : 0), 0)
    return {
      row_index: row.row_index,
      hole_count: row.hole_count,
      occupied_holes: occupied,
      free_holes: Math.max(0, row.hole_count - occupied),
    }
  })
}

export function connectorWeightKg(
  ports: PanelLayoutPort[],
  connectorMap: Map<string, ConnectorDefinition>,
): number {
  return ports.reduce((acc, port) => {
    const connector = connectorMap.get(port.connector_id)
    return acc + (connector?.weight_kg ?? 0)
  }, 0)
}
