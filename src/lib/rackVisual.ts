/** Standard 19-inch rack panel width in inches */
export const RACK_PANEL_WIDTH_UNITS = 19
/** Standard rack unit height in inches (EIA-310 / IEC 60297) */
export const RACK_VISUAL_U_HEIGHT_UNITS = 1.75

export function normalizeRackUnits(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.round(value))
}

export function getRackPanelAspect(rackUnits: number): number {
  const units = normalizeRackUnits(rackUnits)
  return RACK_PANEL_WIDTH_UNITS / (RACK_VISUAL_U_HEIGHT_UNITS * units)
}
