import { createContext, useContext, type ReactNode } from 'react'
import { useWebHaptics } from 'web-haptics/react'
import type { HapticInput, TriggerOptions } from 'web-haptics'

interface HapticContextValue {
  trigger: (input?: HapticInput, options?: TriggerOptions) => void
  cancel: () => void
  isSupported: boolean
}

const HapticContext = createContext<HapticContextValue | null>(null)

export function HapticProvider({ children }: { children: ReactNode }) {
  const { trigger, cancel, isSupported } = useWebHaptics()

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
