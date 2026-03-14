import { createContext, useContext, useCallback, type ReactNode } from 'react'

export type HapticType = 'nudge' | 'success' | 'error' | 'buzz'

const PATTERNS: Record<HapticType, number | number[]> = {
  nudge:   10,
  success: 25,
  error:   [10, 50, 10],
  buzz:    50,
}

interface HapticsContextValue {
  haptic: (type: HapticType) => void
}

const HapticsContext = createContext<HapticsContextValue>({ haptic: () => {} })

export function HapticsProvider({ children }: { children: ReactNode }) {
  const haptic = useCallback((type: HapticType) => {
    navigator.vibrate?.(PATTERNS[type])
  }, [])

  return (
    <HapticsContext.Provider value={{ haptic }}>
      {children}
    </HapticsContext.Provider>
  )
}

export function useHaptics() {
  return useContext(HapticsContext)
}
