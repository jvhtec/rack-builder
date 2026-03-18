import { useEffect, useState } from 'react'
import type { LayoutItemWithDevice } from '../types'

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

export function useMobileItemEditor(params: {
  items: LayoutItemWithDevice[]
  updateItemDetails: (
    itemId: string,
    updates: Partial<{ notes: string; custom_name: string | null; force_full_width: boolean; rack_ear_offset_mm: number }>,
  ) => Promise<void>
  removeItem: (id: string) => Promise<void>
  getPlacementIssue: (
    slotU: number,
    rackUnits: number,
    isHalfRack: boolean,
    forceFullWidth: boolean,
    depthMm: number,
    rackEarOffsetMm: number,
    excludeItemId?: string,
    preferredLane?: 0 | 1,
    preferredSubLane?: 0 | 1,
  ) => string | null
}) {
  const { items, updateItemDetails, removeItem, getPlacementIssue } = params

  const [selectedItemToMove, setSelectedItemToMove] = useState<string | null>(null)
  const [mobileOffsetDraft, setMobileOffsetDraft] = useState('0')
  const [mobileNameDraft, setMobileNameDraft] = useState('')
  const [mobileNotesDraft, setMobileNotesDraft] = useState('')
  const [mobileEditorError, setMobileEditorError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedItemToMove) {
      setMobileOffsetDraft('0')
      setMobileNameDraft('')
      setMobileNotesDraft('')
      setMobileEditorError(null)
      return
    }

    const selectedItem = items.find((entry) => entry.id === selectedItemToMove)
    if (!selectedItem) return

    setMobileOffsetDraft(String(selectedItem.rack_ear_offset_mm ?? 0))
    setMobileNameDraft(selectedItem.custom_name ?? '')
    setMobileNotesDraft(selectedItem.notes ?? '')
    setMobileEditorError(null)
  }, [items, selectedItemToMove])

  const handleMobileOffsetSave = async () => {
    if (!selectedItemToMove) return

    const selectedItem = items.find((entry) => entry.id === selectedItemToMove)
    if (!selectedItem) return

    const offset = Number(mobileOffsetDraft)
    if (!Number.isFinite(offset)) {
      setMobileEditorError('Rack ear offset must be a valid number.')
      return
    }
    if (offset < 0) {
      setMobileEditorError('Rack ear offset cannot be negative.')
      return
    }

    const normalizedOffset = Math.round(offset * 10) / 10
    const issue = getPlacementIssue(
      selectedItem.start_u,
      selectedItem.device.rack_units,
      selectedItem.device.is_half_rack,
      selectedItem.force_full_width,
      selectedItem.device.depth_mm,
      normalizedOffset,
      selectedItem.id,
      selectedItem.preferred_lane ?? undefined,
      selectedItem.preferred_sub_lane ?? undefined,
    )
    if (issue) {
      setMobileEditorError(issue)
      return
    }

    try {
      await updateItemDetails(selectedItemToMove, {
        custom_name: mobileNameDraft.trim() || null,
        notes: mobileNotesDraft,
        rack_ear_offset_mm: normalizedOffset,
      })
      setMobileEditorError(null)
    } catch (err) {
      console.error('Save failed:', err)
      setMobileEditorError(toErrorMessage(err))
    }
  }

  const handleMobileDeleteItem = async () => {
    if (!selectedItemToMove) return
    try {
      await removeItem(selectedItemToMove)
      setSelectedItemToMove(null)
      setMobileEditorError(null)
    } catch (err) {
      console.error('Delete failed:', err)
      setMobileEditorError(toErrorMessage(err))
    }
  }

  return {
    selectedItemToMove,
    setSelectedItemToMove,
    mobileOffsetDraft,
    setMobileOffsetDraft,
    mobileNameDraft,
    setMobileNameDraft,
    mobileNotesDraft,
    setMobileNotesDraft,
    mobileEditorError,
    setMobileEditorError,
    handleMobileOffsetSave,
    handleMobileDeleteItem,
  }
}
