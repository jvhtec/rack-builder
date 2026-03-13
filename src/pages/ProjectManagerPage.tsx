import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjects } from '../hooks/useProjects'
import { useRacks } from '../hooks/useRacks'
import type { ProjectSummary } from '../types'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'

export default function ProjectManagerPage() {
  const { projects, loading: projectsLoading, createProjectWithInitialLayout, deleteProject } = useProjects()
  const { racks, loading: racksLoading } = useRacks()
  const navigate = useNavigate()

  const [formOpen, setFormOpen] = useState(false)
  const [deletingProject, setDeletingProject] = useState<ProjectSummary | undefined>()
  const [projectName, setProjectName] = useState('')
  const [initialLayoutName, setInitialLayoutName] = useState('Main Layout')
  const [rackId, setRackId] = useState('')
  const [saving, setSaving] = useState(false)

  const openCreateModal = () => {
    setProjectName('')
    setInitialLayoutName('Main Layout')
    setRackId(racks[0]?.id ?? '')
    setFormOpen(true)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!projectName || !initialLayoutName || !rackId) return

    setSaving(true)
    try {
      const result = await createProjectWithInitialLayout({
        project_name: projectName,
        initial_layout_name: initialLayoutName,
        rack_id: rackId,
      })

      setFormOpen(false)
      navigate(`/editor/project/${result.project.id}?layout=${result.layout_id}`)
    } finally {
      setSaving(false)
    }
  }

  if (projectsLoading || racksLoading) {
    return <div className="text-gray-500">Loading...</div>
  }

  return (
    <div>
      <PageHeader
        title="Project Manager"
        action={
          <Button onClick={openCreateModal} disabled={racks.length === 0} className="w-full sm:w-auto">
            New Project
          </Button>
        }
      />

      {racks.length === 0 && (
        <p className="text-amber-600 text-sm mb-4">
          Create a rack definition first before creating projects.
        </p>
      )}

      {projects.length === 0 ? (
        <p className="text-gray-500 text-sm">No projects yet. Create one to get started.</p>
      ) : (
        <div>
          <div className="space-y-3 md:hidden">
            {projects.map((project) => (
              <article key={project.id} className="rounded-lg border bg-white p-4">
                <div className="font-medium text-gray-900">{project.name}</div>
                <div className="mt-2 text-sm text-gray-600">{project.layout_count} layout(s)</div>
                <div className="mt-1 text-xs text-gray-500">{new Date(project.created_at).toLocaleDateString()}</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button className="w-full" onClick={() => navigate(`/editor/project/${project.id}`)}>
                    Open
                  </Button>
                  <Button variant="danger" className="w-full" onClick={() => setDeletingProject(project)}>
                    Delete
                  </Button>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Layouts</th>
                  <th className="pb-2 font-medium">Created</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3 font-medium text-gray-900">{project.name}</td>
                    <td className="py-3">{project.layout_count}</td>
                    <td className="py-3 text-gray-500">{new Date(project.created_at).toLocaleDateString()}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button onClick={() => navigate(`/editor/project/${project.id}`)}>Open Editor</Button>
                        <Button variant="danger" onClick={() => setDeletingProject(project)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title="New Project">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Project Name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            required
          />
          <Input
            label="Initial Layout Name"
            value={initialLayoutName}
            onChange={(e) => setInitialLayoutName(e.target.value)}
            required
          />
          <Select
            label="Rack"
            value={rackId}
            onChange={(e) => setRackId(e.target.value)}
            options={racks.map((rack) => ({ value: rack.id, label: `${rack.name} (${rack.rack_units}U)` }))}
          />

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" type="button" onClick={() => setFormOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !projectName || !initialLayoutName || !rackId} className="w-full sm:w-auto">
              {saving ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingProject}
        onClose={() => setDeletingProject(undefined)}
        onConfirm={() => deletingProject && deleteProject(deletingProject.id)}
        title="Delete Project"
        message={`Are you sure you want to delete "${deletingProject?.name}"? All layouts and placed devices in this project will be removed.`}
      />
    </div>
  )
}
