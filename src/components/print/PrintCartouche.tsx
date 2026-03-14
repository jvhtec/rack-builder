import { useEffect, useMemo, useRef, useState } from 'react'
import type { Layout, Rack } from '../../types'

interface PrintCartoucheProps {
  layout: Layout
  rack: Rack
  scaleLabel: string
  generatedAt: Date
  totalWeightKg: number
  totalPowerW: number
  projectOwner?: string | null
}

export default function PrintCartouche({
  layout,
  rack,
  scaleLabel,
  generatedAt,
  totalWeightKg,
  totalPowerW,
  projectOwner,
}: PrintCartoucheProps) {
  const logoPath = '/sector%20pro%20logo.png'
  const [logoSrc, setLogoSrc] = useState<string>(logoPath)
  const logoLoadedRef = useRef(false)

  useEffect(() => {
    if (logoLoadedRef.current) return
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0)
        const dataUrl = canvas.toDataURL('image/png')
        setLogoSrc(dataUrl)
      }
      logoLoadedRef.current = true
    }
    img.onerror = () => {
      console.error('PrintCartouche: failed to load logo', logoPath)
      logoLoadedRef.current = true
    }
    img.src = logoPath
  }, [])

  const generatedAtLabel = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(generatedAt),
    [generatedAt],
  )

  const generatedValue = projectOwner ? `${projectOwner} — ${generatedAtLabel}` : generatedAtLabel

  const rackSpecLabel = `${rack.rack_units}U | ${rack.width} | ${rack.depth_mm}mm`

  const fields: Array<{ label: string; value: string; isLogo?: boolean }> = [
    { label: 'Title', value: 'Rack Layout Drawing' },
    { label: 'Job Name', value: layout.name },
    { label: 'Rack', value: rack.name },
    { label: 'Rack Spec', value: rackSpecLabel },
    { label: 'Total Weight', value: `${totalWeightKg.toFixed(2)} kg` },
    { label: 'Total Power', value: `${totalPowerW} W` },
    { label: 'Scale', value: scaleLabel },
    { label: 'Generated', value: generatedValue },
    { label: '', value: '', isLogo: true },
    { label: 'Page', value: '1 / 1' },
  ]

  return (
    <section className="print-cartouche" aria-label="Drawing cartouche">
      {fields.map((field, i) => (
        <div key={field.label || `cell-${i}`} className={`print-cartouche-cell${field.isLogo ? ' print-cartouche-logo' : ''}`}>
          {!field.isLogo && (
            <>
              <p className="print-cartouche-label">{field.label}</p>
              <p className="print-cartouche-value" title={field.value}>{field.value}</p>
            </>
          )}
          {field.isLogo && (
            <img src={logoSrc} alt="Sector Pro" className="print-cartouche-logo-image" />
          )}
        </div>
      ))}
    </section>
  )
}
