/** Pares fundo/texto suaves do Avatar, todos com texto >= 4.5:1 sobre o próprio fundo (ver components.test, que resolve os tokens). */
export const AVATAR_TONES = [
  { bg: 'var(--color-info-fundo)', fg: 'var(--color-azul)' },
  { bg: 'var(--color-ok-fundo)', fg: 'var(--color-ok-texto)' },
  { bg: 'var(--color-atencao-fundo)', fg: 'var(--color-atencao-texto)' },
  { bg: 'var(--color-critico-fundo)', fg: 'var(--color-critico-texto)' },
  { bg: 'var(--color-violeta-fundo)', fg: 'var(--color-violeta-texto)' },
  { bg: 'var(--color-ciano-fundo)', fg: 'var(--color-ciano-texto)' },
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
