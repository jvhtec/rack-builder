import { useCallback, useEffect, useState } from 'react'
import type { DeviceFacing } from '../types'

export type RackViewMode = DeviceFacing | 'left' | 'right'

export interface ViewModeOption {
  value: RackViewMode
  label: string
  shortLabel: string
}

export const VIEW_MODE_OPTIONS: ViewModeOption[] = [
  { value: 'front', label: 'Front', shortLabel: 'Fr' },
  { value: 'rear', label: 'Rear', shortLabel: 'Re' },
  { value: 'left', label: 'Left', shortLabel: 'Lt' },
  { value: 'right', label: 'Right', shortLabel: 'Rt' },
]

const LAYOUT_EDITOR_ZOOM_STORAGE_KEY = 'layout-editor-zoom-percent'
export const MIN_ZOOM_PERCENT = 60
export const MAX_ZOOM_PERCENT = 180
const DEFAULT_ZOOM_PERCENT = 100
const ZOOM_STEP_PERCENT = 10

function normalizeZoomPercent(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ZOOM_PERCENT
  const stepped = Math.round(value / ZOOM_STEP_PERCENT) * ZOOM_STEP_PERCENT
  return Math.min(MAX_ZOOM_PERCENT, Math.max(MIN_ZOOM_PERCENT, stepped))
}

function getInitialZoomPercent(): number {
  try {
    const storedValue = localStorage.getItem(LAYOUT_EDITOR_ZOOM_STORAGE_KEY)
    if (storedValue === null) return DEFAULT_ZOOM_PERCENT
    return normalizeZoomPercent(Number(storedValue))
  } catch {
    return DEFAULT_ZOOM_PERCENT
  }
}

export function isSideViewMode(mode: RackViewMode): mode is 'left' | 'right' {
  return mode === 'left' || mode === 'right'
}

export function useRackViewState() {
  const [facing, setFacing] = useState<DeviceFacing>('front')
  const [viewMode, setViewMode] = useState<RackViewMode>('front')
  const [showDeviceNames, setShowDeviceNames] = useState(true)
  const [simplifiedView, setSimplifiedView] = useState(false)
  const [zoomPercent, setZoomPercent] = useState<number>(getInitialZoomPercent)

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_EDITOR_ZOOM_STORAGE_KEY, String(zoomPercent))
    } catch {
      // ignore
    }
  }, [zoomPercent])

  const setRackViewMode = useCallback((nextViewMode: RackViewMode) => {
    setViewMode(nextViewMode)
    if (nextViewMode === 'front' || nextViewMode === 'rear') {
      setFacing(nextViewMode)
    }
  }, [])

  const cycleRackViewMode = useCallback(() => {
    const options = VIEW_MODE_OPTIONS.map((option) => option.value)
    const currentIndex = options.indexOf(viewMode)
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % options.length
    setRackViewMode(options[nextIndex])
  }, [setRackViewMode, viewMode])

  const handleZoomOut = useCallback(() => {
    setZoomPercent((prev) => normalizeZoomPercent(prev - ZOOM_STEP_PERCENT))
  }, [])

  const handleZoomIn = useCallback(() => {
    setZoomPercent((prev) => normalizeZoomPercent(prev + ZOOM_STEP_PERCENT))
  }, [])

  const handleZoomReset = useCallback(() => {
    setZoomPercent(DEFAULT_ZOOM_PERCENT)
  }, [])

  const isSideView = isSideViewMode(viewMode)
  const activeViewOption = VIEW_MODE_OPTIONS.find((option) => option.value === viewMode) ?? VIEW_MODE_OPTIONS[0]
  const zoomFactor = zoomPercent / 100
  const canZoomOut = zoomPercent > MIN_ZOOM_PERCENT
  const canZoomIn = zoomPercent < MAX_ZOOM_PERCENT

  return {
    facing,
    setFacing,
    viewMode,
    showDeviceNames,
    setShowDeviceNames,
    simplifiedView,
    setSimplifiedView,
    zoomPercent,
    isSideView,
    zoomFactor,
    canZoomIn,
    canZoomOut,
    activeViewOption,
    setRackViewMode,
    cycleRackViewMode,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
  }
}
