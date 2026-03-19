import { useCallback, useState } from 'react'
import type { DeviceFacing, LayoutItemWithDevice, PanelLayout, Rack } from '../types'
import { isWithinBounds } from '../lib/overlap'
import { canPlaceAtPosition, getItemSlot } from '../lib/rackPositions'
import { visualColToLanePreference, toErrorMessage } from '../lib/rackHelpers'
import { parsePanelTemplateId } from './useDeviceFiltering'

interface UseMobilePlacementParams {
  rack: Rack | null
  items: LayoutItemWithDevice[]
  devices: { id: string; rack_units: number; is_half_rack: boolean; depth_mm: number }[]
  panelLayouts: PanelLayout[]
  facing: DeviceFacing
  selectedDeviceTemplate: string | null
  setSelectedDeviceTemplate: (id: string | null) => void
  addItem: (deviceId: string, startU: number, facing: DeviceFacing, rackUnits: number, preferredLane?: 0 | 1, preferredSubLane?: 0 | 1) => Promise<void>
  addPanelLayoutItem: (panelLayoutId: string, startU: number, facing: DeviceFacing, heightRu: number, preferredLane?: 0 | 1, preferredSubLane?: 0 | 1) => Promise<void>
  moveItem: (itemId: string, newStartU: number, facing: DeviceFacing, preferredLane?: 0 | 1, preferredSubLane?: 0 | 1) => Promise<void>
  updateItemDetails: (itemId: string, updates: Partial<{ notes: string; custom_name: string | null; force_full_width: boolean; rack_ear_offset_mm: number }>) => Promise<void>
  getPlacementIssue: (
    slotU: number, rackUnits: number, isHalfRack: boolean, forceFullWidth: boolean,
    depthMm: number, rackEarOffsetMm?: number, excludeItemId?: string,
    preferredLane?: 0 | 1, preferredSubLane?: 0 | 1,
  ) => string | null
  haptic: (type: string) => void
}

export function useMobilePlacement(params: UseMobilePlacementParams) {
  const {
    rack, items, devices, panelLayouts, facing,
    selectedDeviceTemplate, setSelectedDeviceTemplate,
    addItem, addPanelLayoutItem, moveItem,
    getPlacementIssue, haptic,
  } = params

  const [placementErrorHint, setPlacementErrorHint] = useState<string | null>(null)
  const [hoverPlacementHint, setHoverPlacementHint] = useState<string | null>(null)
  const placementHint = placementErrorHint ?? hoverPlacementHint

  const showBackendPlacementReject = useCallback((actionLabel: string, error: unknown) => {
    const message = toErrorMessage(error)
    haptic('error')
    setPlacementErrorHint(`${actionLabel} rejected by backend: ${message}`)
  }, [haptic])

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
          panelLayoutId, startU, facing, panelLayout.height_ru,
          preferredLane, preferredSubLane,
        )
        return
      }
      await addItem(deviceId, startU, facing, rackUnits, preferredLane, preferredSubLane)
    } catch (err) {
      console.error('Drop failed:', err)
      showBackendPlacementReject('Placement', err)
    }
  }

  const handleDropMove = async (itemId: string, newStartU: number, preferredLane?: 0 | 1, preferredSubLane?: 0 | 1) => {
    setPlacementErrorHint(null)
    try {
      await moveItem(itemId, newStartU, facing, preferredLane, preferredSubLane)
    } catch (err) {
      console.error('Move failed:', err)
      showBackendPlacementReject('Move', err)
    }
  }

  const handleMobileSlotClick = async (slotU: number, colIndex: number) => {
    if (!selectedDeviceTemplate || !rack) return
    const panelTemplateId = parsePanelTemplateId(selectedDeviceTemplate)
    if (panelTemplateId) {
      const panelLayout = panelLayouts.find((entry) => entry.id === panelTemplateId)
      if (!panelLayout) return
      const panelDepthMm = panelLayout.depth_mm
      if (!isWithinBounds(slotU, panelLayout.height_ru, rack.rack_units)) {
        haptic('error')
        setPlacementErrorHint(`Out of rack bounds: U${slotU} with ${panelLayout.height_ru}U in a ${rack.rack_units}U rack.`)
        return
      }

      const { preferredLane, preferredSubLane } = visualColToLanePreference(
        colIndex, rack.width, facing, false,
      )
      const issue = getPlacementIssue(
        slotU, panelLayout.height_ru, false, false, panelDepthMm, 0,
        undefined, preferredLane, preferredSubLane,
      )
      if (issue) {
        haptic('error')
        setPlacementErrorHint(issue)
        return
      }

      try {
        await addPanelLayoutItem(panelTemplateId, slotU, facing, panelLayout.height_ru, preferredLane, preferredSubLane)
        haptic('success')
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
      haptic('error')
      setPlacementErrorHint(`Out of rack bounds: U${slotU} with ${device.rack_units}U in a ${rack.rack_units}U rack.`)
      return
    }

    const { preferredLane, preferredSubLane } = visualColToLanePreference(
      colIndex, rack.width, facing, device.is_half_rack,
    )
    const issue = getPlacementIssue(
      slotU, device.rack_units, device.is_half_rack, false, device.depth_mm, 0,
      undefined, preferredLane, preferredSubLane,
    )
    if (issue) {
      haptic('error')
      setPlacementErrorHint(issue)
      return
    }

    try {
      await addItem(device.id, slotU, facing, device.rack_units, preferredLane, preferredSubLane)
      haptic('success')
      setSelectedDeviceTemplate(null)
      setPlacementErrorHint(null)
    } catch (err) {
      console.error('Tap placement failed:', err)
      showBackendPlacementReject('Placement', err)
    }
  }

  const handleMobileMoveToSlot = async (selectedItemToMove: string, slotU: number, colIndex: number) => {
    if (!rack) return
    const item = items.find((i) => i.id === selectedItemToMove)
    if (!item) return

    if (!isWithinBounds(slotU, item.device.rack_units, rack.rack_units)) {
      haptic('error')
      setPlacementErrorHint(`Out of rack bounds: U${slotU} with ${item.device.rack_units}U in a ${rack.rack_units}U rack.`)
      return
    }

    const { preferredLane, preferredSubLane } = visualColToLanePreference(
      colIndex, rack.width, facing, item.device.is_half_rack,
    )
    const issue = getPlacementIssue(
      slotU, item.device.rack_units, item.device.is_half_rack, item.force_full_width,
      item.device.depth_mm, item.rack_ear_offset_mm, selectedItemToMove,
      preferredLane, preferredSubLane,
    )
    if (issue) {
      haptic('error')
      setPlacementErrorHint(issue)
      return
    }

    try {
      await moveItem(selectedItemToMove, slotU, facing, preferredLane, preferredSubLane)
      haptic('success')
      setPlacementErrorHint(null)
      return true // signal success for caller to clear selection
    } catch (err) {
      console.error('Tap move failed:', err)
      showBackendPlacementReject('Move', err)
    }
    return false
  }

  const handleSaveNotes = async (
    itemId: string,
    updates: Partial<{ notes: string; custom_name: string | null; force_full_width: boolean; rack_ear_offset_mm: number }>,
  ) => {
    const item = items.find((i) => i.id === itemId)

    if (updates.force_full_width === true && rack && item?.device.is_half_rack) {
      const widenedSlot = getItemSlot({ ...item, force_full_width: true }, rack.width)
      const sameFacing = items.filter((i) => i.id !== itemId && i.facing === item.facing)
      if (!canPlaceAtPosition(item.start_u, item.device.rack_units, widenedSlot, sameFacing, rack.width)) {
        throw new Error('Cannot span full width: another device occupies the adjacent half-rack slot at this position.')
      }
    }

    if (item && typeof updates.rack_ear_offset_mm === 'number' && updates.rack_ear_offset_mm !== item.rack_ear_offset_mm) {
      const issue = getPlacementIssue(
        item.start_u, item.device.rack_units, item.device.is_half_rack,
        updates.force_full_width ?? item.force_full_width, item.device.depth_mm,
        updates.rack_ear_offset_mm, item.id,
        item.preferred_lane ?? undefined, item.preferred_sub_lane ?? undefined,
      )
      if (issue) throw new Error(issue)
    }

    return params.updateItemDetails(itemId, updates)
  }

  return {
    placementErrorHint,
    setPlacementErrorHint,
    hoverPlacementHint,
    setHoverPlacementHint,
    placementHint,
    showBackendPlacementReject,
    handleDropNew,
    handleDropMove,
    handleMobileSlotClick,
    handleMobileMoveToSlot,
    handleSaveNotes,
  }
}
