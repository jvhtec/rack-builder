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

export interface DeviceCategory {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface Device {
  id: string
  brand: string
  model: string
  rack_units: number
  depth_mm: number
  weight_kg: number
  power_w: number
  is_half_rack: boolean
  category_id: string
  category?: DeviceCategory | null
  front_image_path: string | null
  rear_image_path: string | null
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  owner: string | null
  created_at: string
  updated_at: string
}

export interface ProjectSummary extends Project {
  layout_count: number
}

export interface Layout {
  id: string
  project_id: string
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
  preferred_sub_lane: 0 | 1 | null
  force_full_width: boolean
  custom_name: string | null
  notes: string | null
}

export interface LayoutItemWithDevice extends LayoutItem {
  device: Device
}
