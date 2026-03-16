import { useRef, useLayoutEffect } from 'react'

interface ScaledNotesProps {
  text: string
  textColor?: string
}

/**
 * Renders text centered and auto-scaled to fill its nearest positioned ancestor.
 * The parent must have `position: relative` and defined dimensions.
 */
export default function ScaledNotes({ text, textColor = '#ddd' }: ScaledNotesProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const textEl = textRef.current
    if (!wrap || !textEl || wrap.clientHeight === 0 || wrap.clientWidth === 0) return

    // Binary search for the largest font size that still fits the container
    let lo = 5
    let hi = 80
    textEl.style.fontSize = `${hi}px`

    while (hi - lo > 0.5) {
      const mid = (lo + hi) / 2
      textEl.style.fontSize = `${mid}px`
      if (textEl.scrollHeight <= wrap.clientHeight && textEl.scrollWidth <= wrap.clientWidth) {
        lo = mid
      } else {
        hi = mid
      }
    }
    textEl.style.fontSize = `${lo}px`
  })

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div
        ref={textRef}
        style={{
          color: textColor,
          textAlign: 'center',
          whiteSpace: 'pre-line',
          wordBreak: 'break-word',
          lineHeight: 1.25,
          fontWeight: 600,
          width: '100%',
        }}
      >
        {text}
      </div>
    </div>
  )
}
