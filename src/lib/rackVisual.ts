export const RACK_PANEL_WIDTH_UNITS = 19
export const RACK_VISUAL_U_HEIGHT_UNITS = 2

export function normalizeRackUnits(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.round(value))
}

export function getRackPanelAspect(rackUnits: number): number {
  const units = normalizeRackUnits(rackUnits)
  return RACK_PANEL_WIDTH_UNITS / (RACK_VISUAL_U_HEIGHT_UNITS * units)
}
