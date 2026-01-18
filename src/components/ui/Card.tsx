import type { HTMLAttributes, ReactNode } from 'react'

// ============================================================
// TYPES
// ============================================================

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

// ============================================================
// CARD COMPONENTS
// ============================================================

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div
      className={`bg-slate-800 rounded-lg shadow-lg overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  children,
  className = '',
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={`px-4 py-3 border-b border-slate-700 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardBody({
  children,
  className = '',
  ...props
}: CardBodyProps) {
  return (
    <div className={`p-4 ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({
  children,
  className = '',
  ...props
}: CardFooterProps) {
  return (
    <div
      className={`px-4 py-3 border-t border-slate-700 bg-slate-800/50 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
