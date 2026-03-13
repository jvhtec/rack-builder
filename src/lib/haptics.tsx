/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useWebHaptics } from 'web-haptics/react'
import type { HapticInput, TriggerOptions } from 'web-haptics'

type Trigger = (input?: HapticInput, options?: TriggerOptions) => void

const HapticsContext = createContext<{ trigger: Trigger }>({ trigger: () => {} })

export function HapticsProvider({ children }: { children: ReactNode }) {
  const { trigger } = useWebHaptics()

  const value = useMemo(() => ({ trigger }), [trigger])

  return <HapticsContext value={value}>{children}</HapticsContext>
}

export function useHaptics() {
  return useContext(HapticsContext)
}
