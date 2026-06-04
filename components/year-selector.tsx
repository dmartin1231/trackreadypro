'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

export default function YearSelector({
  options,
  currentValue,
  label,
}: {
  options: Array<{ value: number; label: string }>
  currentValue: number
  label: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', value)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">{label}:</span>
      <select
        value={currentValue}
        onChange={(e) => handleChange(e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black bg-white text-gray-700 font-medium"
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
