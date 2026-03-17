import { useState, useEffect, useCallback } from 'react'
import type { Project } from '../types'

export function useProjectAuth(project: Project | null) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    if (!project) return
    if (!project.password) {
      setIsAuthenticated(true)
      return
    }
    const key = `project_auth_${project.id}`
    if (sessionStorage.getItem(key) === 'true') {
      setIsAuthenticated(true)
    } else {
      setShowPrompt(true)
    }
  }, [project])

  const handleSubmit = useCallback(
    (input: string) => {
      if (!project?.password) return true
      if (input === project.password) {
        sessionStorage.setItem(`project_auth_${project.id}`, 'true')
        setIsAuthenticated(true)
        setShowPrompt(false)
        return true
      }
      return false
    },
    [project],
  )

  const handleCancel = useCallback(() => {
    setShowPrompt(false)
  }, [])

  return { isAuthenticated, showPrompt, handleSubmit, handleCancel }
}
