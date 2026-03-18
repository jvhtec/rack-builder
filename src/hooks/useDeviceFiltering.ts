import { useEffect, useMemo, useState } from 'react'
import { ALL_BRAND, filterDevicesByBrand, filterDevicesByCategory, filterDevicesBySearch } from './useDevices'
import type { Device, DeviceCategory, PanelLayout } from '../types'
import type { ConnectorDefinition } from '../types'
import { buildPanelThumbnailDataUrl } from '../lib/panelThumbnail'

const PANEL_LIBRARY_CATEGORY_ID = '__panel_layouts__'
const PANEL_LIBRARY_CATEGORY_NAME = 'Panel Layouts'
const PANEL_LIBRARY_BRAND = 'Panel Layouts'

export function panelTemplateDeviceId(panelLayoutId: string): string {
  return `panel:${panelLayoutId}`
}

export function parsePanelTemplateId(deviceId: string): string | null {
  if (!deviceId.startsWith('panel:')) return null
  return deviceId.slice('panel:'.length)
}

export function useDeviceFiltering(
  devices: Device[],
  categories: DeviceCategory[],
  panelLayouts: PanelLayout[],
  connectorById: Map<string, ConnectorDefinition>,
) {
  const [selectedDeviceTemplate, setSelectedDeviceTemplate] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState('favorites')
  const [selectedBrand, setSelectedBrand] = useState(ALL_BRAND)
  const [searchQuery, setSearchQuery] = useState('')

  const panelLibraryDevices = useMemo(() => panelLayouts.map((panel) => ({
    id: panelTemplateDeviceId(panel.id),
    brand: PANEL_LIBRARY_BRAND,
    model: panel.name,
    rack_units: panel.height_ru,
    depth_mm: panel.depth_mm,
    weight_kg: panel.weight_kg,
    power_w: 0,
    is_half_rack: false,
    category_id: PANEL_LIBRARY_CATEGORY_ID,
    fav: false,
    category: {
      id: PANEL_LIBRARY_CATEGORY_ID,
      name: PANEL_LIBRARY_CATEGORY_NAME,
      created_at: panel.created_at,
      updated_at: panel.updated_at,
    },
    front_image_path: buildPanelThumbnailDataUrl(panel, 'front', connectorById),
    rear_image_path: buildPanelThumbnailDataUrl(panel, 'rear', connectorById),
    created_at: panel.created_at,
    updated_at: panel.updated_at,
  })), [connectorById, panelLayouts])

  const libraryDevices = useMemo(
    () => [...devices, ...panelLibraryDevices],
    [devices, panelLibraryDevices],
  )

  const panelCategory = useMemo(
    () => panelLayouts.length > 0
      ? [{
        id: PANEL_LIBRARY_CATEGORY_ID,
        name: PANEL_LIBRARY_CATEGORY_NAME,
        created_at: panelLayouts[0].created_at,
        updated_at: panelLayouts[0].updated_at,
      }]
      : [],
    [panelLayouts],
  )

  const libraryCategories = useMemo(
    () => [...categories, ...panelCategory],
    [categories, panelCategory],
  )

  const brands = useMemo(
    () => [...new Set(libraryDevices.map((d) => d.brand))]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    [libraryDevices],
  )

  const filteredDevices = useMemo(
    () => filterDevicesBySearch(filterDevicesByBrand(filterDevicesByCategory(libraryDevices, selectedCategoryId), selectedBrand), searchQuery),
    [libraryDevices, selectedCategoryId, selectedBrand, searchQuery],
  )

  useEffect(() => {
    if (!selectedDeviceTemplate) return
    if (filteredDevices.some((device) => device.id === selectedDeviceTemplate)) return
    setSelectedDeviceTemplate(null)
  }, [filteredDevices, selectedDeviceTemplate])

  return {
    selectedDeviceTemplate,
    setSelectedDeviceTemplate,
    selectedCategoryId,
    setSelectedCategoryId,
    selectedBrand,
    setSelectedBrand,
    searchQuery,
    setSearchQuery,
    filteredDevices,
    libraryCategories,
    brands,
    libraryDevices,
  }
}
