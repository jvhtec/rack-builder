import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Button from '../components/ui/Button'

export default function LegacyLayoutEditorRedirectPage() {
  const { layoutId } = useParams<{ layoutId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function resolveLayoutRoute() {
      if (!layoutId) {
        setError('Missing layout id')
        return
      }

      const { data, error: layoutError } = await supabase
        .from('layouts')
        .select('id, project_id')
        .eq('id', layoutId)
        .single()

      if (layoutError || !data) {
        setError('Layout not found')
        return
      }

      const nextSearch = new URLSearchParams(location.search)
      nextSearch.set('layout', data.id)
      navigate(`/editor/project/${data.project_id}?${nextSearch.toString()}`, { replace: true })
    }

    void resolveLayoutRoute()
  }, [layoutId, location.search, navigate])

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => navigate('/projects')}>Back to Projects</Button>
        </div>
      </div>
    )
  }

  return <div className="flex items-center justify-center h-screen text-gray-500">Redirecting...</div>
}
