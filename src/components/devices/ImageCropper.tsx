import { useState, useRef, useCallback } from 'react'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import Button from '../ui/Button'

interface ImageCropperProps {
  imageSrc: string
  onCropComplete: (blob: Blob) => void
  onCancel: () => void
}

function getCroppedBlob(image: HTMLImageElement, crop: PixelCrop): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height
  canvas.width = crop.width * scaleX
  canvas.height = crop.height * scaleY
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  )
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to create blob'))),
      'image/jpeg',
      0.9,
    )
  })
}

export default function ImageCropper({ imageSrc, onCropComplete, onCancel }: ImageCropperProps) {
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const imgRef = useRef<HTMLImageElement>(null)

  const handleConfirm = useCallback(async () => {
    if (!imgRef.current || !completedCrop) return
    const blob = await getCroppedBlob(imgRef.current, completedCrop)
    onCropComplete(blob)
  }, [completedCrop, onCropComplete])

  return (
    <div className="space-y-4">
      <div className="max-h-96 overflow-auto">
        <ReactCrop crop={crop} onChange={setCrop} onComplete={setCompletedCrop}>
          <img ref={imgRef} src={imageSrc} alt="Crop preview" className="max-w-full" />
        </ReactCrop>
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} disabled={!completedCrop}>
          Confirm Crop
        </Button>
      </div>
    </div>
  )
}
