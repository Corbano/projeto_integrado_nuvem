/** Pares fundo/texto suaves do Avatar, todos com texto >= 4.5:1 sobre o próprio fundo (ver ui.test). */
export const AVATAR_TONES = [
  { bg: '#E8EEFF', fg: '#2457E6' },
  { bg: '#E3F6EE', fg: '#13744D' },
  { bg: '#FFF3D6', fg: '#8A5A00' },
  { bg: '#FDE8E9', fg: '#B3262B' },
  { bg: '#EFE9FD', fg: '#5530BD' },
  { bg: '#E1F3F8', fg: '#0A6580' },
] as const

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0][0]
  const last = words.length > 1 ? words[words.length - 1][0] : (words[0][1] ?? '')
  return (first + last).toUpperCase()
}

/** Índice estável (hash djb2) para a mesma pessoa ter sempre a mesma cor. */
export function avatarTone(name: string): number {
  let hash = 5381
  for (const char of name.trim().toLowerCase()) hash = ((hash << 5) + hash + char.charCodeAt(0)) >>> 0
  return hash % AVATAR_TONES.length
}
