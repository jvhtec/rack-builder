import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function useImageUpload() {
  const [uploading, setUploading] = useState(false)

  const uploadImage = async (blob: Blob, side: 'front' | 'rear'): Promise<string> => {
    setUploading(true)
    try {
      const uuid = crypto.randomUUID()
      const path = `${side}/${uuid}.jpg`
      const { error } = await supabase.storage
        .from('device-images')
        .upload(path, blob, { contentType: 'image/jpeg' })
      if (error) throw error
      return path
    } finally {
      setUploading(false)
    }
  }

  return { uploadImage, uploading }
}
