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
import PasswordPrompt from '../components/ui/PasswordPrompt'

function LockIcon() {
  return (
    <svg className="inline-block w-4 h-4 ml-1 text-gray-400 dark:text-gray-500 align-text-top" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
    </svg>
  )
}

export default function ProjectManagerPage() {
  const { projects, loading: projectsLoading, createProjectWithInitialLayout, updateProject, deleteProject } = useProjects()
  const { racks, loading: racksLoading } = useRacks()
  const navigate = useNavigate()

  const [formOpen, setFormOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<ProjectSummary | undefined>()
  const [deletingProject, setDeletingProject] = useState<ProjectSummary | undefined>()
  const [projectName, setProjectName] = useState('')
  const [projectOwner, setProjectOwner] = useState('')
  const [projectPassword, setProjectPassword] = useState('')
  const [initialLayoutName, setInitialLayoutName] = useState('Main Layout')
  const [rackId, setRackId] = useState('')
  const [editName, setEditName] = useState('')
  const [editOwner, setEditOwner] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Password gate state
  const [authProject, setAuthProject] = useState<ProjectSummary | null>(null)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)

  const requireProjectAuth = (project: ProjectSummary, action: () => void) => {
    if (!project.password || sessionStorage.getItem(`project_auth_${project.id}`) === 'true') {
      action()
    } else {
      setAuthProject(project)
      setPendingAction(() => action)
    }
  }

  const openEditModal = (project: ProjectSummary) => {
    setEditName(project.name)
    setEditOwner(project.owner ?? '')
    setEditPassword(project.password ?? '')
    setEditError(null)
    setEditingProject(project)
  }

  const handleEditSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const name = editName.trim()
    const owner = editOwner.trim() || null
    const password = editPassword.trim() || null
    if (!editingProject || !name) return
    setSaving(true)
    try {
      await updateProject(editingProject.id, { name, owner, password })
      setEditingProject(undefined)
    } catch (err) {
      console.error('Failed to update project:', err)
      setEditError(err instanceof Error ? err.message : 'Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const openCreateModal = () => {
    setProjectName('')
    setProjectOwner('')
    setProjectPassword('')
    setInitialLayoutName('Main Layout')
    setRackId(racks[0]?.id ?? '')
    setFormOpen(true)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmedName = projectName.trim()
    const trimmedOwner = projectOwner.trim() || undefined
    const trimmedLayoutName = initialLayoutName.trim()
    if (!trimmedName || !trimmedLayoutName || !rackId) return

    setSaving(true)
    try {
      const result = await createProjectWithInitialLayout({
        project_name: trimmedName,
        project_owner: trimmedOwner,
        initial_layout_name: trimmedLayoutName,
        rack_id: rackId,
        password: projectPassword.trim() || undefined,
      })

      setFormOpen(false)
      // Auto-auth for the project we just created
      if (projectPassword.trim()) {
        sessionStorage.setItem(`project_auth_${result.project.id}`, 'true')
      }
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
          <Button onClick={openCreateModal} disabled={racks.length === 0}>
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
        <>
          <div className="space-y-3 md:hidden">
            {projects.map((project) => (
              <article key={project.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {project.name}
                  {project.password && <LockIcon />}
                </h2>
                <dl className="mt-2 grid grid-cols-2 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <dt>Owner</dt>
                  <dd className="text-right">{project.owner ?? '—'}</dd>
                  <dt>Layouts</dt>
                  <dd className="text-right">{project.layout_count}</dd>
                  <dt>Created</dt>
                  <dd className="text-right">{new Date(project.created_at).toLocaleDateString()}</dd>
                </dl>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  <Button onClick={() => requireProjectAuth(project, () => navigate(`/editor/project/${project.id}`))}>
                    Open Editor
                  </Button>
                  <Button variant="secondary" onClick={() => requireProjectAuth(project, () => navigate(`/editor/project/${project.id}/panels`))}>
                    Panel Layouts
                  </Button>
                  <Button variant="secondary" onClick={() => requireProjectAuth(project, () => openEditModal(project))}>
                    Edit
                  </Button>
                  <Button variant="danger" onClick={() => requireProjectAuth(project, () => setDeletingProject(project))}>
                    Delete
                  </Button>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Owner</th>
                  <th className="pb-2 font-medium">Layouts</th>
                  <th className="pb-2 font-medium">Created</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="py-3 font-medium text-gray-900 dark:text-white">
                      {project.name}
                      {project.password && <LockIcon />}
                    </td>
                    <td className="py-3 text-gray-500 dark:text-gray-400">{project.owner ?? '—'}</td>
                    <td className="py-3 dark:text-gray-300">{project.layout_count}</td>
                    <td className="py-3 text-gray-500 dark:text-gray-400">{new Date(project.created_at).toLocaleDateString()}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button onClick={() => requireProjectAuth(project, () => navigate(`/editor/project/${project.id}`))}>
                          Open Editor
                        </Button>
                        <Button variant="secondary" onClick={() => requireProjectAuth(project, () => navigate(`/editor/project/${project.id}/panels`))}>
                          Panel Layouts
                        </Button>
                        <Button variant="secondary" onClick={() => requireProjectAuth(project, () => openEditModal(project))}>
                          Edit
                        </Button>
                        <Button variant="danger" onClick={() => requireProjectAuth(project, () => setDeletingProject(project))}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
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
            label="Project Owner"
            value={projectOwner}
            onChange={(e) => setProjectOwner(e.target.value)}
            placeholder="e.g. John Smith"
          />
          <Input
            label="Password (optional)"
            type="password"
            value={projectPassword}
            onChange={(e) => setProjectPassword(e.target.value)}
            placeholder="Leave blank for no protection"
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

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button variant="secondary" type="button" onClick={() => setFormOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !projectName || !initialLayoutName || !rackId} className="w-full sm:w-auto">
              {saving ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!editingProject} onClose={() => setEditingProject(undefined)} title="Edit Project">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input
            label="Project Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />
          <Input
            label="Project Owner"
            value={editOwner}
            onChange={(e) => setEditOwner(e.target.value)}
            placeholder="e.g. John Smith"
          />
          <Input
            label="Password"
            type="password"
            value={editPassword}
            onChange={(e) => setEditPassword(e.target.value)}
            placeholder="Leave blank to remove protection"
          />
          {editError && <p className="text-sm text-red-600">{editError}</p>}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button variant="secondary" type="button" onClick={() => setEditingProject(undefined)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !editName.trim()} className="w-full sm:w-auto">
              {saving ? 'Saving...' : 'Save Changes'}
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

      <PasswordPrompt
        isOpen={!!authProject}
        onCancel={() => { setAuthProject(null); setPendingAction(null) }}
        onSubmit={(input) => {
          if (input === authProject?.password) {
            sessionStorage.setItem(`project_auth_${authProject.id}`, 'true')
            setAuthProject(null)
            pendingAction?.()
            setPendingAction(null)
            return true
          }
          return false
        }}
        title={`"${authProject?.name}" is password-protected`}
        description="Enter the project password to continue."
      />
    </div>
  )
}
