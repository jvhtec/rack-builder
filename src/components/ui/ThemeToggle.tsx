interface ThemeToggleProps {
  isDark: boolean
  toggle: () => void
  className?: string
}

export default function ThemeToggle({ isDark, toggle, className = '' }: ThemeToggleProps) {
  return (
    <button
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`min-h-9 min-w-9 flex items-center justify-center rounded-md text-base transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${className}`}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  )
}
