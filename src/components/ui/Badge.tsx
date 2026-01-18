import type { HTMLAttributes, ReactNode } from 'react'

// ============================================================
// TYPES
// ============================================================

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral'
export type BadgeSize = 'sm' | 'md'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  children: ReactNode
}

// ============================================================
// STYLES
// ============================================================

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-green-600/20 text-green-400 border-green-600/30',
  warning: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
  error: 'bg-red-600/20 text-red-400 border-red-600/30',
  info: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
  neutral: 'bg-slate-600/20 text-slate-400 border-slate-600/30',
}

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-1 text-sm',
}

// ============================================================
// BADGE COMPONENT
// ============================================================

export function Badge({
  variant = 'neutral',
  size = 'sm',
  children,
  className = '',
  ...props
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-md border
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  )
}
