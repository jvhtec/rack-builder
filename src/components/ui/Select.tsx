import type { ChangeEvent, SelectHTMLAttributes } from 'react'
import { useHaptic } from '../../contexts/HapticContext'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: { value: string; label: string }[]
}

export default function Select({ label, options, id, className = '', onChange, ...props }: SelectProps) {
  const { trigger } = useHaptic()
  const selectId = id ?? label.toLowerCase().replace(/\s+/g, '-')

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    trigger('nudge')
    onChange?.(e)
  }

  return (
    <div className={className}>
      <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <select
        id={selectId}
        className="w-full min-h-11 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        onChange={handleChange}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
