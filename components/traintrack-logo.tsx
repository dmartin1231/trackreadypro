// TrackReadyPRO shield icon — use `dark` for light backgrounds, default for dark backgrounds
export function TrainTrackIcon({
  size = 36,
  dark = false,
}: {
  size?: number
  dark?: boolean
}) {
  const shieldFill = dark ? '#1a1a1a' : '#ffffff'
  const trackFill  = dark ? '#333333' : 'rgba(255,255,255,0.30)'
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path d="M50 14 L68 21 L68 50 C68 63 50 72 50 72 C50 72 32 63 32 50 L32 21 Z" fill={shieldFill} />
      <rect x="38" y="30" width="24" height="6" rx="3" fill={trackFill} />
      <rect x="38" y="30" width="17" height="6" rx="3" fill="#E24B4A" />
      <rect x="38" y="39" width="24" height="6" rx="3" fill={trackFill} />
      <rect x="38" y="39" width="11" height="6" rx="3" fill="#E24B4A" />
      <rect x="38" y="48" width="24" height="6" rx="3" fill={trackFill} />
      <rect x="38" y="48" width="21" height="6" rx="3" fill="#E24B4A" />
    </svg>
  )
}
