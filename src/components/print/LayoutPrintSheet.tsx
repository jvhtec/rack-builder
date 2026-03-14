import type { RefObject } from 'react'
import RackPrintView from './RackPrintView'
import PrintCartouche from './PrintCartouche'
import type { Layout, LayoutItemWithDevice, Rack } from '../../types'

interface LayoutPrintSheetProps {
  layout: Layout
  rack: Rack
  items: LayoutItemWithDevice[]
  generatedAt: Date
  projectOwner?: string | null
  totalWeightKg: number
  totalPowerW: number
  scaleLabel: string
  pageNumber: number
  pageCount: number
  scale?: number
  drawingFrameRef?: RefObject<HTMLDivElement | null>
  drawingContentRef?: RefObject<HTMLDivElement | null>
  sheetClassName?: string
}

export default function LayoutPrintSheet({
  layout,
  rack,
  items,
  generatedAt,
  projectOwner,
  totalWeightKg,
  totalPowerW,
  scaleLabel,
  pageNumber,
  pageCount,
  scale = 1,
  drawingFrameRef,
  drawingContentRef,
  sheetClassName,
}: LayoutPrintSheetProps) {
  const generatedAtLabel = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(generatedAt)
  const generatedBy = projectOwner ? `${projectOwner} — ${generatedAtLabel}` : generatedAtLabel

  return (
    <section className={`layout-print-sheet ${sheetClassName ?? ''}`.trim()} aria-label={`A3 drawing sheet for ${layout.name}`}>
      <div className="layout-print-sheet-inner">
        <div ref={drawingFrameRef} className="layout-print-drawing-frame">
          <div className="layout-print-drawing-scale" style={{ transform: `scale(${scale})` }}>
            <div ref={drawingContentRef} className="layout-print-drawing-row">
              <RackPrintView rack={rack} items={items} facing="front" showDeviceDetails />
              <RackPrintView rack={rack} items={items} facing="rear" showDeviceDetails />
            </div>
          </div>
        </div>

        <PrintCartouche
          title="Rack Layout Drawing"
          jobName={layout.name}
          pageNumber={pageNumber}
          pageCount={pageCount}
          extraFields={[
            { label: 'Rack', value: rack.name },
            { label: 'Rack Spec', value: `${rack.rack_units}U | ${rack.width} | ${rack.depth_mm}mm` },
            { label: 'Total Weight', value: `${totalWeightKg.toFixed(2)} kg` },
            { label: 'Total Power', value: `${totalPowerW} W` },
            { label: 'Scale', value: scaleLabel },
            { label: 'Generated', value: generatedBy },
          ]}
        />
      </div>
    </section>
  )
}
