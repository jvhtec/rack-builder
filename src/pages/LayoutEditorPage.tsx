import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { supabase } from '../lib/supabase'
import { useLayoutItems } from '../hooks/useLayoutItems'
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

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex h-screen bg-gray-100">
        {/* Sidebar: device palette */}
        <DevicePalette />

        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
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

          {/* Rack grid area */}
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

        {/* Notes modal */}
        <DeviceNotes
          item={notesItem}
          onSave={updateItemNotes}
          onClose={() => setNotesItem(null)}
        />
      </div>
    </DndProvider>
  )
}
