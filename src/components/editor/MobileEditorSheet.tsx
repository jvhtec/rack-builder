import type { Device, Layout, Rack } from '../../types'
import { ALL_BRAND } from '../../hooks/useDevices'
import { VIEW_MODE_OPTIONS, type RackViewMode } from '../../hooks/useRackViewState'

interface MobileEditorSheetProps {
  activeTab: 'devices' | 'rack'
  onClose: () => void
  // Device tab
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedCategoryId: string
  onCategoryChange: (id: string) => void
  libraryCategories: { id: string; name: string }[]
  selectedBrand: string
  onBrandChange: (brand: string) => void
  brands: string[]
  filteredDevices: Device[]
  selectedDeviceTemplate: string | null
  onDeviceSelect: (id: string) => void
  // Rack tab
  layouts: Layout[]
  activeLayout: Layout
  rack: Rack
  rackTotals: { weightKg: number; powerW: number }
  viewMode: RackViewMode
  showDeviceNames: boolean
  simplifiedView: boolean
  onSetRackViewMode: (mode: RackViewMode) => void
  onToggleDeviceNames: () => void
  onToggleSimplifiedView: () => void
  onOpenCreateLayout: () => void
  onOpenRenameLayout: () => void
  onOpenDeleteLayout: () => void
  onNavigate: (path: string) => void
  projectId: string
}

export default function MobileEditorSheet({
  activeTab, onClose,
  searchQuery, onSearchChange,
  selectedCategoryId, onCategoryChange, libraryCategories,
  selectedBrand, onBrandChange, brands,
  filteredDevices, selectedDeviceTemplate, onDeviceSelect,
  layouts, activeLayout, rack, rackTotals,
  viewMode, showDeviceNames, simplifiedView,
  onSetRackViewMode, onToggleDeviceNames, onToggleSimplifiedView,
  onOpenCreateLayout, onOpenRenameLayout, onOpenDeleteLayout,
  onNavigate, projectId,
}: MobileEditorSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex overflow-hidden">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-80 max-w-[85%] bg-slate-900 h-full shadow-2xl flex flex-col">
        <div
          className="p-4 border-b border-slate-800 flex items-center justify-between"
          style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
        >
          <h2 className="font-bold text-sm uppercase tracking-widest text-slate-400">
            {activeTab === 'devices' ? 'Add Equipment' : 'Rack Settings'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-300">✕</button>
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
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-slate-500 mb-1 font-bold">Category</label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => onCategoryChange(e.target.value)}
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
                  onChange={(e) => onBrandChange(e.target.value)}
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
                  onClick={() => onDeviceSelect(device.id)}
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
                  onClick={onOpenCreateLayout}
                  className="flex-1 py-2 rounded-lg border text-sm border-slate-700 bg-slate-800"
                >
                  + New
                </button>
                <button
                  onClick={onOpenRenameLayout}
                  className="flex-1 py-2 rounded-lg border text-sm border-slate-700 bg-slate-800"
                >
                  Rename
                </button>
                <button
                  onClick={onOpenDeleteLayout}
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
                    onClick={() => onSetRackViewMode(option.value)}
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
                onClick={onToggleDeviceNames}
                className={`w-full py-2 rounded-lg border text-sm ${
                  showDeviceNames ? 'border-indigo-400 bg-indigo-500/20' : 'border-slate-700 bg-slate-800'
                }`}
              >
                Device names: {showDeviceNames ? 'On' : 'Off'}
              </button>
              <button
                onClick={onToggleSimplifiedView}
                className={`w-full py-2 rounded-lg border text-sm ${
                  simplifiedView ? 'border-indigo-400 bg-indigo-500/20' : 'border-slate-700 bg-slate-800'
                }`}
              >
                Simplified view: {simplifiedView ? 'On' : 'Off'}
              </button>
              <button
                onClick={() => onNavigate(`/editor/project/${projectId}/print/${activeLayout.id}`)}
                className="w-full py-2 rounded-lg border text-sm border-slate-700 bg-slate-800"
              >
                Export A3 PDF
              </button>
              <button
                onClick={() => onNavigate(`/editor/project/${projectId}/print/all`)}
                disabled={layouts.length <= 1}
                className="w-full py-2 rounded-lg border text-sm border-slate-700 bg-slate-800 disabled:opacity-40"
                title={layouts.length <= 1 ? 'Add more layouts to export the full project PDF' : undefined}
              >
                Export Full Project PDF
              </button>
              <button
                onClick={() => onNavigate(`/editor/project/${projectId}/panels`)}
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
  )
}
