export type RackWidth = 'single' | 'dual'
export type DeviceFacing = 'front' | 'rear'

export interface Rack {
  id: string
  name: string
  rack_units: number
  depth_mm: number
  width: RackWidth
  created_at: string
  updated_at: string
}

export interface Device {
  id: string
  brand: string
  model: string
  rack_units: number
  depth_mm: number
  front_image_path: string | null
  rear_image_path: string | null
  created_at: string
  updated_at: string
}

export interface Layout {
  id: string
  rack_id: string
  name: string
  created_at: string
  updated_at: string
}

export interface LayoutItem {
  id: string
  layout_id: string
  device_id: string
  start_u: number
  facing: DeviceFacing
  preferred_lane: 0 | 1 | null
  notes: string | null
}

export interface LayoutItemWithDevice extends LayoutItem {
  device: Device
}
