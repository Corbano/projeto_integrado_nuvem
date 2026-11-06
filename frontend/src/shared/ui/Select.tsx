import type { SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from './cn'
import { controlClasses } from './Input'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string
}

export function Select({ className, wrapperClassName, children, ...rest }: SelectProps) {
  return (
    <div className={cn('relative', wrapperClassName)}>
      <select {...rest} className={cn(controlClasses, 'cursor-pointer appearance-none pr-10', className)}>
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        size={18}
        strokeWidth={1.75}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-tinta-suave"
      />
    </div>
  )
}
