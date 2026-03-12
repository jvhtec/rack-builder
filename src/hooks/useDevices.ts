import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Device } from '../types'

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDevices = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('devices')
      .select('*')
      .order('created_at', { ascending: false })
    if (err) {
      setError(err.message)
    } else {
      setDevices((data as Device[]) ?? [])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchDevices()
  }, [fetchDevices])

  const createDevice = async (device: {
    brand: string
    model: string
    rack_units: number
    depth_mm: number
    front_image_path?: string | null
    rear_image_path?: string | null
  }) => {
    const { error: err } = await supabase.from('devices').insert(device)
    if (err) throw err
    await fetchDevices()
  }

  const updateDevice = async (
    id: string,
    updates: Partial<{
      brand: string
      model: string
      rack_units: number
      depth_mm: number
      front_image_path: string | null
      rear_image_path: string | null
    }>,
  ) => {
    const { error: err } = await supabase
      .from('devices')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (err) throw err
    await fetchDevices()
  }

  const deleteDevice = async (id: string) => {
    const { error: err } = await supabase.from('devices').delete().eq('id', id)
    if (err) throw err
    await fetchDevices()
  }

  return { devices, loading, error, createDevice, updateDevice, deleteDevice, refetch: fetchDevices }
}

export function getDeviceImageUrl(path: string | null): string | null {
  if (!path) return null
  const { data } = supabase.storage.from('device-images').getPublicUrl(path)
  return data.publicUrl
}
