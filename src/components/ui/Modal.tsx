import { type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useHaptics } from '../../lib/haptics'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const { trigger } = useHaptics()

  useEffect(() => {
    if (isOpen) trigger('light')
  }, [isOpen, trigger])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-x-hidden sm:items-center">
      <div className="fixed inset-0 overflow-x-hidden bg-black/50" onClick={onClose} />
      <div className="relative bg-white shadow-xl w-full max-h-[95vh] overflow-auto rounded-t-xl sm:rounded-lg sm:max-w-lg sm:mx-4 sm:max-h-[90vh]">
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-4 py-4 border-b sm:px-6">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="min-h-11 min-w-11 text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="px-4 py-4 sm:px-6">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
