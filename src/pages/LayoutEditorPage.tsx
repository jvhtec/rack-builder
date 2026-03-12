import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { supabase } from '../lib/supabase'
import { useLayoutItems } from '../hooks/useLayoutItems'
import { useDevices, getDeviceImageUrl } from '../hooks/useDevices'
import { hasOverlap, isWithinBounds } from '../lib/overlap'
import type { DeviceFacing, Layout, Rack, LayoutItemWithDevice } from '../types'
import DevicePalette from '../components/editor/DevicePalette'
import RackGrid from '../components/editor/RackGrid'
import DeviceNotes from '../components/editor/DeviceNotes'
import Button from '../components/ui/Button'

interface LaneAssignments {
  laneByItemId: Map<string, number>
  laneItems: [LayoutItemWithDevice[], LayoutItemWithDevice[]]
}

function getTopU(item: LayoutItemWithDevice): number {
  return item.start_u + item.device.rack_units - 1
}

function overlaps(aStart: number, aUnits: number, b: LayoutItemWithDevice): boolean {
  const aTop = aStart + aUnits - 1
  return aStart <= getTopU(b) && aTop >= b.start_u
}

function buildLaneAssignments(items: LayoutItemWithDevice[]): LaneAssignments {
  const laneByItemId = new Map<string, number>()
  const laneItems: [LayoutItemWithDevice[], LayoutItemWithDevice[]] = [[], []]
  const ordered = [...items].sort((a, b) => {
    if (a.start_u !== b.start_u) return a.start_u - b.start_u
    return a.id.localeCompare(b.id)
  })

  for (const item of ordered) {
    const lane0Blocked = laneItems[0].some((existing) => overlaps(item.start_u, item.device.rack_units, existing))
    if (!lane0Blocked) {
      laneByItemId.set(item.id, 0)
      laneItems[0].push(item)
      continue
    }

    const lane1Blocked = laneItems[1].some((existing) => overlaps(item.start_u, item.device.rack_units, existing))
    if (!lane1Blocked) {
      laneByItemId.set(item.id, 1)
      laneItems[1].push(item)
      continue
    }

    // Over-capacity for 2-lane rack. Place in lane 0 fallback to keep item visible.
    laneByItemId.set(item.id, 0)
    laneItems[0].push(item)
  }

  return { laneByItemId, laneItems }
}

export default function LayoutEditorPage() {
  const { layoutId } = useParams<{ layoutId: string }>()
  const navigate = useNavigate()
  const [layout, setLayout] = useState<Layout | null>(null)
  const [rack, setRack] = useState<Rack | null>(null)
  const [facing, setFacing] = useState<DeviceFacing>('front')
  const [notesItem, setNotesItem] = useState<LayoutItemWithDevice | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'devices' | 'rack'>('devices')
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [selectedDeviceTemplate, setSelectedDeviceTemplate] = useState<string | null>(null)
  const [showDeviceNames, setShowDeviceNames] = useState(true)
  const [isMobile, setIsMobile] = useState<boolean>(() => window.innerWidth < 768)

  const { devices } = useDevices()

  const { items, addItem, removeItem, moveItem, updateItemNotes } = useLayoutItems(
    layoutId,
    rack?.rack_units ?? 0,
  )

  const loadLayoutAndRack = useCallback(async () => {
    if (!layoutId) return
    const { data: layoutData, error: layoutErr } = await supabase
      .from('layouts')
      .select('*')
      .eq('id', layoutId)
      .single()
    if (layoutErr) {
      setLoadError('Layout not found')
      return
    }
    const typedLayout = layoutData as Layout
    setLayout(typedLayout)

    const { data: rackData, error: rackErr } = await supabase
      .from('racks')
      .select('*')
      .eq('id', typedLayout.rack_id)
      .single()
    if (rackErr) {
      setLoadError('Rack not found')
      return
    }
    setRack(rackData as Rack)
  }, [layoutId])

  useEffect(() => {
    loadLayoutAndRack()
  }, [loadLayoutAndRack])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches)
    setIsMobile(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const desktopLanePreferenceByItemId = useMemo(() => (
    new Map<string, 0 | 1>(
      items
        .filter((item) => item.preferred_lane === 0 || item.preferred_lane === 1)
        .map((item) => [item.id, item.preferred_lane as 0 | 1]),
    )
  ), [items])

  const handleDropNew = async (
    deviceId: string,
    startU: number,
    rackUnits: number,
    preferredLane?: 0 | 1,
  ) => {
    try {
      const createdId = await addItem(
        deviceId,
        startU,
        facing,
        rackUnits,
        preferredLane,
        rack?.width === 'dual',
      )
      if (!createdId) return
    } catch (err) {
      console.error('Drop failed:', err)
    }
  }

  const handleDropMove = async (itemId: string, newStartU: number, preferredLane?: 0 | 1) => {
    try {
      await moveItem(itemId, newStartU, facing, preferredLane, rack?.width === 'dual')
    } catch (err) {
      console.error('Move failed:', err)
    }
  }

  const mobileItems = useMemo(() => items.filter((item) => item.facing === facing), [items, facing])
  const isDualRack = rack?.width === 'dual'

  const laneAssignments = useMemo(() => {
    if (!isDualRack) {
      return {
        laneByItemId: new Map<string, number>(mobileItems.map((item) => [item.id, 0])),
        laneItems: [mobileItems, []] as [LayoutItemWithDevice[], LayoutItemWithDevice[]],
      }
    }
    return buildLaneAssignments(mobileItems)
  }, [isDualRack, mobileItems])

  const getDeviceAtU = useCallback((slotU: number, lane: number) => {
    const source = laneAssignments.laneItems[lane]
    return source.find((item) => slotU >= item.start_u && slotU <= getTopU(item))
  }, [laneAssignments])

  const canPlaceOnDualRack = useCallback((slotU: number, deviceUnits: number) => {
    return laneAssignments.laneItems.some((laneItems) => (
      !laneItems.some((item) => overlaps(slotU, deviceUnits, item))
    ))
  }, [laneAssignments])

  const handleMobileSlotClick = async (slotU: number) => {
    if (!selectedDeviceTemplate || !rack) return
    const device = devices.find((entry) => entry.id === selectedDeviceTemplate)
    if (!device) return

    if (!isWithinBounds(slotU, device.rack_units, rack.rack_units)) return

    if (rack.width === 'single' && hasOverlap(slotU, device.rack_units, facing, items)) return
    if (rack.width === 'dual' && !canPlaceOnDualRack(slotU, device.rack_units)) return

    try {
      await addItem(device.id, slotU, facing, device.rack_units, undefined, rack.width === 'dual')
      setSelectedDeviceTemplate(null)
    } catch (err) {
      console.error('Tap placement failed:', err)
    }
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{loadError}</p>
          <Button onClick={() => navigate('/layouts')}>Back to Layouts</Button>
        </div>
      </div>
    )
  }

  if (!layout || !rack) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>
    )
  }

  if (!isMobile) {
    return (
      <DndProvider backend={HTML5Backend}>
        <div className="flex h-screen bg-gray-100">
          <DevicePalette />

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-white border-b px-6 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <Button variant="secondary" onClick={() => navigate('/layouts')}>
                  &larr; Back
                </Button>
                <h1 className="text-xl font-semibold">{layout.name}</h1>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/editor/${layout.id}/print`)}
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

            <div className="flex-1 overflow-auto flex items-start justify-center p-10">
              <RackGrid
                rack={rack}
                items={items}
                facing={facing}
                showDeviceDetails={showDeviceNames}
                lanePreferenceByItemId={desktopLanePreferenceByItemId}
                onDropNew={handleDropNew}
                onDropMove={handleDropMove}
                onRemove={removeItem}
                onEditNotes={setNotesItem}
              />
            </div>
          </div>

          <DeviceNotes
            item={notesItem}
            onSave={updateItemNotes}
            onClose={() => setNotesItem(null)}
          />
        </div>
      </DndProvider>
    )
  }

  const slots = Array.from({ length: rack.rack_units }, (_, i) => rack.rack_units - i)
  const laneCount = rack.width === 'dual' ? 2 : 1

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      <header className="flex items-center justify-between px-4 h-14 bg-slate-900 border-b border-slate-800 shrink-0 z-30">
        <button onClick={() => navigate('/layouts')} className="text-slate-300 text-sm font-semibold">
          ← Back
        </button>
        <div className="flex flex-col items-center min-w-0 px-2">
          <h1 className="text-sm font-bold truncate max-w-[180px]">{layout.name}</h1>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest truncate">{rack.name}</span>
        </div>
        <button onClick={() => setIsSheetOpen(true)} className="text-indigo-400 text-sm font-semibold">
          Menu
        </button>
      </header>

      <main className="flex-1 overflow-y-auto relative bg-slate-950">
        <div className="fixed top-20 right-4 z-20 flex flex-col gap-2">
          <button
            onClick={() => setFacing(facing === 'front' ? 'rear' : 'front')}
            className="w-12 h-12 rounded-full bg-indigo-600 shadow-xl flex items-center justify-center border border-indigo-400 text-xs font-bold uppercase"
          >
            {facing === 'front' ? 'F' : 'R'}
          </button>
        </div>

        {selectedDeviceTemplate && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20 bg-indigo-600 px-4 py-2 rounded-full shadow-2xl border border-indigo-400 flex items-center gap-2">
            <span className="text-xs font-bold">Tap a slot to place</span>
            <button onClick={() => setSelectedDeviceTemplate(null)} className="text-xs">✕</button>
          </div>
        )}

        <div className="flex justify-center p-5 pb-28 min-h-full">
          <div className="relative w-full max-w-[360px]">
            <div className="bg-slate-900 rounded-t-xl border-x-[10px] border-t-[10px] border-slate-800 shadow-2xl">
              {slots.map((u) => (
                <div
                  key={u}
                  onClick={() => handleMobileSlotClick(u)}
                  className="h-10 border-b border-slate-800/70 relative flex items-center transition-colors"
                >
                  <div className="w-8 text-[10px] font-mono text-slate-500 flex items-center justify-center border-r border-slate-800 bg-slate-900/50 h-full">
                    {u}
                  </div>

                  <div className="flex-1 h-full relative">
                    {Array.from({ length: laneCount }, (_, laneIndex) => {
                      const item = getDeviceAtU(u, laneIndex)
                      const topU = item ? getTopU(item) : null
                      const isTop = item && topU === u
                      const isSelectableEmpty = !item && selectedDeviceTemplate
                      const laneBaseClass = isSelectableEmpty ? 'bg-indigo-500/15 active:bg-indigo-500/30' : ''
                      const laneWidth = laneCount === 1 ? '100%' : '50%'
                      const laneLeft = `${laneIndex * 50}%`

                      return (
                        <div
                          key={`${u}-${laneIndex}`}
                          className={`absolute top-0 h-full border-r border-slate-800/60 ${laneBaseClass}`}
                          style={{ left: laneLeft, width: laneWidth }}
                        >
                          {isTop && item && (
                            <div
                              className="absolute inset-x-0 z-10 p-1"
                              style={{ height: `${item.device.rack_units * 40 - 1}px`, top: '0px' }}
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
                                      alt={`${item.device.brand} ${item.device.model}`}
                                      className="w-full h-full object-fill"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-indigo-500/80" />
                                  )
                                })()}

                                {showDeviceNames && (
                                  <div className="absolute inset-0 bg-black/35 p-2 flex flex-col justify-end pointer-events-none">
                                    <p className="text-[9px] uppercase font-black text-indigo-100 truncate">{item.device.brand}</p>
                                    <p className="text-[11px] font-bold text-white truncate leading-tight">{item.device.model}</p>
                                    {item.notes && <p className="text-[10px] text-indigo-100/90 truncate">{item.notes}</p>}
                                  </div>
                                )}

                                <div className="absolute top-1 right-1 flex gap-1 text-[10px]">
                                  <button onClick={(e) => { e.stopPropagation(); setNotesItem(item) }} className="bg-black/45 px-1.5 py-0.5 rounded">N</button>
                                  <button onClick={(e) => { e.stopPropagation(); void removeItem(item.id) }} className="bg-black/45 px-1.5 py-0.5 rounded">✕</button>
                                </div>
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
                  {devices.map((device) => (
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
                        <p className="font-bold text-sm truncate">{device.model}</p>
                      </div>
                      <div className="bg-slate-950 px-2 py-1 rounded text-[10px] font-mono text-indigo-400 shrink-0">
                        {device.rack_units}U
                      </div>
                    </button>
                  ))}
                  {devices.length === 0 && <p className="text-xs text-slate-400">No devices yet.</p>}
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
                  <p className="text-xs text-slate-500">Rack: {rack.name} ({rack.rack_units}U, {rack.width})</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <DeviceNotes
        item={notesItem}
        onSave={updateItemNotes}
        onClose={() => setNotesItem(null)}
      />
    </div>
  )
}
