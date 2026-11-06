import { AVATAR_TONES, avatarTone, initials } from './avatarTone'
import { cn } from './cn'

export interface AvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
  /** Quando o nome já aparece ao lado, o avatar é só decoração. */
  decorative?: boolean
  className?: string
}

const sizes = {
  sm: 'size-7 text-[11px]',
  md: 'size-9 text-mini',
  lg: 'size-11 text-corpo',
}

/** Iniciais sobre uma cor suave que depende só do nome (determinística). */
export function Avatar({ name, size = 'md', decorative = false, className }: AvatarProps) {
  const toneIndex = avatarTone(name)
  const tone = AVATAR_TONES[toneIndex]
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
      data-tone={toneIndex}
      style={{ backgroundColor: tone.bg, color: tone.fg }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight select-none',
        sizes[size],
        className,
      )}
    >
      <span aria-hidden="true">{initials(name)}</span>
    </span>
  )
}
