import type { Rack } from '../../types'
import Button from '../ui/Button'

interface RackListProps {
  racks: Rack[]
  onEdit: (rack: Rack) => void
  onDelete: (rack: Rack) => void
}

export default function RackList({ racks, onEdit, onDelete }: RackListProps) {
  if (racks.length === 0) {
    return <p className="text-gray-500 text-sm">No racks defined yet. Create one to get started.</p>
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {racks.map((rack) => (
          <article key={rack.id} className="rounded-lg border bg-white p-4">
            <div className="font-medium text-gray-900">{rack.name}</div>
            <div className="mt-2 text-sm text-gray-600">
              {rack.rack_units}U · {rack.depth_mm}mm · <span className="capitalize">{rack.width}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" className="w-full" onClick={() => onEdit(rack)}>
                Edit
              </Button>
              <Button variant="danger" className="w-full" onClick={() => onDelete(rack)}>
                Delete
              </Button>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Rack Units</th>
              <th className="pb-2 font-medium">Depth (mm)</th>
              <th className="pb-2 font-medium">Width</th>
              <th className="pb-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {racks.map((rack) => (
              <tr key={rack.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-3 font-medium text-gray-900">{rack.name}</td>
                <td className="py-3">{rack.rack_units}U</td>
                <td className="py-3">{rack.depth_mm}mm</td>
                <td className="py-3 capitalize">{rack.width}</td>
                <td className="py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => onEdit(rack)}>
                      Edit
                    </Button>
                    <Button variant="danger" onClick={() => onDelete(rack)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
