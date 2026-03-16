import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { TouchBackend } from 'react-dnd-touch-backend'
import { supabase } from '../lib/supabase'
import { useLayoutItems } from '../hooks/useLayoutItems'
import { ALL_BRAND, filterDevicesByBrand, filterDevicesByCategory, getDeviceImageUrl, useDevices } from '../hooks/useDevices'
import { usePanelLayouts } from '../hooks/usePanelLayouts'
import { useLayouts } from '../hooks/useLayouts'
import { useRacks } from '../hooks/useRacks'
import { useConnectors } from '../hooks/useConnectors'
import { findDepthConflict, isWithinBounds } from '../lib/overlap'
import {
  canPlaceAtPosition,
  findPositionConflict,
  getItemSlot,
  getSlotStyle,
  type ItemSlot,
  preferenceToSlot,
} from '../lib/rackPositions'
import type { DeviceFacing, LayoutItemWithDevice, Project, RackWidth } from '../types'
import { buildPanelThumbnailDataUrl } from '../lib/panelThumbnail'
import { buildRackFaceViewModel, selectFacingImagePath } from '../lib/rackViewModel'
import DevicePalette from '../components/editor/DevicePalette'
import RackGrid from '../components/editor/RackGrid'
import RackSideDepthView from '../components/editor/RackSideDepthView'
import DeviceNotes from '../components/editor/DeviceNotes'
import AutoScaleText from '../components/shared/AutoScaleText'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'

function getTopU(item: LayoutItemWithDevice): number {
  return item.start_u + item.device.rack_units - 1
}

/**
 * Maps a visual mobile column index to the logical (preferredLane, preferredSubLane)
 * pair, accounting for rear-view mirroring.
 */
function visualColToLanePreference(
  colIndex: number,
  rackWidth: RackWidth,
  facing: DeviceFacing,
  isHalfRack: boolean,
): { preferredLane: 0 | 1 | undefined; preferredSubLane: 0 | 1 | undefined } {
  const mirror = facing === 'rear'
  if (rackWidth === 'single') {
    if (!isHalfRack) return { preferredLane: undefined, preferredSubLane: undefined }
    const logicalLane = (mirror ? 1 - colIndex : colIndex) as 0 | 1
    return { preferredLane: logicalLane, preferredSubLane: undefined }
  }
  // Dual rack — 4 visual columns
  const visualLane = colIndex >= 2 ? 1 : 0
  const visualSub = colIndex % 2
  if (!isHalfRack) {
    const logicalLane = (mirror ? 1 - visualLane : visualLane) as 0 | 1
    return { preferredLane: logicalLane, preferredSubLane: undefined }
  }
  const logicalLane = (mirror ? 1 - visualLane : visualLane) as 0 | 1
  const logicalSub = (mirror ? 1 - visualSub : visualSub) as 0 | 1
  return { preferredLane: logicalLane, preferredSubLane: logicalSub }
}

function computeMobileColumnRange(
  leftCssPct: string,
  widthCssPct: string,
  rackWidth: RackWidth,
): { startCol: number; endCol: number; spanCols: number } {
  const leftPct = parseFloat(leftCssPct)
  const widthPct = parseFloat(widthCssPct)
  const totalColumns = rackWidth === 'dual' ? 4 : 2
  const colWidth = 100 / totalColumns
  const startCol = Math.round(leftPct / colWidth)
  const spanCols = Math.round(widthPct / colWidth)
  const endCol = startCol + spanCols - 1
  return { startCol, endCol, spanCols }
}

function toFiniteNumber(value: unknown): number | null {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function resolvePlacementImageUrl(item: LayoutItemWithDevice, facing: DeviceFacing): string | null {
  return getDeviceImageUrl(selectFacingImagePath(item, facing))
}

function describeSlot(slot: ItemSlot, rackWidth: RackWidth): string {
  if (rackWidth === 'single') {
    if (slot.outer === null) return 'full width'
    return slot.outer === 0 ? 'left half' : 'right half'
  }
  if (slot.inner === null) return slot.outer === 0 ? 'left bay' : 'right bay'
  const bayLabel = slot.outer === 0 ? 'left bay' : 'right bay'
  const halfLabel = slot.inner === 0 ? 'left half' : 'right half'
  return `${bayLabel} / ${halfLabel}`
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object') {
    const maybeMessage = 'message' in error && typeof error.message === 'string' ? error.message : ''
    const maybeDetails = 'details' in error && typeof error.details === 'string' ? error.details : ''
    const maybeHint = 'hint' in error && typeof error.hint === 'string' ? error.hint : ''
    const parts = [maybeMessage, maybeDetails, maybeHint].filter(Boolean)
    if (parts.length > 0) return parts.join(' ')
  }
  return 'Unknown backend error.'
}

const PANEL_LIBRARY_CATEGORY_ID = '__panel_layouts__'
const PANEL_LIBRARY_CATEGORY_NAME = 'Panel Layouts'
const PANEL_LIBRARY_BRAND = 'Panel Layouts'

function panelTemplateDeviceId(panelLayoutId: string): string {
  return `panel:${panelLayoutId}`
}

function parsePanelTemplateId(deviceId: string): string | null {
  if (!deviceId.startsWith('panel:')) return null
  return deviceId.slice('panel:'.length)
}

type RackViewMode = DeviceFacing | 'left' | 'right'

const VIEW_MODE_OPTIONS: Array<{ value: RackViewMode; label: string; shortLabel: string }> = [
  { value: 'front', label: 'Front', shortLabel: 'Fr' },
  { value: 'rear', label: 'Rear', shortLabel: 'Re' },
  { value: 'left', label: 'Left', shortLabel: 'Lt' },
  { value: 'right', label: 'Right', shortLabel: 'Rt' },
]

function isSideViewMode(mode: RackViewMode): mode is 'left' | 'right' {
  return mode === 'left' || mode === 'right'
}


function useProject(projectId: string | undefined) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadProject() {
      if (!projectId) {
        setError('Missing project id')
        setLoading(false)
        return
      }

      setLoading(true)
      const { data, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (!active) return

      if (projectError || !data) {
        setProject(null)
        setError('Project not found')
        setLoading(false)
        return
      }

      setProject(data as Project)
      setError(null)
      setLoading(false)
    }

    void loadProject()

    return () => {
      active = false
    }
  }, [projectId])

  return { project, loading, error }
}

export default function LayoutEditorPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [facing, setFacing] = useState<DeviceFacing>('front')
  const [viewMode, setViewMode] = useState<RackViewMode>('front')
  const [notesItem, setNotesItem] = useState<LayoutItemWithDevice | null>(null)
  const [activeTab, setActiveTab] = useState<'devices' | 'rack'>('devices')
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [selectedDeviceTemplate, setSelectedDeviceTemplate] = useState<string | null>(null)
  const [showDeviceNames, setShowDeviceNames] = useState(true)
  const [simplifiedView, setSimplifiedView] = useState(false)
  const [isMobile, setIsMobile] = useState<boolean>(() => window.innerWidth < 768)
  const [isTouchLikeDevice, setIsTouchLikeDevice] = useState<boolean>(
    () => window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window,
  )
  const [mobileDualLane, setMobileDualLane] = useState<0 | 1>(0)
  const [selectedCategoryId, setSelectedCategoryId] = useState('all')
  const [selectedBrand, setSelectedBrand] = useState(ALL_BRAND)
  const [selectedItemToMove, setSelectedItemToMove] = useState<string | null>(null)
  const [mobileOffsetDraft, setMobileOffsetDraft] = useState('0')
  const [hoverPlacementHint, setHoverPlacementHint] = useState<string | null>(null)
  const [placementErrorHint, setPlacementErrorHint] = useState<string | null>(null)
  const placementHint = placementErrorHint ?? hoverPlacementHint

  const [createLayoutOpen, setCreateLayoutOpen] = useState(false)
  const [renameLayoutOpen, setRenameLayoutOpen] = useState(false)
  const [deleteLayoutOpen, setDeleteLayoutOpen] = useState(false)
  const [layoutNameDraft, setLayoutNameDraft] = useState('')
  const [layoutRackDraft, setLayoutRackDraft] = useState('')
  const [layoutSaving, setLayoutSaving] = useState(false)

  const { project, loading: projectLoading, error: projectError } = useProject(projectId)
  const {
    layouts,
    loading: layoutsLoading,
    createLayout,
    updateLayout,
    deleteLayout,
  } = useLayouts(projectId)
  const { racks, loading: racksLoading } = useRacks()
  const { connectorById } = useConnectors()
  const { devices, categories, loading: devicesLoading } = useDevices()
  const { panelLayouts } = usePanelLayouts(projectId)

  const activeLayoutId = searchParams.get('layout')
  const activeLayout = useMemo(
    () => layouts.find((entry) => entry.id === activeLayoutId) ?? null,
    [activeLayoutId, layouts],
  )

  const rackMap = useMemo(() => new Map(racks.map((rack) => [rack.id, rack])), [racks])
  const rack = useMemo(() => {
    if (!activeLayout) return null
    return rackMap.get(activeLayout.rack_id) ?? null
  }, [activeLayout, rackMap])

  const { items, addItem, addPanelLayoutItem, removeItem, moveItem, updateItemDetails } = useLayoutItems(
    activeLayout?.id,
    rack?.rack_units ?? 0,
  )
  const rackTotals = useMemo(() => {
    return items.reduce(
      (acc, item) => ({
        weightKg: acc.weightKg + item.device.weight_kg,
        powerW: acc.powerW + item.device.power_w,
      }),
      { weightKg: 0, powerW: 0 },
    )
  }, [items])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches)
    setIsMobile(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    const coarsePointerQuery = window.matchMedia('(pointer: coarse)')
    const updateTouchLike = () => {
      setIsTouchLikeDevice(coarsePointerQuery.matches || 'ontouchstart' in window)
    }

    updateTouchLike()
    coarsePointerQuery.addEventListener('change', updateTouchLike)
    return () => coarsePointerQuery.removeEventListener('change', updateTouchLike)
  }, [])

  const dndBackend = isTouchLikeDevice ? TouchBackend : HTML5Backend
  const dndOptions = isTouchLikeDevice
    ? {
        enableMouseEvents: true,
        delayTouchStart: 120,
        touchSlop: 8,
        ignoreContextMenu: true,
      }
    : undefined

  useEffect(() => {
    if (rack?.width !== 'dual') {
      setMobileDualLane(0)
    }
  }, [rack?.width])

  useEffect(() => {
    if (layouts.length === 0) return
    if (activeLayoutId && layouts.some((entry) => entry.id === activeLayoutId)) return

    const next = new URLSearchParams(searchParams)
    next.set('layout', layouts[0].id)
    setSearchParams(next, { replace: true })
  }, [activeLayoutId, layouts, searchParams, setSearchParams])

  const setActiveLayout = useCallback((layoutId: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('layout', layoutId)
    setSearchParams(next)
  }, [searchParams, setSearchParams])

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

  const isSideView = isSideViewMode(viewMode)
  const activeViewOption = VIEW_MODE_OPTIONS.find((option) => option.value === viewMode) ?? VIEW_MODE_OPTIONS[0]

  useEffect(() => {
    if (!isSideView) return
    if (selectedDeviceTemplate) setSelectedDeviceTemplate(null)
    if (selectedItemToMove) setSelectedItemToMove(null)
  }, [isSideView, selectedDeviceTemplate, selectedItemToMove])

  useEffect(() => {
    if (!isSideView) return
    if (hoverPlacementHint) setHoverPlacementHint(null)
    if (placementErrorHint) setPlacementErrorHint(null)
  }, [hoverPlacementHint, isSideView, placementErrorHint])

  const panelLibraryDevices = useMemo(() => panelLayouts.map((panel) => ({
    id: panelTemplateDeviceId(panel.id),
    brand: PANEL_LIBRARY_BRAND,
    model: panel.name,
    rack_units: panel.height_ru,
    depth_mm: panel.depth_mm,
    weight_kg: panel.weight_kg,
    power_w: 0,
    is_half_rack: false,
    category_id: PANEL_LIBRARY_CATEGORY_ID,
    category: {
      id: PANEL_LIBRARY_CATEGORY_ID,
      name: PANEL_LIBRARY_CATEGORY_NAME,
      created_at: panel.created_at,
      updated_at: panel.updated_at,
    },
    front_image_path: buildPanelThumbnailDataUrl(panel, 'front', connectorById),
    rear_image_path: buildPanelThumbnailDataUrl(panel, 'rear', connectorById),
    created_at: panel.created_at,
    updated_at: panel.updated_at,
  })), [connectorById, panelLayouts])

  const libraryDevices = useMemo(
    () => [...devices, ...panelLibraryDevices],
    [devices, panelLibraryDevices],
  )

  const panelCategory = useMemo(
    () => panelLayouts.length > 0
      ? [{
        id: PANEL_LIBRARY_CATEGORY_ID,
        name: PANEL_LIBRARY_CATEGORY_NAME,
        created_at: panelLayouts[0].created_at,
        updated_at: panelLayouts[0].updated_at,
      }]
      : [],
    [panelLayouts],
  )

  const libraryCategories = useMemo(
    () => [...categories, ...panelCategory],
    [categories, panelCategory],
  )

  const brands = useMemo(
    () => [...new Set(libraryDevices.map((d) => d.brand))]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    [libraryDevices],
  )

  const filteredDevices = useMemo(
    () => filterDevicesByBrand(filterDevicesByCategory(libraryDevices, selectedCategoryId), selectedBrand),
    [libraryDevices, selectedCategoryId, selectedBrand],
  )

  useEffect(() => {
    if (!selectedDeviceTemplate) return
    if (filteredDevices.some((device) => device.id === selectedDeviceTemplate)) return
    setSelectedDeviceTemplate(null)
  }, [filteredDevices, selectedDeviceTemplate])

  const showBackendPlacementReject = useCallback((actionLabel: string, error: unknown) => {
    const message = toErrorMessage(error)
    setPlacementErrorHint(`${actionLabel} rejected by backend: ${message}`)
  }, [])

  const handleDropNew = async (
    deviceId: string,
    startU: number,
    rackUnits: number,
    preferredLane?: 0 | 1,
    preferredSubLane?: 0 | 1,
  ) => {
    setPlacementErrorHint(null)
    try {
      const panelLayoutId = parsePanelTemplateId(deviceId)
      if (panelLayoutId) {
        const panelLayout = panelLayouts.find((entry) => entry.id === panelLayoutId)
        if (!panelLayout) return
        await addPanelLayoutItem(
          panelLayoutId,
          startU,
          facing,
          panelLayout.height_ru,
          preferredLane,
          preferredSubLane,
        )
        setPlacementErrorHint(null)
        return
      }
      await addItem(deviceId, startU, facing, rackUnits, preferredLane, preferredSubLane)
      setPlacementErrorHint(null)
    } catch (err) {
      console.error('Drop failed:', err)
      showBackendPlacementReject('Placement', err)
    }
  }

  const handleDropMove = async (itemId: string, newStartU: number, preferredLane?: 0 | 1, preferredSubLane?: 0 | 1) => {
    setPlacementErrorHint(null)
    try {
      await moveItem(itemId, newStartU, facing, preferredLane, preferredSubLane)
      setPlacementErrorHint(null)
    } catch (err) {
      console.error('Move failed:', err)
      showBackendPlacementReject('Move', err)
    }
  }

  const oppositeFacingItems = useMemo(
    () => items.filter((item) => item.facing !== facing),
    [items, facing],
  )
  const oppositeFacingSlotAssignments = useMemo(
    () => rack
      ? new Map(oppositeFacingItems.map((item) => [item.id, getItemSlot(item, rack.width)]))
      : new Map<string, ReturnType<typeof getItemSlot>>(),
    [oppositeFacingItems, rack],
  )
  const mobileRackView = useMemo(
    () => rack ? buildRackFaceViewModel(items, facing, rack.width) : null,
    [facing, items, rack],
  )
  const mobileItems = mobileRackView?.activeItems ?? []
  const mobileSlotAssignments =
    mobileRackView?.activeSlotByItemId ?? new Map<string, ReturnType<typeof getItemSlot>>()
  const mobileGhostItems = mobileRackView?.ghostItems ?? []
  const mobileGhostSlotAssignments =
    mobileRackView?.ghostSlotByItemId ?? new Map<string, ReturnType<typeof getItemSlot>>()

  const getPlacementIssue = useCallback((
    slotU: number,
    rackUnits: number,
    isHalfRack: boolean,
    forceFullWidth: boolean,
    depthMm: number,
    rackEarOffsetMm = 0,
    excludeItemId?: string,
    preferredLane?: 0 | 1,
    preferredSubLane?: 0 | 1,
  ): string | null => {
    if (!rack) return 'Rack is not available.'

    const normalizedSlotU = toFiniteNumber(slotU)
    const normalizedRackUnits = toFiniteNumber(rackUnits)
    if (
      normalizedSlotU === null
      || normalizedRackUnits === null
      || !isWithinBounds(normalizedSlotU, normalizedRackUnits, rack.rack_units)
    ) {
      return `Out of rack bounds: U${slotU} with ${rackUnits}U in a ${rack.rack_units}U rack.`
    }

    const targetSlot = preferenceToSlot(rack.width, isHalfRack && !forceFullWidth, preferredLane, preferredSubLane)
    const overlap = findPositionConflict(
      normalizedSlotU,
      normalizedRackUnits,
      targetSlot,
      mobileItems,
      rack.width,
      excludeItemId,
    )
    if (overlap) {
      const endU = overlap.startU + overlap.rackUnits - 1
      const conflictEndU = overlap.conflictingStartU + overlap.conflictingRackUnits - 1
      return `Same-side overlap in ${describeSlot(targetSlot, rack.width)}: U${overlap.startU}-U${endU} conflicts with ${overlap.conflictingItemName} at U${overlap.conflictingStartU}-U${conflictEndU}.`
    }

    const depthConflict = findDepthConflict(
      normalizedSlotU,
      normalizedRackUnits,
      facing,
      depthMm,
      rackEarOffsetMm,
      items,
      rack.depth_mm,
      excludeItemId,
      targetSlot,
      rack.width,
      oppositeFacingSlotAssignments,
    )
    if (depthConflict) {
      return `Depth conflict: ${depthConflict.currentDepthMm}mm + ${depthConflict.oppositeDepthMm}mm = ${depthConflict.combinedDepthMm}mm exceeds rack depth ${depthConflict.rackDepthMm}mm (${depthConflict.conflictingItemName}).`
    }

    return null
  }, [facing, items, mobileItems, oppositeFacingSlotAssignments, rack])

  const getDeviceAtU = useCallback((slotU: number, visualSlotIndex: number) => {
    if (!rack) return undefined

    const findAtPosition = (
      candidateItems: LayoutItemWithDevice[],
      slotById: Map<string, ReturnType<typeof getItemSlot>>,
      isGhost: boolean,
    ) => {
      const matched = candidateItems.find((item) => {
        if (slotU < item.start_u || slotU > getTopU(item)) return false
        const slot = slotById.get(item.id) ?? getItemSlot(item, rack.width)
        const { left, width } = getSlotStyle(slot, rack.width, facing)
        const { startCol, endCol } = computeMobileColumnRange(left, width, rack.width)
        return visualSlotIndex >= startCol && visualSlotIndex <= endCol
      })
      if (!matched) return undefined
      return { item: matched, isGhost }
    }

    return (
      findAtPosition(mobileItems, mobileSlotAssignments, false)
      ?? findAtPosition(mobileGhostItems, mobileGhostSlotAssignments, true)
    )
  }, [facing, mobileGhostItems, mobileGhostSlotAssignments, mobileItems, mobileSlotAssignments, rack])

  const handleMobileSlotClick = async (slotU: number, colIndex: number) => {
    if (!selectedDeviceTemplate || !rack) return
    const panelTemplateId = parsePanelTemplateId(selectedDeviceTemplate)
    if (panelTemplateId) {
      const panelLayout = panelLayouts.find((entry) => entry.id === panelTemplateId)
      if (!panelLayout) return
      const panelDepthMm = panelLayout.depth_mm
      if (!isWithinBounds(slotU, panelLayout.height_ru, rack.rack_units)) {
        setPlacementErrorHint(`Out of rack bounds: U${slotU} with ${panelLayout.height_ru}U in a ${rack.rack_units}U rack.`)
        return
      }

      const { preferredLane, preferredSubLane } = visualColToLanePreference(
        colIndex, rack.width, facing, false,
      )
      const issue = getPlacementIssue(
        slotU,
        panelLayout.height_ru,
        false,
        false,
        panelDepthMm,
        0,
        undefined,
        preferredLane,
        preferredSubLane,
      )
      if (issue) {
        setPlacementErrorHint(issue)
        return
      }

      try {
        await addPanelLayoutItem(panelTemplateId, slotU, facing, panelLayout.height_ru, preferredLane, preferredSubLane)
        setSelectedDeviceTemplate(null)
        setPlacementErrorHint(null)
      } catch (err) {
        console.error('Tap placement failed:', err)
        showBackendPlacementReject('Placement', err)
      }
      return
    }

    const device = devices.find((entry) => entry.id === selectedDeviceTemplate)
    if (!device) return

    if (!isWithinBounds(slotU, device.rack_units, rack.rack_units)) {
      setPlacementErrorHint(`Out of rack bounds: U${slotU} with ${device.rack_units}U in a ${rack.rack_units}U rack.`)
      return
    }

    const { preferredLane, preferredSubLane } = visualColToLanePreference(
      colIndex, rack.width, facing, device.is_half_rack,
    )
    const issue = getPlacementIssue(
      slotU,
      device.rack_units,
      device.is_half_rack,
      false,
      device.depth_mm,
      0,
      undefined,
      preferredLane,
      preferredSubLane,
    )
    if (issue) {
      setPlacementErrorHint(issue)
      return
    }

    try {
      await addItem(device.id, slotU, facing, device.rack_units, preferredLane, preferredSubLane)
      setSelectedDeviceTemplate(null)
      setPlacementErrorHint(null)
    } catch (err) {
      console.error('Tap placement failed:', err)
      showBackendPlacementReject('Placement', err)
    }
  }

  const handleMobileMoveToSlot = async (slotU: number, colIndex: number) => {
    if (!selectedItemToMove || !rack) return
    const item = items.find((i) => i.id === selectedItemToMove)
    if (!item) return

    if (!isWithinBounds(slotU, item.device.rack_units, rack.rack_units)) {
      setPlacementErrorHint(`Out of rack bounds: U${slotU} with ${item.device.rack_units}U in a ${rack.rack_units}U rack.`)
      return
    }

    const { preferredLane, preferredSubLane } = visualColToLanePreference(
      colIndex, rack.width, facing, item.device.is_half_rack,
    )
    const issue = getPlacementIssue(
      slotU,
      item.device.rack_units,
      item.device.is_half_rack,
      item.force_full_width,
      item.device.depth_mm,
      item.rack_ear_offset_mm,
      selectedItemToMove,
      preferredLane,
      preferredSubLane,
    )
    if (issue) {
      setPlacementErrorHint(issue)
      return
    }

    try {
      await moveItem(selectedItemToMove, slotU, facing, preferredLane, preferredSubLane)
      setSelectedItemToMove(null)
      setPlacementErrorHint(null)
    } catch (err) {
      console.error('Tap move failed:', err)
      showBackendPlacementReject('Move', err)
    }
  }


  const handleMobileOffsetSave = async () => {
    if (!selectedItemToMove) return
    const offset = Number(mobileOffsetDraft)
    if (!Number.isFinite(offset)) {
      setPlacementErrorHint('Rack ear offset must be a valid number.')
      return
    }
    await updateItemDetails(selectedItemToMove, { rack_ear_offset_mm: Math.round(offset * 10) / 10 })
    setPlacementErrorHint(null)
  }

  const openCreateLayoutModal = () => {
    setLayoutNameDraft('')
    setLayoutRackDraft(rack?.id ?? racks[0]?.id ?? '')
    setCreateLayoutOpen(true)
  }

  const openRenameLayoutModal = () => {
    if (!activeLayout) return
    setLayoutNameDraft(activeLayout.name)
    setRenameLayoutOpen(true)
  }

  const handleCreateLayout = async () => {
    if (!projectId || !layoutNameDraft || !layoutRackDraft) return

    setLayoutSaving(true)
    try {
      const created = await createLayout({
        project_id: projectId,
        name: layoutNameDraft,
        rack_id: layoutRackDraft,
      })
      if (created) {
        setCreateLayoutOpen(false)
        setActiveLayout(created.id)
      }
    } finally {
      setLayoutSaving(false)
    }
  }

  const handleRenameLayout = async () => {
    if (!activeLayout || !layoutNameDraft) return

    setLayoutSaving(true)
    try {
      await updateLayout(activeLayout.id, { name: layoutNameDraft })
      setRenameLayoutOpen(false)
    } finally {
      setLayoutSaving(false)
    }
  }

  const handleDeleteLayout = async () => {
    if (!activeLayout || layouts.length <= 1) return

    const fallbackLayout = layouts.find((entry) => entry.id !== activeLayout.id)

    setLayoutSaving(true)
    try {
      await deleteLayout(activeLayout.id)
      setDeleteLayoutOpen(false)
      if (fallbackLayout) setActiveLayout(fallbackLayout.id)
    } finally {
      setLayoutSaving(false)
    }
  }

  if (projectError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{projectError}</p>
          <Button onClick={() => navigate('/projects')}>Back to Projects</Button>
        </div>
      </div>
    )
  }

  if (projectLoading || layoutsLoading || racksLoading || !project || !activeLayout || !rack) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>
    )
  }

  const slots = Array.from({ length: rack.rack_units }, (_, i) => rack.rack_units - i)
  const mobileColumnCount = 2
  const isDualRack = rack.width === 'dual'
  const mobileLaneOffset = isDualRack ? mobileDualLane * mobileColumnCount : 0

  const handleSaveNotes = async (
    itemId: string,
    updates: Partial<{ notes: string; custom_name: string | null; force_full_width: boolean; rack_ear_offset_mm: number }>,
  ) => {
    // When a half-rack device is being widened to full-column, verify it won't conflict
    if (updates.force_full_width === true && rack) {
      const item = items.find((i) => i.id === itemId)
      if (item?.device.is_half_rack) {
        const widenedSlot = getItemSlot({ ...item, force_full_width: true }, rack.width)
        const sameFacing = items.filter((i) => i.id !== itemId && i.facing === item.facing)
        if (!canPlaceAtPosition(item.start_u, item.device.rack_units, widenedSlot, sameFacing, rack.width)) {
          throw new Error('Cannot span full width: another device occupies the adjacent half-rack slot at this position.')
        }
      }
    }
    return updateItemDetails(itemId, updates)
  }

  const tabButtons = layouts.map((layoutEntry) => (
    <button
      key={layoutEntry.id}
      onClick={() => setActiveLayout(layoutEntry.id)}
      className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap border ${
        layoutEntry.id === activeLayout.id
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {layoutEntry.name}
    </button>
  ))

  if (!isMobile) {
    return (
      <DndProvider backend={dndBackend} options={dndOptions}>
        <div className="flex h-screen bg-gray-100">
          <DevicePalette
            devices={filteredDevices}
            categories={libraryCategories}
            selectedCategoryId={selectedCategoryId}
            onCategoryChange={setSelectedCategoryId}
            brands={brands}
            selectedBrand={selectedBrand}
            onBrandChange={setSelectedBrand}
            loading={devicesLoading}
          />

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-white border-b px-6 py-3 shrink-0">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <Button variant="secondary" onClick={() => navigate('/projects')}>
                    &larr; Back
                  </Button>
                  <div className="min-w-0">
                    <h1 className="text-xl font-semibold truncate">{project.name}</h1>
                    <p className="text-xs text-gray-500 truncate">
                      {activeLayout.name} | {rack.name} ({rack.rack_units}U) | {rackTotals.weightKg.toFixed(2)} kg | {rackTotals.powerW} W
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/editor/project/${project.id}/print/${activeLayout.id}`)}
                  >
                    Print A3 / PDF
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/editor/project/${project.id}/panels`)}
                  >
                    Panel Layouts
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/editor/project/${project.id}/print/all`)}
                    disabled={layouts.length <= 1}
                    title={layouts.length <= 1 ? 'Add more layouts to print the full project' : undefined}
                  >
                    Print Full Project
                  </Button>
                  {VIEW_MODE_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      variant={viewMode === option.value ? 'primary' : 'secondary'}
                      onClick={() => setRackViewMode(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                  <Button
                    variant={showDeviceNames ? 'primary' : 'secondary'}
                    onClick={() => setShowDeviceNames((prev) => !prev)}
                  >
                    Labels {showDeviceNames ? 'On' : 'Off'}
                  </Button>
                  <Button
                    variant={simplifiedView ? 'primary' : 'secondary'}
                    onClick={() => setSimplifiedView((prev) => !prev)}
                  >
                    Simplified {simplifiedView ? 'On' : 'Off'}
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
                {tabButtons}
                <Button variant="secondary" className="whitespace-nowrap" onClick={openCreateLayoutModal}>
                  + Layout
                </Button>
                <Button variant="secondary" className="whitespace-nowrap" onClick={openRenameLayoutModal}>
                  Rename
                </Button>
                <Button
                  variant="danger"
                  className="whitespace-nowrap"
                  onClick={() => setDeleteLayoutOpen(true)}
                  disabled={layouts.length <= 1}
                  title={layouts.length <= 1 ? 'A project must contain at least one layout' : undefined}
                >
                  Delete
                </Button>
              </div>

              {!isSideView && selectedItemToMove && (() => {
          const selectedItem = items.find((entry) => entry.id === selectedItemToMove)
          if (!selectedItem) return null
          const selectedLabel = selectedItem.custom_name?.trim() || `${selectedItem.device.brand} ${selectedItem.device.model}`
          return (
            <div className="fixed left-1/2 -translate-x-1/2 z-20 w-[calc(100%-2rem)] max-w-[380px] rounded-xl border border-indigo-400 bg-slate-900/95 px-3 py-2 shadow-2xl" style={{ top: 'calc(14.2rem + env(safe-area-inset-top))' }}>
              <div className="mb-2 text-[11px] font-semibold text-indigo-100 truncate">Offset · {selectedLabel}</div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={mobileOffsetDraft}
                  onChange={(e) => setMobileOffsetDraft(e.target.value)}
                  className="w-full min-h-9 rounded-md border border-slate-600 bg-slate-800 px-2 text-xs text-slate-100"
                />
                <button
                  onClick={() => void handleMobileOffsetSave()}
                  className="min-h-9 rounded-md border border-indigo-300 bg-indigo-600 px-3 text-xs font-semibold text-white"
                >
                  Save
                </button>
              </div>
            </div>
          )
        })()}

        {placementHint && !isSideView && (
                <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {placementHint}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto flex items-start justify-center p-10">
              {placementHint && !isSideView && (
                <div className="fixed left-1/2 top-24 z-20 w-[min(60rem,calc(100%-4rem))] -translate-x-1/2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-lg">
                  {placementHint}
                </div>
              )}
              {isSideView ? (
                <RackSideDepthView
                  rack={rack}
                  items={items}
                  side={viewMode}
                  showDeviceDetails={showDeviceNames}
                />
              ) : (
                <RackGrid
                  rack={rack}
                  items={items}
                  connectorById={connectorById}
                  facing={facing}
                  showDeviceDetails={showDeviceNames}
                  simplifiedView={simplifiedView}
                  onPlacementHint={setHoverPlacementHint}
                  onDropNew={handleDropNew}
                  onDropMove={handleDropMove}
                  onRemove={removeItem}
                  onEditNotes={setNotesItem}
                />
              )}
            </div>
          </div>

          <DeviceNotes
            key={notesItem?.id ?? 'none'}
            item={notesItem}
            onSave={handleSaveNotes}
            onClose={() => setNotesItem(null)}
          />
        </div>

        <Modal isOpen={createLayoutOpen} onClose={() => setCreateLayoutOpen(false)} title="New Layout">
          <div className="space-y-4">
            <Input
              label="Layout Name"
              value={layoutNameDraft}
              onChange={(e) => setLayoutNameDraft(e.target.value)}
              required
            />
            <Select
              label="Rack"
              value={layoutRackDraft}
              onChange={(e) => setLayoutRackDraft(e.target.value)}
              options={racks.map((entry) => ({ value: entry.id, label: `${entry.name} (${entry.rack_units}U)` }))}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setCreateLayoutOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleCreateLayout()}
                disabled={layoutSaving || !layoutNameDraft || !layoutRackDraft}
              >
                {layoutSaving ? 'Creating...' : 'Create Layout'}
              </Button>
            </div>
          </div>
        </Modal>

        <Modal isOpen={renameLayoutOpen} onClose={() => setRenameLayoutOpen(false)} title="Rename Layout">
          <div className="space-y-4">
            <Input
              label="Layout Name"
              value={layoutNameDraft}
              onChange={(e) => setLayoutNameDraft(e.target.value)}
              required
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setRenameLayoutOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void handleRenameLayout()} disabled={layoutSaving || !layoutNameDraft}>
                {layoutSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </Modal>

        <ConfirmDialog
          isOpen={deleteLayoutOpen}
          onClose={() => setDeleteLayoutOpen(false)}
          onConfirm={() => void handleDeleteLayout()}
          title="Delete Layout"
          message={`Delete "${activeLayout.name}" from this project?`}
        />
      </DndProvider>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      <header className="flex items-center justify-between px-4 h-14 bg-slate-900 border-b border-slate-800 shrink-0 z-30" style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}>
        <button onClick={() => navigate('/projects')} className="text-slate-300 text-sm font-semibold">
          ← Back
        </button>
        <div className="flex flex-col items-center min-w-0 px-2">
          <h1 className="text-sm font-bold truncate max-w-[180px]">{project.name}</h1>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest truncate">{activeLayout.name}</span>
        </div>
        <button onClick={() => setIsSheetOpen(true)} className="text-indigo-400 text-sm font-semibold">
          Menu
        </button>
      </header>

      <div className="px-2 py-2 bg-slate-900 border-b border-slate-800 overflow-x-auto shrink-0">
        <div className="inline-flex items-center gap-2">
          {layouts.map((layoutEntry) => (
            <button
              key={layoutEntry.id}
              onClick={() => setActiveLayout(layoutEntry.id)}
              className={`px-3 py-1 rounded-md text-xs whitespace-nowrap border ${
                layoutEntry.id === activeLayout.id
                  ? 'bg-indigo-600 border-indigo-400 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-200'
              }`}
            >
              {layoutEntry.name}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto relative bg-slate-950">
        <div className="fixed right-4 z-20 flex flex-col gap-2" style={{ top: 'calc(7rem + env(safe-area-inset-top))' }}>
          <button
            onClick={cycleRackViewMode}
            className="w-12 h-12 rounded-full bg-indigo-600 shadow-xl flex items-center justify-center border border-indigo-400 text-xs font-bold uppercase"
            title={`Current view: ${activeViewOption.label}`}
          >
            {activeViewOption.shortLabel}
          </button>
        </div>

        {!isSideView && (selectedDeviceTemplate || selectedItemToMove) && (
          <div className="fixed left-1/2 -translate-x-1/2 z-20 bg-indigo-600 px-4 py-2 rounded-full shadow-2xl border border-indigo-400 flex items-center gap-2" style={{ top: 'calc(7rem + env(safe-area-inset-top))' }}>
            <span className="text-xs font-bold">{selectedItemToMove ? 'Tap a slot to move' : 'Tap a slot to place'}</span>
            <button onClick={() => { setSelectedDeviceTemplate(null); setSelectedItemToMove(null); setMobileOffsetDraft('0') }} className="text-xs">✕</button>
          </div>
        )}

        {placementHint && !isSideView && (
          <div className="fixed left-1/2 -translate-x-1/2 z-20 w-[calc(100%-2rem)] max-w-[380px] rounded-lg border border-amber-400 bg-amber-100 px-3 py-2 text-[11px] font-semibold text-amber-900 shadow-lg" style={{ top: 'calc(10rem + env(safe-area-inset-top))' }}>
            {placementHint}
          </div>
        )}

        {isDualRack && !isSideView && (
          <div className="px-5 pt-3 pb-1">
            <div className="max-w-[360px] mx-auto flex items-center justify-between gap-2 text-xs">
              <button
                onClick={() => setMobileDualLane(0)}
                className={`px-3 py-1.5 rounded-lg border transition ${
                  mobileDualLane === 0
                    ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100'
                    : 'border-slate-700 bg-slate-900 text-slate-300'
                }`}
              >
                Left half
              </button>
              <span className="text-slate-400 uppercase tracking-wide">Dual rack view</span>
              <button
                onClick={() => setMobileDualLane(1)}
                className={`px-3 py-1.5 rounded-lg border transition ${
                  mobileDualLane === 1
                    ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100'
                    : 'border-slate-700 bg-slate-900 text-slate-300'
                }`}
              >
                Right half
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-center p-5 min-h-full" style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom))' }}>
          {isSideView ? (
            <div className="w-full max-w-[360px]">
              <RackSideDepthView
                rack={rack}
                items={items}
                side={viewMode}
                showDeviceDetails={showDeviceNames}
                compact
              />
              <p className="mt-3 text-[11px] text-slate-500 text-center">
                Side views are read-only. Switch to Front or Rear to place or move devices.
              </p>
            </div>
          ) : (
            <div className="relative w-full max-w-[360px]">
              <div className="bg-slate-900 rounded-t-xl border-x-[10px] border-t-[10px] border-slate-800 shadow-2xl">
                {slots.map((u) => (
                  <div
                    key={u}
                    className="h-10 border-b border-slate-800/70 relative flex items-center transition-colors"
                  >
                    <div className="w-8 text-[10px] font-mono text-slate-500 flex items-center justify-center border-r border-slate-800 bg-slate-900/50 h-full">
                      {u}
                    </div>

                    <div className="flex-1 h-full relative">
                      {Array.from({ length: mobileColumnCount }, (_, colIndex) => {
                        const visualColIndex = mobileLaneOffset + colIndex
                        const cellEntry = getDeviceAtU(u, visualColIndex)
                        const item = cellEntry?.item
                        const isGhost = cellEntry?.isGhost ?? false
                        const topU = item ? getTopU(item) : null
                        const isTop = item && topU === u

                        // Compute which column this device's slot starts in (for multi-column spanning)
                        const itemSlot = item && rack
                          ? (
                            isGhost
                              ? (mobileGhostSlotAssignments.get(item.id) ?? getItemSlot(item, rack.width))
                              : (mobileSlotAssignments.get(item.id) ?? getItemSlot(item, rack.width))
                          )
                          : null
                        const colWidthPct = 100 / mobileColumnCount
                        const { startCol, spanCols } = itemSlot && rack
                          ? (() => {
                            const { left, width } = getSlotStyle(itemSlot, rack.width, facing)
                            return computeMobileColumnRange(left, width, rack.width)
                          })()
                          : { startCol: visualColIndex, spanCols: 1 }
                        const isLeadCol = visualColIndex === startCol
                        const visibleSpanCols = Math.max(0, Math.min(spanCols, mobileColumnCount - colIndex))

                        const isSelectableEmpty = (!item || isGhost) && (!!selectedDeviceTemplate || !!selectedItemToMove)
                        const colBaseClass = isSelectableEmpty ? 'bg-indigo-500/15 active:bg-indigo-500/30' : ''
                        const colLeft = `${colIndex * colWidthPct}%`
                        const colWidth = `${colWidthPct}%`

                        const handleColClick = isSelectableEmpty
                          ? () => void (selectedItemToMove ? handleMobileMoveToSlot(u, visualColIndex) : handleMobileSlotClick(u, visualColIndex))
                          : item && !isGhost
                            ? () => {
                                if (selectedItemToMove === item.id) {
                                  setSelectedItemToMove(null)
                                } else {
                                  setSelectedItemToMove(item.id)
                                  setSelectedDeviceTemplate(null)
                                  setMobileOffsetDraft(String(item.rack_ear_offset_mm ?? 0))
                                }
                              }
                            : undefined

                        return (
                          <div
                            key={`${u}-${colIndex}`}
                            className={`absolute top-0 h-full border-r border-slate-800/60 ${colBaseClass}`}
                            style={{ left: colLeft, width: colWidth }}
                            onClick={handleColClick}
                          >
                            {isTop && item && isLeadCol && visibleSpanCols > 0 && (
                              <div
                                className="absolute z-10 p-1"
                                style={{
                                  height: `${item.device.rack_units * 40 - 1}px`,
                                  top: '0px',
                                  left: 0,
                                  width: `${visibleSpanCols * 100}%`,
                                }}
                              >
                                <div
                                  className={`relative w-full h-full rounded overflow-hidden bg-slate-700 border-2 transition-colors ${isGhost ? 'border-slate-400/50 opacity-55 saturate-75' : selectedItemToMove === item.id ? 'border-amber-400 opacity-70' : 'border-indigo-300/70'}`}
                                  style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
                                  onContextMenu={(e) => e.preventDefault()}
                                >
                                  {simplifiedView ? (
                                    <div className="absolute inset-1 pointer-events-none">
                                      <span className="absolute top-0 left-0 max-w-[40%] z-[1] text-[8px] font-bold uppercase text-white truncate">{item.device.brand}</span>
                                      <span className="absolute bottom-0 left-0 max-w-[40%] z-[1] text-[8px] text-slate-400 truncate">{item.device.model}</span>
                                      {item.notes && (
                                        <AutoScaleText
                                          text={item.notes}
                                          className="absolute inset-0 flex items-center justify-center text-center text-slate-300 whitespace-pre-line overflow-hidden break-words"
                                          minFontPx={4}
                                        />
                                      )}
                                      <span className="absolute bottom-0 right-0 max-w-[50%] z-[1] text-[8px] font-semibold text-blue-300 truncate">{item.custom_name?.trim() || ''}</span>
                                    </div>
                                  ) : (
                                    <>
                                      {(() => {
                                        const imageUrl = resolvePlacementImageUrl(item, facing)
                                        return imageUrl ? (
                                          <img
                                            src={imageUrl}
                                            alt={item.custom_name?.trim() || `${item.device.brand} ${item.device.model}`}
                                            className="w-full h-full object-fill"
                                            draggable={false}
                                            onContextMenu={(e) => e.preventDefault()}
                                          />
                                        ) : (
                                          <div className="w-full h-full bg-indigo-500/80" />
                                        )
                                      })()}

                                      {showDeviceNames && (
                                        <div className="absolute inset-0 bg-black/35 p-2 flex flex-col justify-end pointer-events-none">
                                          <p className="text-[9px] uppercase font-black text-indigo-100 truncate">
                                            {item.custom_name?.trim() || `${item.device.brand} ${item.device.model}`}
                                          </p>
                                          {item.custom_name && (
                                            <p className="text-[10px] text-indigo-100 truncate">{item.device.brand} {item.device.model}</p>
                                          )}
                                          {item.notes && <p className="text-[10px] text-indigo-100/90 truncate">{item.notes}</p>}
                                        </div>
                                      )}
                                    </>
                                  )}

                                  {!isGhost && (
                                    <div className="absolute top-1 right-1 flex gap-1 text-[10px]">
                                      <button onClick={(e) => { e.stopPropagation(); setNotesItem(item) }} className="bg-black/45 px-1.5 py-0.5 rounded">N</button>
                                      <button onClick={(e) => { e.stopPropagation(); void removeItem(item.id) }} className="bg-black/45 px-1.5 py-0.5 rounded">✕</button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="h-4 w-full bg-slate-800 rounded-b-xl" />
            </div>
          )}
        </div>
      </main>

      <footer className="bg-slate-900 border-t border-slate-800 flex items-center justify-around shrink-0 z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom)', minHeight: 'calc(4rem + env(safe-area-inset-bottom))' }}>
        <button
          onClick={() => { setActiveTab('devices'); setIsSheetOpen(true) }}
          className={`flex flex-col items-center gap-1 ${selectedDeviceTemplate ? 'text-indigo-400' : 'text-slate-400'}`}
        >
          <span className="text-lg">▦</span>
          <span className="text-[10px] font-bold uppercase">Devices</span>
        </button>

        <div className="relative -top-6">
          <button
            onClick={() => { setActiveTab('devices'); setIsSheetOpen(true) }}
            className="w-14 h-14 bg-indigo-600 rounded-full shadow-xl shadow-indigo-600/30 flex items-center justify-center border-4 border-slate-950 text-2xl"
          >
            +
          </button>
        </div>

        <button
          onClick={() => { setActiveTab('rack'); setIsSheetOpen(true) }}
          className="flex flex-col items-center gap-1 text-slate-400"
        >
          <span className="text-lg">⚙</span>
          <span className="text-[10px] font-bold uppercase">Rack</span>
        </button>
      </footer>

      {isSheetOpen && (
        <div className="fixed inset-0 z-50 flex overflow-hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsSheetOpen(false)} />
          <div className="relative w-80 max-w-[85%] bg-slate-900 h-full shadow-2xl flex flex-col">
            <div
              className="p-4 border-b border-slate-800 flex items-center justify-between"
              style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
            >
              <h2 className="font-bold text-sm uppercase tracking-widest text-slate-400">
                {activeTab === 'devices' ? 'Add Equipment' : 'Rack Settings'}
              </h2>
              <button onClick={() => setIsSheetOpen(false)} className="p-2 text-slate-300">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'devices' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs uppercase text-slate-500 mb-1 font-bold">Category</label>
                    <select
                      value={selectedCategoryId}
                      onChange={(e) => setSelectedCategoryId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm"
                    >
                      <option value="all">All categories</option>
                      {libraryCategories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs uppercase text-slate-500 mb-1 font-bold">Brand</label>
                    <select
                      value={selectedBrand}
                      onChange={(e) => setSelectedBrand(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm"
                    >
                      <option value={ALL_BRAND}>All brands</option>
                      {brands.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  {filteredDevices.map((device) => (
                    <button
                      key={device.id}
                      onClick={() => {
                        setSelectedDeviceTemplate(device.id)
                        setIsSheetOpen(false)
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between ${
                        selectedDeviceTemplate === device.id
                          ? 'bg-indigo-600 border-indigo-400'
                          : 'bg-slate-800 border-slate-700'
                      }`}
                      >
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-400 font-bold uppercase truncate">{device.brand}</p>
                        <p className="text-xs text-slate-300 truncate">{device.model}</p>
                        <p className="text-[10px] text-indigo-200 truncate">{device.category?.name ?? 'Uncategorized'}</p>
                      </div>
                      <div className="bg-slate-950 px-2 py-1 rounded text-[10px] font-mono text-indigo-400 shrink-0">
                        {device.rack_units}U{device.is_half_rack ? ' ½' : ''}
                      </div>
                    </button>
                  ))}
                  {filteredDevices.length === 0 && <p className="text-xs text-slate-400">No devices match your filters.</p>}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 uppercase font-bold">Layouts</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setIsSheetOpen(false); openCreateLayoutModal() }}
                      className="flex-1 py-2 rounded-lg border text-sm border-slate-700 bg-slate-800"
                    >
                      + New
                    </button>
                    <button
                      onClick={() => { setIsSheetOpen(false); openRenameLayoutModal() }}
                      className="flex-1 py-2 rounded-lg border text-sm border-slate-700 bg-slate-800"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => { setIsSheetOpen(false); setDeleteLayoutOpen(true) }}
                      disabled={layouts.length <= 1}
                      className="flex-1 py-2 rounded-lg border text-sm border-red-700/60 bg-red-900/30 text-red-300 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 uppercase font-bold">View</p>
                  <div className="grid grid-cols-2 gap-2">
                    {VIEW_MODE_OPTIONS.map((option) => (
                      <button
                        key={`mobile-view-${option.value}`}
                        onClick={() => setRackViewMode(option.value)}
                        className={`py-2 rounded-lg border text-sm ${
                          viewMode === option.value
                            ? 'border-indigo-400 bg-indigo-500/20'
                            : 'border-slate-700 bg-slate-800'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowDeviceNames((prev) => !prev)}
                    className={`w-full py-2 rounded-lg border text-sm ${
                      showDeviceNames ? 'border-indigo-400 bg-indigo-500/20' : 'border-slate-700 bg-slate-800'
                    }`}
                  >
                    Device names: {showDeviceNames ? 'On' : 'Off'}
                  </button>
                  <button
                    onClick={() => setSimplifiedView((prev) => !prev)}
                    className={`w-full py-2 rounded-lg border text-sm ${
                      simplifiedView ? 'border-indigo-400 bg-indigo-500/20' : 'border-slate-700 bg-slate-800'
                    }`}
                  >
                    Simplified view: {simplifiedView ? 'On' : 'Off'}
                  </button>
                  <button
                    onClick={() => navigate(`/editor/project/${project.id}/print/${activeLayout.id}`)}
                    className="w-full py-2 rounded-lg border text-sm border-slate-700 bg-slate-800"
                  >
                    Print A3 / PDF
                  </button>
                  <button
                    onClick={() => navigate(`/editor/project/${project.id}/print/all`)}
                    disabled={layouts.length <= 1}
                    className="w-full py-2 rounded-lg border text-sm border-slate-700 bg-slate-800 disabled:opacity-40"
                    title={layouts.length <= 1 ? 'Add more layouts to print the full project' : undefined}
                  >
                    Print Full Project
                  </button>
                  <button
                    onClick={() => navigate(`/editor/project/${project.id}/panels`)}
                    className="w-full py-2 rounded-lg border text-sm border-slate-700 bg-slate-800"
                  >
                    Panel Layouts
                  </button>
                  <p className="text-xs text-slate-500">Rack: {rack.name} ({rack.rack_units}U, {rack.width})</p>
                  <p className="text-xs text-slate-500">Total load: {rackTotals.weightKg.toFixed(2)} kg</p>
                  <p className="text-xs text-slate-500">Total power: {rackTotals.powerW} W</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <DeviceNotes
        key={notesItem?.id ?? 'none'}
        item={notesItem}
        onSave={handleSaveNotes}
        onClose={() => setNotesItem(null)}
      />

      <Modal isOpen={createLayoutOpen} onClose={() => setCreateLayoutOpen(false)} title="New Layout">
        <div className="space-y-4">
          <Input
            label="Layout Name"
            value={layoutNameDraft}
            onChange={(e) => setLayoutNameDraft(e.target.value)}
            required
          />
          <Select
            label="Rack"
            value={layoutRackDraft}
            onChange={(e) => setLayoutRackDraft(e.target.value)}
            options={racks.map((entry) => ({ value: entry.id, label: `${entry.name} (${entry.rack_units}U)` }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setCreateLayoutOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreateLayout()} disabled={layoutSaving || !layoutNameDraft || !layoutRackDraft}>
              {layoutSaving ? 'Creating...' : 'Create Layout'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={renameLayoutOpen} onClose={() => setRenameLayoutOpen(false)} title="Rename Layout">
        <div className="space-y-4">
          <Input
            label="Layout Name"
            value={layoutNameDraft}
            onChange={(e) => setLayoutNameDraft(e.target.value)}
            required
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setRenameLayoutOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleRenameLayout()} disabled={layoutSaving || !layoutNameDraft}>
              {layoutSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteLayoutOpen}
        onClose={() => setDeleteLayoutOpen(false)}
        onConfirm={() => void handleDeleteLayout()}
        title="Delete Layout"
        message={`Delete "${activeLayout.name}" from this project?`}
      />
    </div>
  )
}
