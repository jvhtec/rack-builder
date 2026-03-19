import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { TouchBackend } from 'react-dnd-touch-backend'
import { useLayoutItems } from '../hooks/useLayoutItems'
import { ALL_BRAND, useDevices } from '../hooks/useDevices'
import { usePanelLayouts } from '../hooks/usePanelLayouts'
import { useLayouts } from '../hooks/useLayouts'
import { useRacks } from '../hooks/useRacks'
import { useConnectors } from '../hooks/useConnectors'
import DevicePalette from '../components/editor/DevicePalette'
import RackGrid from '../components/editor/RackGrid'
import RackSideDepthView from '../components/editor/RackSideDepthView'
import MobileRackGrid from '../components/editor/MobileRackGrid'
import DeviceNotes from '../components/editor/DeviceNotes'
import Button from '../components/ui/Button'
import { useHaptic } from '../contexts/HapticContext'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import { useTheme } from '../hooks/useTheme'
import ThemeToggle from '../components/ui/ThemeToggle'
import { useResponsiveLayout } from '../hooks/useResponsiveLayout'
import { useRackViewState, VIEW_MODE_OPTIONS, MIN_ZOOM_PERCENT, MAX_ZOOM_PERCENT } from '../hooks/useRackViewState'
import { useDeviceFiltering } from '../hooks/useDeviceFiltering'
import { useLayoutCrud } from '../hooks/useLayoutCrud'
import { useMobileItemEditor } from '../hooks/useMobileItemEditor'
import { useProject } from '../hooks/useProject'
import { usePlacement } from '../hooks/usePlacement'
import { useMobilePlacement } from '../hooks/useMobilePlacement'
import type { LayoutItemWithDevice } from '../types'

export default function LayoutEditorPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isDark, toggle } = useTheme()

  const [notesItem, setNotesItem] = useState<LayoutItemWithDevice | null>(null)
  const [activeTab, setActiveTab] = useState<'devices' | 'rack'>('devices')
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const { trigger: haptic } = useHaptic()
  const [mobileDualLane, setMobileDualLane] = useState<0 | 1>(0)

  const { isMobile, isTouchLikeDevice } = useResponsiveLayout()
  const {
    facing, viewMode, showDeviceNames, setShowDeviceNames,
    simplifiedView, setSimplifiedView, zoomPercent, isSideView, zoomFactor,
    canZoomIn, canZoomOut, activeViewOption, setRackViewMode,
    cycleRackViewMode, handleZoomIn, handleZoomOut, handleZoomReset,
  } = useRackViewState()

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

  const {
    selectedDeviceTemplate, setSelectedDeviceTemplate, selectedCategoryId, setSelectedCategoryId,
    selectedBrand, setSelectedBrand, searchQuery, setSearchQuery,
    filteredDevices, libraryCategories, brands,
  } = useDeviceFiltering(devices, categories, panelLayouts, connectorById)

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

  const {
    mobileItems, mobileSlotAssignments,
    mobileGhostSlotAssignments,
    getPlacementIssue, getDeviceAtU,
  } = usePlacement({ rack, items, facing })

  const {
    placementHint, setPlacementErrorHint,
    setHoverPlacementHint,
    handleDropNew, handleDropMove,
    handleMobileSlotClick,
    handleMobileMoveToSlot: handleMobileMoveToSlotBase,
    handleSaveNotes,
  } = useMobilePlacement({
    rack, items, devices, panelLayouts, facing,
    selectedDeviceTemplate, setSelectedDeviceTemplate,
    addItem, addPanelLayoutItem, moveItem, removeItem, updateItemDetails,
    getPlacementIssue, haptic,
  })

  const {
    selectedItemToMove, setSelectedItemToMove, mobileOffsetDraft, setMobileOffsetDraft,
    mobileNameDraft, setMobileNameDraft, mobileNotesDraft, setMobileNotesDraft,
    mobileEditorError, setMobileEditorError, handleMobileOffsetSave: handleMobileOffsetSaveBase,
    handleMobileDeleteItem,
  } = useMobileItemEditor({ items, updateItemDetails, removeItem, getPlacementIssue })

  useEffect(() => {
    if (!isSideView) return
    if (selectedDeviceTemplate) setSelectedDeviceTemplate(null)
    if (selectedItemToMove) setSelectedItemToMove(null)
  }, [isSideView, selectedDeviceTemplate, selectedItemToMove, setSelectedDeviceTemplate, setSelectedItemToMove])

  useEffect(() => {
    if (!isSideView) return
    setPlacementErrorHint(null)
    setHoverPlacementHint(null)
  }, [isSideView, setPlacementErrorHint, setHoverPlacementHint])

  const handleMobileOffsetSave = async () => {
    await handleMobileOffsetSaveBase()
    setPlacementErrorHint(null)
  }

  const handleMobileMoveToSlot = async (slotU: number, colIndex: number) => {
    if (!selectedItemToMove) return
    const success = await handleMobileMoveToSlotBase(selectedItemToMove, slotU, colIndex)
    if (success) setSelectedItemToMove(null)
  }

  const {
    createLayoutOpen, setCreateLayoutOpen, renameLayoutOpen, setRenameLayoutOpen,
    deleteLayoutOpen, setDeleteLayoutOpen, layoutNameDraft, setLayoutNameDraft,
    layoutRackDraft, setLayoutRackDraft, layoutSaving,
    openCreateLayoutModal, openRenameLayoutModal,
    handleCreateLayout, handleRenameLayout, handleDeleteLayout,
  } = useLayoutCrud({
    projectId, activeLayout, layouts, racks, rack,
    createLayout, updateLayout, deleteLayout, setActiveLayout,
  })

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
        <div className="flex h-screen bg-gray-100 dark:bg-gray-950">
          <DevicePalette
            devices={filteredDevices}
            categories={libraryCategories}
            selectedCategoryId={selectedCategoryId}
            onCategoryChange={setSelectedCategoryId}
            brands={brands}
            selectedBrand={selectedBrand}
            onBrandChange={setSelectedBrand}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            loading={devicesLoading}
          />

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3 shrink-0">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <Button variant="secondary" onClick={() => navigate('/projects')}>
                    &larr; Back
                  </Button>
                  <div className="min-w-0">
                    <h1 className="text-xl font-semibold dark:text-white truncate">{project.name}</h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {activeLayout.name} | {rack.name} ({rack.rack_units}U) | {rackTotals.weightKg.toFixed(2)} kg | {rackTotals.powerW} W
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/editor/project/${project.id}/print/${activeLayout.id}`)}
                  >
                    Export A3 PDF
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
                    title={layouts.length <= 1 ? 'Add more layouts to export the full project PDF' : undefined}
                  >
                    Export Full Project PDF
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
                    <div className="inline-flex items-center overflow-hidden rounded-md border border-gray-300 dark:border-gray-600">
                      <button
                        type="button"
                        onClick={handleZoomOut}
                        disabled={!canZoomOut}
                        className="h-11 w-9 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={`Zoom out (${MIN_ZOOM_PERCENT}% min)`}
                        aria-label="Zoom out"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={handleZoomReset}
                        className="h-11 min-w-16 border-x border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 text-xs font-semibold text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600"
                        title="Reset zoom to 100%"
                        aria-label="Reset zoom"
                      >
                        {zoomPercent}%
                      </button>
                      <button
                        type="button"
                        onClick={handleZoomIn}
                        disabled={!canZoomIn}
                        className="h-11 w-9 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={`Zoom in (${MAX_ZOOM_PERCENT}% max)`}
                        aria-label="Zoom in"
                      >
                        +
                      </button>
                    </div>
                    <div className="ml-2 pl-4 border-l border-gray-200 dark:border-gray-700">
                      <ThemeToggle isDark={isDark} toggle={toggle} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" />
                    </div>
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
                  side={viewMode as 'left' | 'right'}
                  zoom={zoomFactor}
                  showDeviceDetails={showDeviceNames}
                />
              ) : (
                <RackGrid
                  rack={rack}
                  items={items}
                  connectorById={connectorById}
                  facing={facing}
                  zoom={zoomFactor}
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
    <div className="flex flex-col h-screen bg-white dark:bg-slate-950 text-gray-900 dark:text-slate-100 overflow-hidden">
      <header className="flex items-center justify-between px-4 h-14 bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shrink-0 z-30" style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}>
        <button onClick={() => navigate('/projects')} className="text-gray-600 dark:text-slate-300 text-sm font-semibold">
          &larr; Back
        </button>
        <div className="flex flex-col items-center min-w-0 px-2">
          <h1 className="text-sm font-bold truncate max-w-[150px] dark:text-white">{project.name}</h1>
          <span className="text-[10px] text-gray-500 dark:text-slate-500 uppercase tracking-widest truncate">{activeLayout.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle isDark={isDark} toggle={toggle} className="text-gray-500 dark:text-slate-400" />
        </div>
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

        {!isSideView && selectedItemToMove && (() => {
          const selectedItem = items.find((entry) => entry.id === selectedItemToMove)
          if (!selectedItem) return null
          const selectedLabel = selectedItem.custom_name?.trim() || `${selectedItem.device.brand} ${selectedItem.device.model}`
          return (
            <div className="fixed left-1/2 -translate-x-1/2 z-20 w-[calc(100%-2rem)] max-w-[380px] rounded-xl border border-indigo-400 bg-slate-900/95 px-3 py-2 shadow-2xl" style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}>
              <div className="mb-2 text-[11px] font-semibold text-indigo-100 truncate">Edit · {selectedLabel}</div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={mobileNameDraft}
                  onChange={(e) => { setMobileNameDraft(e.target.value); if (mobileEditorError) setMobileEditorError(null) }}
                  placeholder="Custom name"
                  className="w-full min-h-9 rounded-md border border-slate-600 bg-slate-800 px-2 text-xs text-slate-100"
                />
                <textarea
                  value={mobileNotesDraft}
                  onChange={(e) => { setMobileNotesDraft(e.target.value); if (mobileEditorError) setMobileEditorError(null) }}
                  placeholder="Notes"
                  className="w-full h-16 rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-100"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={mobileOffsetDraft}
                    onChange={(e) => { setMobileOffsetDraft(e.target.value); if (mobileEditorError) setMobileEditorError(null) }}
                    className="w-full min-h-9 rounded-md border border-slate-600 bg-slate-800 px-2 text-xs text-slate-100"
                    placeholder="Offset (mm)"
                  />
                  <button
                    onClick={() => void handleMobileOffsetSave()}
                    className="min-h-9 rounded-md border border-indigo-300 bg-indigo-600 px-3 text-xs font-semibold text-white"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => void handleMobileDeleteItem()}
                    className="min-h-9 rounded-md border border-red-500/70 bg-red-700/70 px-3 text-xs font-semibold text-white"
                  >
                    Delete
                  </button>
                </div>
                {mobileEditorError && <p className="text-[11px] text-amber-300">{mobileEditorError}</p>}
              </div>
            </div>
          )
        })()}

        {placementHint && !isSideView && (
          <div className="fixed left-1/2 -translate-x-1/2 z-20 w-[calc(100%-2rem)] max-w-[380px] rounded-lg border border-amber-400 bg-amber-100 px-3 py-2 text-[11px] font-semibold text-amber-900 shadow-lg" style={{ top: 'calc(10.5rem + env(safe-area-inset-top))' }}>
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

        <div className="flex justify-center p-5 min-h-full" style={{ paddingBottom: selectedItemToMove ? 'calc(21rem + env(safe-area-inset-bottom))' : 'calc(7rem + env(safe-area-inset-bottom))' }}>
          {isSideView ? (
            <div className="w-full max-w-[360px]">
              <RackSideDepthView
                rack={rack}
                items={items}
                side={viewMode as 'left' | 'right'}
                showDeviceDetails={showDeviceNames}
                compact
              />
              <p className="mt-3 text-[11px] text-slate-500 text-center">
                Side views are read-only. Switch to Front or Rear to place or move devices.
              </p>
            </div>
          ) : (
            <MobileRackGrid
              rack={rack}
              slots={slots}
              facing={facing}
              mobileColumnCount={mobileColumnCount}
              mobileLaneOffset={mobileLaneOffset}
              showDeviceNames={showDeviceNames}
              simplifiedView={simplifiedView}
              selectedDeviceTemplate={selectedDeviceTemplate}
              selectedItemToMove={selectedItemToMove}
              getDeviceAtU={getDeviceAtU}
              mobileSlotAssignments={mobileSlotAssignments}
              mobileGhostSlotAssignments={mobileGhostSlotAssignments}
              onSlotClick={(u, col) => void handleMobileSlotClick(u, col)}
              onMoveToSlot={(u, col) => void handleMobileMoveToSlot(u, col)}
              onItemSelect={(id) => {
                if (id) {
                  setSelectedItemToMove(id)
                  setSelectedDeviceTemplate(null)
                } else {
                  setSelectedItemToMove(null)
                }
              }}
              onDeselectTemplate={() => setSelectedDeviceTemplate(null)}
              haptic={haptic}
            />
          )}
        </div>
      </main>

      <footer className="bg-slate-900 border-t border-slate-800 flex items-center justify-around shrink-0 z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom)', minHeight: 'calc(4rem + env(safe-area-inset-bottom))' }}>
        <button
          onClick={() => { setActiveTab('devices'); setIsSheetOpen(true) }}
          className={`flex flex-col items-center gap-1 px-6 py-2 ${selectedDeviceTemplate ? 'text-indigo-400' : 'text-slate-400'}`}
        >
          <span className="text-lg">▦</span>
          <span className="text-[10px] font-bold uppercase">Devices</span>
        </button>

        <button
          onClick={() => { setActiveTab('rack'); setIsSheetOpen(true) }}
          className="flex flex-col items-center gap-1 px-6 py-2 text-slate-400"
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
                    <label className="block text-xs uppercase text-slate-500 mb-1 font-bold">Search</label>
                    <input
                      type="search"
                      placeholder="Brand, model or category…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase text-slate-500 mb-1 font-bold">Category</label>
                    <select
                      value={selectedCategoryId}
                      onChange={(e) => setSelectedCategoryId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm"
                    >
                      <option value="favorites">Favorites</option>
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
                    Export A3 PDF
                  </button>
                  <button
                    onClick={() => navigate(`/editor/project/${project.id}/print/all`)}
                    disabled={layouts.length <= 1}
                    className="w-full py-2 rounded-lg border text-sm border-slate-700 bg-slate-800 disabled:opacity-40"
                    title={layouts.length <= 1 ? 'Add more layouts to export the full project PDF' : undefined}
                  >
                    Export Full Project PDF
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
