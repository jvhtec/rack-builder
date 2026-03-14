import { useMemo } from 'react'
import type { Layout, Rack } from '../../types'
import logoUrl from '../../assets/sector-pro-logo.png'

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
            <img src={logoUrl} alt="Sector Pro" className="print-cartouche-logo-image" />
          )}
        </div>
      ))}
    </section>
  )
}
