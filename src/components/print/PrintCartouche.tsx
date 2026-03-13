import { useMemo } from 'react'
import type { Layout, Rack } from '../../types'

interface PrintCartoucheProps {
  layout: Layout
  rack: Rack
  scaleLabel: string
  generatedAt: Date
  totalWeightKg: number
  totalPowerW: number
}

export default function PrintCartouche({
  layout,
  rack,
  scaleLabel,
  generatedAt,
  totalWeightKg,
  totalPowerW,
}: PrintCartoucheProps) {
  const logoSrc = '/sector%20pro%20logo.png'
  const generatedAtLabel = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(generatedAt),
    [generatedAt],
  )

  const rackSpecLabel = `${rack.rack_units}U | ${rack.width} | ${rack.depth_mm}mm`

  const fields: Array<{ label: string; value: string; isLogo?: boolean }> = [
    { label: 'Title', value: 'Rack Layout Drawing' },
    { label: 'Job Name', value: layout.name },
    { label: 'Rack', value: rack.name },
    { label: 'Rack Spec', value: rackSpecLabel },
    { label: 'Total Weight', value: `${totalWeightKg.toFixed(2)} kg` },
    { label: 'Total Power', value: `${totalPowerW} W` },
    { label: 'Scale', value: scaleLabel },
    { label: 'Generated', value: `JVH — ${generatedAtLabel}` },
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
