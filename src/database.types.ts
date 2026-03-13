export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      racks: {
        Row: {
          id: string
          name: string
          rack_units: number
          depth_mm: number
          width: 'single' | 'dual'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          rack_units: number
          depth_mm: number
          width?: 'single' | 'dual'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          rack_units?: number
          depth_mm?: number
          width?: 'single' | 'dual'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      device_categories: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          id: string
          brand: string
          model: string
          rack_units: number
          depth_mm: number
          weight_kg: number
          power_w: number
          category_id: string
          front_image_path: string | null
          rear_image_path: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          brand: string
          model: string
          rack_units: number
          depth_mm: number
          weight_kg?: number
          power_w?: number
          category_id: string
          front_image_path?: string | null
          rear_image_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          brand?: string
          model?: string
          rack_units?: number
          depth_mm?: number
          weight_kg?: number
          power_w?: number
          category_id?: string
          front_image_path?: string | null
          rear_image_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'devices_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'device_categories'
            referencedColumns: ['id']
          },
        ]
      }
      projects: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      layouts: {
        Row: {
          id: string
          project_id: string
          rack_id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          rack_id: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          rack_id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'layouts_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'layouts_rack_id_fkey'
            columns: ['rack_id']
            isOneToOne: false
            referencedRelation: 'racks'
            referencedColumns: ['id']
          },
        ]
      }
      layout_items: {
        Row: {
          id: string
          layout_id: string
          device_id: string
          start_u: number
          facing: 'front' | 'rear'
          preferred_lane: number | null
          custom_name: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          layout_id: string
          device_id: string
          start_u: number
          facing?: 'front' | 'rear'
          preferred_lane?: number | null
          custom_name?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          layout_id?: string
          device_id?: string
          start_u?: number
          facing?: 'front' | 'rear'
          preferred_lane?: number | null
          custom_name?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'layout_items_layout_id_fkey'
            columns: ['layout_id']
            isOneToOne: false
            referencedRelation: 'layouts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'layout_items_device_id_fkey'
            columns: ['device_id']
            isOneToOne: false
            referencedRelation: 'devices'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      rack_width: 'single' | 'dual'
      device_facing: 'front' | 'rear'
    }
  }
}
