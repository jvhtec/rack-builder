import { type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full overflow-auto rounded-t-xl bg-white shadow-xl sm:max-w-lg sm:rounded-lg">
        <div className="flex items-center justify-between border-b px-4 py-4 sm:px-6">
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
