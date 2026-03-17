import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useLibraryAuth() {
  const [libraryPassword, setLibraryPasswordState] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [isAuthed, setIsAuthed] = useState(() => sessionStorage.getItem('library_auth') === 'true')
  const [showPrompt, setShowPrompt] = useState(false)
  const [showSetPrompt, setShowSetPrompt] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'library_password')
        .single()
      setLibraryPasswordState(data?.value ?? null)
      setLoaded(true)
    }
    void load()
  }, [])

  const setLibraryPassword = useCallback(async (password: string) => {
    await supabase
      .from('app_settings')
      .update({ value: password })
      .eq('key', 'library_password')
    setLibraryPasswordState(password)
    sessionStorage.setItem('library_auth', 'true')
    setIsAuthed(true)
  }, [])

  const requireAuth = useCallback(
    (action: () => void) => {
      if (!loaded) return
      if (isAuthed) {
        action()
        return
      }
      if (!libraryPassword) {
        // No password set yet — prompt user to create one
        setPendingAction(() => action)
        setShowSetPrompt(true)
      } else {
        // Password exists — prompt user to enter it
        setPendingAction(() => action)
        setShowPrompt(true)
      }
    },
    [loaded, isAuthed, libraryPassword],
  )

  const handleSubmit = useCallback(
    (input: string) => {
      if (input === libraryPassword) {
        sessionStorage.setItem('library_auth', 'true')
        setIsAuthed(true)
        setShowPrompt(false)
        pendingAction?.()
        setPendingAction(null)
        return true
      }
      return false
    },
    [libraryPassword, pendingAction],
  )

  const handleSetSubmit = useCallback(
    async (input: string) => {
      await setLibraryPassword(input)
      setShowSetPrompt(false)
      pendingAction?.()
      setPendingAction(null)
      return true
    },
    [setLibraryPassword, pendingAction],
  )

  const handleCancel = useCallback(() => {
    setShowPrompt(false)
    setShowSetPrompt(false)
    setPendingAction(null)
  }, [])

  return {
    loaded,
    isAuthed,
    requireAuth,
    showPrompt,
    showSetPrompt,
    handleSubmit,
    handleSetSubmit,
    handleCancel,
  }
}
