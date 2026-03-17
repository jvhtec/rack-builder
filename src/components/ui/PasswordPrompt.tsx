import { type FormEvent, useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import Input from './Input'
import Button from './Button'

interface PasswordPromptProps {
  isOpen: boolean
  onSubmit: (password: string) => boolean | Promise<boolean>
  onCancel: () => void
  title?: string
  description?: string
  submitLabel?: string
}

export default function PasswordPrompt({
  isOpen,
  onSubmit,
  onCancel,
  title = 'Password Required',
  description,
  submitLabel = 'Unlock',
}: PasswordPromptProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setValue('')
      setError(null)
      // Auto-focus after modal animation
      const id = window.setTimeout(() => inputRef.current?.focus(), 50)
      return () => window.clearTimeout(id)
    }
  }, [isOpen])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    setSubmitting(true)
    try {
      const ok = await onSubmit(value.trim())
      if (!ok) {
        setError('Incorrect password')
        setValue('')
        inputRef.current?.focus()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
        )}
        <Input
          ref={inputRef}
          label="Password"
          type="password"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            if (error) setError(null)
          }}
          autoComplete="off"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" type="button" onClick={onCancel} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !value.trim()} className="w-full sm:w-auto">
            {submitting ? 'Checking...' : submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
