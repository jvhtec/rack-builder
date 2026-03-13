import type { ButtonHTMLAttributes } from 'react'
import { useHaptics } from '../../lib/haptics'

type Variant = 'primary' | 'secondary' | 'danger'

const variantStyles: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export default function Button({
  variant = 'primary',
  className = '',
  children,
  onClick,
  ...props
}: ButtonProps) {
  const { trigger } = useHaptics()

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    trigger('selection')
    onClick?.(e)
  }

  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${className}`}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  )
}
