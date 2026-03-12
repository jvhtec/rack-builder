import { useState, useRef, useCallback } from 'react'
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import Button from '../ui/Button'

interface ImageCropperProps {
  imageSrc: string
  aspect?: number
  outputWidth?: number
  outputHeight?: number
  onCropComplete: (blob: Blob) => void
  onCancel: () => void
}

function getCroppedBlob(
  image: HTMLImageElement,
  crop: PixelCrop,
  outputWidth?: number,
  outputHeight?: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height
  const sourceWidth = crop.width * scaleX
  const sourceHeight = crop.height * scaleY
  const targetWidth = outputWidth && outputWidth > 0 ? outputWidth : Math.round(sourceWidth)
  const targetHeight = outputHeight && outputHeight > 0 ? outputHeight : Math.round(sourceHeight)
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    targetWidth,
    targetHeight,
  )
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to create blob'))),
      'image/jpeg',
      0.9,
    )
  })
}

function getCenteredAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect?: number,
): Crop {
  if (!aspect || aspect <= 0) {
    return {
      unit: '%',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    }
  }

  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 100,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

export default function ImageCropper({
  imageSrc,
  aspect,
  outputWidth,
  outputHeight,
  onCropComplete,
  onCancel,
}: ImageCropperProps) {
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const imgRef = useRef<HTMLImageElement>(null)

  const handleConfirm = useCallback(async () => {
    if (!imgRef.current || !completedCrop) return
    const blob = await getCroppedBlob(imgRef.current, completedCrop, outputWidth, outputHeight)
    onCropComplete(blob)
  }, [completedCrop, onCropComplete, outputWidth, outputHeight])

  return (
    <div className="space-y-4">
      <div className="max-h-96 overflow-auto">
        <ReactCrop
          crop={crop}
          aspect={aspect}
          keepSelection
          onChange={setCrop}
          onComplete={setCompletedCrop}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Crop preview"
            className="max-w-full"
            onLoad={(event) => {
              const target = event.currentTarget
              setCrop(getCenteredAspectCrop(target.width, target.height, aspect))
            }}
          />
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
