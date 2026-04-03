import { useNavigate } from 'react-router-dom'
import type { Layout, Rack } from '../../types'
import Button from '../ui/Button'
import { formatDrawingState, formatRevisionLabel } from '../../lib/drawingState'

interface LayoutListProps {
  layouts: Layout[]
  racks: Rack[]
  onDelete: (layout: Layout) => void
}

export default function LayoutList({ layouts, racks, onDelete }: LayoutListProps) {
  const navigate = useNavigate()

  const rackMap = new Map(racks.map((r) => [r.id, r]))

  if (layouts.length === 0) {
    return <p className="text-gray-500 text-sm">No layouts yet. Create one to start building.</p>
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {layouts.map((layout) => {
          const rack = rackMap.get(layout.rack_id)
          return (
            <article key={layout.id} className="rounded-lg border bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900">{layout.name}</h3>
              <dl className="mt-2 grid grid-cols-2 gap-y-1 text-xs text-gray-600">
                <dt>Rack</dt>
                <dd className="text-right">{rack ? `${rack.name} (${rack.rack_units}U)` : 'Unknown'}</dd>
                <dt>Created</dt>
                <dd className="text-right">{new Date(layout.created_at).toLocaleDateString()}</dd>
                <dt>State</dt>
                <dd className="text-right">{formatDrawingState(layout.drawing_state)}</dd>
                <dt>Revision</dt>
                <dd className="text-right">{formatRevisionLabel(layout.drawing_state, layout.revision_number)}</dd>
              </dl>
              <div className="mt-3 grid gap-2">
                <Button onClick={() => navigate(`/editor/${layout.id}`)}>Open Editor</Button>
                <Button variant="danger" onClick={() => onDelete(layout)}>
                  Delete
                </Button>
              </div>
            </article>
          )
        })}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Rack</th>
              <th className="pb-2 font-medium">State</th>
              <th className="pb-2 font-medium">Revision</th>
              <th className="pb-2 font-medium">Created</th>
              <th className="pb-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {layouts.map((layout) => {
              const rack = rackMap.get(layout.rack_id)
              return (
                <tr key={layout.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3 font-medium text-gray-900">{layout.name}</td>
                  <td className="py-3">{rack ? `${rack.name} (${rack.rack_units}U)` : 'Unknown'}</td>
                  <td className="py-3 text-gray-500">{formatDrawingState(layout.drawing_state)}</td>
                  <td className="py-3 text-gray-500">{formatRevisionLabel(layout.drawing_state, layout.revision_number)}</td>
                  <td className="py-3 text-gray-500">
                    {new Date(layout.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button onClick={() => navigate(`/editor/${layout.id}`)}>
                        Open Editor
                      </Button>
                      <Button variant="danger" onClick={() => onDelete(layout)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
