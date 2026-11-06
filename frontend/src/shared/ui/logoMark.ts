/** Engrenagem de 8 dentes da marca (viewBox 0 0 24 24): dentes trapezoidais em volta de um aro. */
export const GEAR_PATH = (() => {
  const cx = 12
  const cy = 12
  const outer = 10.4
  const root = 7.9
  const teeth = 8
  const halfTop = 0.2
  const halfBase = 0.3
  const pt = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(3)} ${(cy + r * Math.sin(a)).toFixed(3)}`
  let d = ''
  for (let i = 0; i < teeth; i++) {
    const a = (i * 2 * Math.PI) / teeth - Math.PI / 2
    const next = ((i + 1) * 2 * Math.PI) / teeth - Math.PI / 2
    d += `${i === 0 ? 'M' : 'L'}${pt(root, a - halfBase)} L${pt(outer, a - halfTop)} L${pt(outer, a + halfTop)} L${pt(root, a + halfBase)} `
    d += `A${root} ${root} 0 0 1 ${pt(root, next - halfBase)} `
  }
  return `${d}Z`
})()
