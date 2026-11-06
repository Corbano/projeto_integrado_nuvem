import type { SelectHTMLAttributes } from 'react'
import { cn } from './cn'
import { controlClasses } from './Input'

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export function Select({ className, children, ...rest }: SelectProps) {
  return (
    <select {...rest} className={cn(controlClasses, 'pr-8', className)}>
      {children}
    </select>
  )
}
