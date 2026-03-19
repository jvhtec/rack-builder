import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Project } from '../types'

export function useProject(projectId: string | undefined) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadProject() {
      if (!projectId) {
        setError('Missing project id')
        setLoading(false)
        return
      }

      setLoading(true)
      const { data, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (!active) return

      if (projectError || !data) {
        setProject(null)
        setError('Project not found')
        setLoading(false)
        return
      }

      setProject(data as Project)
      setError(null)
      setLoading(false)
    }

    void loadProject()

    return () => {
      active = false
    }
  }, [projectId])

  return { project, loading, error }
}
