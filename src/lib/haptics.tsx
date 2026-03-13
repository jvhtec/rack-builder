/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'

type HapticPreset = 'success' | 'warning' | 'error' | 'light' | 'medium' | 'heavy' | 'nudge' | 'selection'
type Trigger = (preset?: HapticPreset) => void

const patterns: Record<HapticPreset, number[]> = {
  // [vibrate, pause, vibrate, ...] in ms
  success: [30, 60, 40],
  warning: [40, 100, 40],
  error: [40, 40, 40, 40, 40],
  light: [15],
  medium: [25],
  heavy: [35],
  nudge: [80, 80, 50],
  selection: [8],
}

const HapticsContext = createContext<{ trigger: Trigger }>({ trigger: () => {} })

/**
 * Haptic feedback provider.
 *
 * Android: uses navigator.vibrate() directly.
 * iOS Safari 17.4+: toggles a rendered-but-invisible <input type="checkbox" switch>
 * which triggers native system haptics on state change.
 */
export function HapticsProvider({ children }: { children: ReactNode }) {
  const checkboxRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    // Only create the iOS checkbox fallback when vibrate is unavailable
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) return

    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    // Visually hidden but still rendered — display:none prevents iOS haptics
    Object.assign(input.style, {
      position: 'fixed',
      top: '-100px',
      left: '-100px',
      width: '1px',
      height: '1px',
      opacity: '0',
      pointerEvents: 'none',
    })
    document.body.appendChild(input)
    checkboxRef.current = input

    return () => {
      input.remove()
      checkboxRef.current = null
    }
  }, [])

  const triggerRef = useRef<Trigger>(() => {})

  // Stable trigger function that reads refs at call time
  useEffect(() => {
    triggerRef.current = (preset: HapticPreset = 'medium') => {
      const pattern = patterns[preset]
      if (!pattern) return

      // Android / Chrome: Vibration API
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern)
        return
      }

      // iOS Safari: toggle the switch checkbox to trigger system haptics
      if (checkboxRef.current) {
        checkboxRef.current.checked = !checkboxRef.current.checked
      }
    }
  }, [])

  // Stable callback reference that delegates to triggerRef
  const trigger: Trigger = (preset) => triggerRef.current(preset)

  return (
    <HapticsContext value={{ trigger }}>
      {children}
    </HapticsContext>
  )
}

export function useHaptics() {
  return useContext(HapticsContext)
}
