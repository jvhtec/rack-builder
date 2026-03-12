import type { DeviceFacing, Rack, LayoutItemWithDevice } from '../../types'
import RackSlot from './RackSlot'
import PlacedDevice from './PlacedDevice'

const SLOT_HEIGHT = 28

interface RackGridProps {
  rack: Rack
  items: LayoutItemWithDevice[]
  facing: DeviceFacing
  onDropNew: (deviceId: string, startU: number, rackUnits: number) => void
  onDropMove: (itemId: string, newStartU: number) => void
  onRemove: (itemId: string) => void
  onEditNotes: (item: LayoutItemWithDevice) => void
}

export default function RackGrid({
  rack,
  items,
  facing,
  onDropNew,
  onDropMove,
  onRemove,
  onEditNotes,
}: RackGridProps) {
  const filteredItems = items.filter((item) => item.facing === facing)

  // Build slots from top (highest U) to bottom (U=1)
  const slots: number[] = []
  for (let u = rack.rack_units; u >= 1; u--) {
    slots.push(u)
  }

  return (
    <div className="inline-block border-2 border-gray-700 rounded bg-gray-50" style={{ width: '400px' }}>
      {/* Rack header */}
      <div className="bg-gray-700 text-white text-center text-xs py-1 font-medium">
        {rack.name} — {rack.rack_units}U — {facing === 'front' ? 'Front' : 'Rear'} View
      </div>

      {/* Rack body */}
      <div className="relative">
        {slots.map((u) => (
          <RackSlot
            key={u}
            slotU={u}
            totalRackUnits={rack.rack_units}
            facing={facing}
            items={filteredItems}
            onDropNew={onDropNew}
            onDropMove={onDropMove}
          />
        ))}

        {/* Render placed devices */}
        {filteredItems.map((item) => {
          // Position: bottom of rack is U=1. Slot index from top = rack_units - start_u - (device.rack_units - 1)
          const topSlotIndex = rack.rack_units - item.start_u - (item.device.rack_units - 1)
          const topPx = topSlotIndex * SLOT_HEIGHT
          return (
            <div
              key={item.id}
              className="absolute left-8 right-0"
              style={{ top: `${topPx}px` }}
            >
              <PlacedDevice
                item={item}
                facing={facing}
                onRemove={onRemove}
                onEditNotes={onEditNotes}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
