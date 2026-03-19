export function DarkLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-slate-400 md:text-sm">
      {children}
    </span>
  )
}

export function DarkInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <DarkLabel>{label}</DarkLabel>
      <input
        className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/60 md:text-lg"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

export function DarkSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <DarkLabel>{label}</DarkLabel>
      <select
        className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-slate-100 transition focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/60 md:text-lg"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}
