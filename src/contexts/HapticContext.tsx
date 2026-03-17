import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { useWebHaptics } from 'web-haptics/react'
import type { HapticInput, TriggerOptions } from 'web-haptics'

interface HapticContextValue {
  trigger: (input?: HapticInput, options?: TriggerOptions) => void
  cancel: () => void
  isSupported: boolean
}

const HapticContext = createContext<HapticContextValue | null>(null)

const BUTTON_SELECTOR = 'button, [role="button"], a[href], input[type="button"], input[type="submit"]'

export function HapticProvider({ children }: { children: ReactNode }) {
  const { trigger, cancel, isSupported } = useWebHaptics()
  const triggerRef = useRef(trigger)
  triggerRef.current = trigger

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      const el = (e.target as Element)?.closest?.(BUTTON_SELECTOR)
      if (el && !(el as HTMLButtonElement).disabled) {
        triggerRef.current('nudge')
      }
    }
    document.addEventListener('pointerdown', handler, { passive: true })
    return () => document.removeEventListener('pointerdown', handler)
  }, [])

  return (
    <HapticContext.Provider value={{ trigger, cancel, isSupported }}>
      {children}
    </HapticContext.Provider>
  )
}

export function useHaptic() {
  const ctx = useContext(HapticContext)
  if (!ctx) {
    return {
      trigger: () => {},
      cancel: () => {},
      isSupported: false,
    }
  }
  return ctx
}
