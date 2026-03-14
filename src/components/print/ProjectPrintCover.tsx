import PrintCartouche from './PrintCartouche'
import logoUrl from '../../assets/sector-pro-logo.png'
import type { Project } from '../../types'

interface ProjectPrintCoverProps {
  project: Project
  generatedAt: Date
  pageNumber: number
  pageCount: number
}

export default function ProjectPrintCover({ project, generatedAt, pageNumber, pageCount }: ProjectPrintCoverProps) {
  const generatedAtLabel = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(generatedAt)

  return (
    <section className="layout-print-sheet layout-print-page-break" aria-label="Project print cover">
      <div className="layout-print-sheet-inner">
        <div className="project-print-cover">
          <img src={logoUrl} alt="Sector Pro" className="project-print-cover-logo" />
          <p className="project-print-cover-kicker">Technical Documentation</p>
          <h1 className="project-print-cover-title">{project.name}</h1>
          {project.owner && <p className="project-print-cover-owner">Owner / Client: {project.owner}</p>}
          <p className="project-print-cover-generated">Generated {generatedAtLabel}</p>
        </div>

        <PrintCartouche
          title="Project Cover"
          jobName={project.name}
          pageNumber={pageNumber}
          pageCount={pageCount}
          extraFields={[
            { label: 'Document', value: 'Full Project Rack Pack' },
            { label: 'Generated', value: generatedAtLabel },
            { label: 'Owner / Client', value: project.owner ?? 'N/A' },
          ]}
        />
      </div>
    </section>
  )
}
