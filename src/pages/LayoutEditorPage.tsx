import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { supabase } from '../lib/supabase'
import { useLayoutItems } from '../hooks/useLayoutItems'
import { useDevices } from '../hooks/useDevices'
import { hasOverlap, isWithinBounds } from '../lib/overlap'
import type { DeviceFacing, Layout, Rack, LayoutItemWithDevice } from '../types'
import DevicePalette from '../components/editor/DevicePalette'
import RackGrid from '../components/editor/RackGrid'
import DeviceNotes from '../components/editor/DeviceNotes'
import Button from '../components/ui/Button'

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

  const handleDropNew = async (deviceId: string, startU: number, rackUnits: number) => {
    try {
      await addItem(deviceId, startU, facing, rackUnits)
    } catch (err) {
      console.error('Drop failed:', err)
    }
  }

  const handleDropMove = async (itemId: string, newStartU: number) => {
    try {
      await moveItem(itemId, newStartU, facing)
    } catch (err) {
      console.error('Move failed:', err)
    }
  }

  const mobileItems = useMemo(() => items.filter((item) => item.facing === facing), [items, facing])

  const getDeviceAtU = useCallback((slotU: number) => {
    return mobileItems.find((item) => {
      const topU = item.start_u + item.device.rack_units - 1
      return slotU >= item.start_u && slotU <= topU
    })
  }, [mobileItems])

  const handleMobileSlotClick = async (slotU: number) => {
    if (!selectedDeviceTemplate || !rack) return
    const device = devices.find((entry) => entry.id === selectedDeviceTemplate)
    if (!device) return

    if (!isWithinBounds(slotU, device.rack_units, rack.rack_units)) return
    if (hasOverlap(slotU, device.rack_units, facing, items)) return

    try {
      await addItem(device.id, slotU, facing, device.rack_units)
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
            <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <Button variant="secondary" onClick={() => navigate('/layouts')}>
                  &larr; Back
                </Button>
                <h1 className="text-lg font-semibold">{layout.name}</h1>
              </div>
              <div className="flex items-center gap-2">
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
              </div>
            </div>

            <div className="flex-1 overflow-auto flex items-start justify-center p-6">
              <RackGrid
                rack={rack}
                items={items}
                facing={facing}
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
              {slots.map((u) => {
                const item = getDeviceAtU(u)
                const topU = item ? item.start_u + item.device.rack_units - 1 : null
                const isTop = item && topU === u
                return (
                  <div
                    key={u}
                    onClick={() => handleMobileSlotClick(u)}
                    className={`h-10 border-b border-slate-800/70 relative flex items-center transition-colors ${
                      !item && selectedDeviceTemplate ? 'bg-indigo-500/15 active:bg-indigo-500/30' : ''
                    }`}
                  >
                    <div className="w-8 text-[10px] font-mono text-slate-500 flex items-center justify-center border-r border-slate-800 bg-slate-900/50">
                      {u}
                    </div>
                    {isTop && item && (
                      <div
                        className="absolute left-8 right-0 z-10 p-1"
                        style={{ height: `${item.device.rack_units * 40 - 1}px`, top: '0px' }}
                      >
                        <div className="w-full h-full rounded bg-indigo-500/90 border border-indigo-300 shadow-inner p-2 flex flex-col justify-between">
                          <div className="overflow-hidden">
                            <p className="text-[9px] uppercase font-black text-indigo-100 truncate">{item.device.brand}</p>
                            <p className="text-[11px] font-bold text-white truncate leading-tight">{item.device.model}</p>
                            {item.notes && <p className="text-[10px] text-indigo-100/90 truncate">{item.notes}</p>}
                          </div>
                          <div className="flex justify-end gap-2 text-[10px]">
                            <button onClick={(e) => { e.stopPropagation(); setNotesItem(item) }} className="bg-black/20 px-1.5 py-0.5 rounded">Notes</button>
                            <button onClick={(e) => { e.stopPropagation(); void removeItem(item.id) }} className="bg-black/20 px-1.5 py-0.5 rounded">Remove</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
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
                  <p className="text-xs text-slate-500">Rack: {rack.name} ({rack.rack_units}U)</p>
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
