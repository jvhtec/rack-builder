import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { TouchBackend } from 'react-dnd-touch-backend'
import { supabase } from '../lib/supabase'
import { useLayoutItems } from '../hooks/useLayoutItems'
import { filterDevicesByCategory, getDeviceImageUrl, useDevices } from '../hooks/useDevices'
import { useLayouts } from '../hooks/useLayouts'
import { useRacks } from '../hooks/useRacks'
import { hasDepthConflict, isWithinBounds } from '../lib/overlap'
import {
  buildSlotAssignments,
  canPlaceAtPosition,
  getItemSlot,
  getSlotStyle,
  preferenceToSlot,
} from '../lib/rackPositions'
import type { DeviceFacing, LayoutItemWithDevice, Project, RackWidth } from '../types'
import DevicePalette from '../components/editor/DevicePalette'
import RackGrid from '../components/editor/RackGrid'
import DeviceNotes from '../components/editor/DeviceNotes'
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
  const [notesItem, setNotesItem] = useState<LayoutItemWithDevice | null>(null)
  const [activeTab, setActiveTab] = useState<'devices' | 'rack'>('devices')
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [selectedDeviceTemplate, setSelectedDeviceTemplate] = useState<string | null>(null)
  const [showDeviceNames, setShowDeviceNames] = useState(true)
  const [isMobile, setIsMobile] = useState<boolean>(() => window.innerWidth < 768)
  const [isTouchLikeDevice, setIsTouchLikeDevice] = useState<boolean>(
    () => window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window,
  )
  const [mobileDualLane, setMobileDualLane] = useState<0 | 1>(0)
  const [selectedCategoryId, setSelectedCategoryId] = useState('all')

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
  const { devices, categories, loading: devicesLoading } = useDevices()

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

  const { items, addItem, removeItem, moveItem, updateItemDetails } = useLayoutItems(
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

  const filteredDevices = useMemo(
    () => filterDevicesByCategory(devices, selectedCategoryId),
    [devices, selectedCategoryId],
  )

  useEffect(() => {
    if (!selectedDeviceTemplate) return
    if (filteredDevices.some((device) => device.id === selectedDeviceTemplate)) return
    setSelectedDeviceTemplate(null)
  }, [filteredDevices, selectedDeviceTemplate])

  const handleDropNew = async (
    deviceId: string,
    startU: number,
    rackUnits: number,
    preferredLane?: 0 | 1,
    preferredSubLane?: 0 | 1,
  ) => {
    try {
      const device = devices.find((d) => d.id === deviceId)
      const allowOverlap = rack?.width === 'dual' || (device?.is_half_rack ?? false)
      await addItem(deviceId, startU, facing, rackUnits, preferredLane, allowOverlap, preferredSubLane)
    } catch (err) {
      console.error('Drop failed:', err)
    }
  }

  const handleDropMove = async (itemId: string, newStartU: number, preferredLane?: 0 | 1, preferredSubLane?: 0 | 1) => {
    try {
      const item = items.find((i) => i.id === itemId)
      const allowOverlap = rack?.width === 'dual' || (item?.device.is_half_rack ?? false)
      await moveItem(itemId, newStartU, facing, preferredLane, allowOverlap, preferredSubLane)
    } catch (err) {
      console.error('Move failed:', err)
    }
  }

  const mobileItems = useMemo(() => items.filter((item) => item.facing === facing), [items, facing])
  const oppositeFacingItems = useMemo(
    () => items.filter((item) => item.facing !== facing),
    [items, facing],
  )
  const showOppositePreview = mobileItems.length === 0 && oppositeFacingItems.length > 0
  const mobileVisibleItems = showOppositePreview ? oppositeFacingItems : mobileItems

  const mobileSlotAssignments = useMemo(
    () => rack ? buildSlotAssignments(mobileVisibleItems, rack.width) : new Map<string, ReturnType<typeof getItemSlot>>(),
    [mobileVisibleItems, rack],
  )

  const getDeviceAtU = useCallback((slotU: number, visualSlotIndex: number) => {
    if (!rack) return undefined
    return mobileVisibleItems.find((item) => {
      if (slotU < item.start_u || slotU > getTopU(item)) return false
      const slot = mobileSlotAssignments.get(item.id) ?? getItemSlot(item, rack.width)
      const { left, width } = getSlotStyle(slot, rack.width, facing)
      const { startCol, endCol } = computeMobileColumnRange(left, width, rack.width)
      return visualSlotIndex >= startCol && visualSlotIndex <= endCol
    })
  }, [mobileVisibleItems, mobileSlotAssignments, rack, facing])

  const handleMobileSlotClick = async (slotU: number, colIndex: number) => {
    if (!selectedDeviceTemplate || !rack) return
    const device = devices.find((entry) => entry.id === selectedDeviceTemplate)
    if (!device) return

    if (!isWithinBounds(slotU, device.rack_units, rack.rack_units)) return
    if (hasDepthConflict(slotU, device.rack_units, facing, device.depth_mm, items, rack.depth_mm)) return

    const { preferredLane, preferredSubLane } = visualColToLanePreference(
      colIndex, rack.width, facing, device.is_half_rack,
    )
    const targetSlot = preferenceToSlot(rack.width, device.is_half_rack, preferredLane, preferredSubLane)
    if (!canPlaceAtPosition(slotU, device.rack_units, targetSlot, mobileItems, rack.width)) return

    try {
      const allowOverlap = rack.width === 'dual' || device.is_half_rack
      await addItem(device.id, slotU, facing, device.rack_units, preferredLane, allowOverlap, preferredSubLane)
      setSelectedDeviceTemplate(null)
    } catch (err) {
      console.error('Tap placement failed:', err)
    }
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
    updates: Partial<{ notes: string; custom_name: string | null; force_full_width: boolean }>,
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
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onCategoryChange={setSelectedCategoryId}
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
                    variant={facing === 'front' ? 'primary' : 'secondary'}
                    onClick={() => setFacing('front')}
                  >
                    Front
                  </Button>
                  <Button
                    variant={facing === 'rear' ? 'primary' : 'secondary'}
                    onClick={() => setFacing('rear')}
                  >
                    Rear
                  </Button>
                  <Button
                    variant={showDeviceNames ? 'primary' : 'secondary'}
                    onClick={() => setShowDeviceNames((prev) => !prev)}
                  >
                    Labels {showDeviceNames ? 'On' : 'Off'}
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
            </div>

            <div className="flex-1 overflow-auto flex items-start justify-center p-10">
              <RackGrid
                rack={rack}
                items={items}
                facing={facing}
                showDeviceDetails={showDeviceNames}
                onDropNew={handleDropNew}
                onDropMove={handleDropMove}
                onRemove={removeItem}
                onEditNotes={setNotesItem}
              />
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
      <header className="flex items-center justify-between px-4 h-14 bg-slate-900 border-b border-slate-800 shrink-0 z-30">
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
          <button
            onClick={openCreateLayoutModal}
            className="px-3 py-1 rounded-md text-xs whitespace-nowrap border bg-slate-800 border-slate-700 text-slate-200"
          >
            + Layout
          </button>
          <button
            onClick={openRenameLayoutModal}
            className="px-3 py-1 rounded-md text-xs whitespace-nowrap border bg-slate-800 border-slate-700 text-slate-200"
          >
            Rename
          </button>
          <button
            onClick={() => setDeleteLayoutOpen(true)}
            disabled={layouts.length <= 1}
            className="px-3 py-1 rounded-md text-xs whitespace-nowrap border bg-red-600/70 border-red-400/50 text-white disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto relative bg-slate-950">
        <div className="fixed top-28 right-4 z-20 flex flex-col gap-2">
          <button
            onClick={() => setFacing(facing === 'front' ? 'rear' : 'front')}
            className="w-12 h-12 rounded-full bg-indigo-600 shadow-xl flex items-center justify-center border border-indigo-400 text-xs font-bold uppercase"
          >
            {facing === 'front' ? 'F' : 'R'}
          </button>
        </div>

        {selectedDeviceTemplate && (
          <div className="fixed top-28 left-1/2 -translate-x-1/2 z-20 bg-indigo-600 px-4 py-2 rounded-full shadow-2xl border border-indigo-400 flex items-center gap-2">
            <span className="text-xs font-bold">Tap a slot to place</span>
            <button onClick={() => setSelectedDeviceTemplate(null)} className="text-xs">✕</button>
          </div>
        )}

        {isDualRack && (
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

        <div className="flex justify-center p-5 pb-28 min-h-full">
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
                      const item = getDeviceAtU(u, visualColIndex)
                      const topU = item ? getTopU(item) : null
                      const isTop = item && topU === u

                      // Compute which column this device's slot starts in (for multi-column spanning)
                      const itemSlot = item && rack
                        ? (mobileSlotAssignments.get(item.id) ?? getItemSlot(item, rack.width))
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

                      const isSelectableEmpty = !item && selectedDeviceTemplate
                      const colBaseClass = isSelectableEmpty ? 'bg-indigo-500/15 active:bg-indigo-500/30' : ''
                      const colLeft = `${colIndex * colWidthPct}%`
                      const colWidth = `${colWidthPct}%`

                      return (
                        <div
                          key={`${u}-${colIndex}`}
                          className={`absolute top-0 h-full border-r border-slate-800/60 ${colBaseClass}`}
                          style={{ left: colLeft, width: colWidth }}
                          onClick={isSelectableEmpty ? () => void handleMobileSlotClick(u, visualColIndex) : undefined}
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
                              <div className="relative w-full h-full rounded border border-indigo-300/70 overflow-hidden bg-slate-700">
                                {(() => {
                                  const imagePath = facing === 'front'
                                    ? item.device.front_image_path
                                    : item.device.rear_image_path
                                  const imageUrl = getDeviceImageUrl(imagePath)
                                  return imageUrl ? (
                                    <img
                                      src={imageUrl}
                                      alt={item.custom_name?.trim() || `${item.device.brand} ${item.device.model}`}
                                      className="w-full h-full object-fill"
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

                                {!showOppositePreview && (
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
        </div>
      </main>

      <footer className="h-16 bg-slate-900 border-t border-slate-800 flex items-center justify-around shrink-0 z-30">
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
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
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
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
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
                  {filteredDevices.length === 0 && <p className="text-xs text-slate-400">No devices in this category.</p>}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 uppercase font-bold">Facing</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFacing('front')}
                      className={`flex-1 py-2 rounded-lg border text-sm ${
                        facing === 'front' ? 'border-indigo-400 bg-indigo-500/20' : 'border-slate-700 bg-slate-800'
                      }`}
                    >
                      Front
                    </button>
                    <button
                      onClick={() => setFacing('rear')}
                      className={`flex-1 py-2 rounded-lg border text-sm ${
                        facing === 'rear' ? 'border-indigo-400 bg-indigo-500/20' : 'border-slate-700 bg-slate-800'
                      }`}
                    >
                      Rear
                    </button>
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
                    onClick={() => navigate(`/editor/project/${project.id}/print/${activeLayout.id}`)}
                    className="w-full py-2 rounded-lg border text-sm border-slate-700 bg-slate-800"
                  >
                    Print A3 / PDF
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
