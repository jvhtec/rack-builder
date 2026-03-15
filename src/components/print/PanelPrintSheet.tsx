import type { DeviceFacing, PanelLayout } from '../../types'
import PanelLayoutCanvas from '../panels/PanelLayoutCanvas'
import PrintCartouche from './PrintCartouche'

interface PanelPrintSheetProps {
  panel: PanelLayout
  facing: DeviceFacing
  generatedAt: Date
  projectOwner?: string | null
  pageNumber: number
  pageCount: number
  sheetClassName?: string
}

export default function PanelPrintSheet({
  panel,
  facing,
  generatedAt,
  projectOwner,
  pageNumber,
  pageCount,
  sheetClassName,
}: PanelPrintSheetProps) {
  const generatedAtLabel = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(generatedAt)

  return (
    <section className={`layout-print-sheet ${sheetClassName ?? ''}`.trim()} aria-label={`Panel drawing for ${panel.name}`}>
      <div className="layout-print-sheet-inner">
        <div className="layout-print-drawing-frame">
          <div className="w-full p-4">
            <h2 className="text-sm uppercase tracking-[0.14em] text-gray-700 font-semibold mb-3">
              {panel.name} - {panel.height_ru}U - {facing === 'front' ? 'Front' : 'Rear'}
            </h2>
            <PanelLayoutCanvas
              heightRu={panel.height_ru}
              rows={panel.rows ?? []}
              ports={panel.ports ?? []}
              facing={facing}
              hasLacingBar={panel.has_lacing_bar}
              showGuides={false}
              interactive={false}
            />
            <p className="mt-2 text-[10px] text-gray-600 uppercase tracking-wide">
              Scale marker: 19-inch panel width represented across this drawing frame.
            </p>
          </div>
        </div>

        <PrintCartouche
          title="Connector Panel Layout"
          jobName={panel.name}
          pageNumber={pageNumber}
          pageCount={pageCount}
          extraFields={[
            { label: 'Panel Spec', value: `${panel.height_ru}U | facing ${facing}` },
            { label: 'Rows', value: String((panel.rows ?? []).length) },
            { label: 'Connectors', value: String((panel.ports ?? []).length) },
            { label: 'Weight', value: `${panel.weight_kg.toFixed(2)} kg` },
            { label: 'Lacing Bar', value: panel.has_lacing_bar ? 'Enabled' : 'Disabled' },
            { label: 'Generated', value: projectOwner ? `${projectOwner} — ${generatedAtLabel}` : generatedAtLabel },
          ]}
        />
      </div>
    </section>
  )
}
