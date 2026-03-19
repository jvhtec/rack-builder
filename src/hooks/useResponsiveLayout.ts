import { useEffect, useState } from 'react'

export function useResponsiveLayout() {
  const [isMobile, setIsMobile] = useState<boolean>(() => window.innerWidth < 768)
  const [isTouchLikeDevice, setIsTouchLikeDevice] = useState<boolean>(
    () => window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 || 'ontouchstart' in window,
  )
  const [isPortrait, setIsPortrait] = useState<boolean>(
    () => window.matchMedia('(orientation: portrait)').matches,
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches)
    setIsMobile(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    const coarsePointerQuery = window.matchMedia('(pointer: coarse)')
    const updateTouchLike = () => {
      setIsTouchLikeDevice(coarsePointerQuery.matches || navigator.maxTouchPoints > 0 || 'ontouchstart' in window)
    }
    updateTouchLike()
    coarsePointerQuery.addEventListener('change', updateTouchLike)
    return () => coarsePointerQuery.removeEventListener('change', updateTouchLike)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)')
    setIsPortrait(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return { isMobile, isTouchLikeDevice, isPortrait }
}
