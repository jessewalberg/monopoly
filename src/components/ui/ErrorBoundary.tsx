import { Component  } from 'react'
import type {ReactNode} from 'react';

// ============================================================
// TYPES
// ============================================================

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

// ============================================================
// ERROR BOUNDARY COMPONENT
// ============================================================

/**
 * Error boundary to catch React rendering errors
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />
      )
    }

    return this.props.children
  }
}

// ============================================================
// ERROR FALLBACK COMPONENT
// ============================================================

interface ErrorFallbackProps {
  error: Error | null
  onRetry?: () => void
  title?: string
  description?: string
}

export function ErrorFallback({
  error,
  onRetry,
  title = 'Something went wrong',
  description,
}: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
      <div className="text-5xl mb-4">
        <span role="img" aria-label="Error">
          💥
        </span>
      </div>
      <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
      <p className="text-slate-400 mb-4 max-w-md">
        {description || 'We encountered an unexpected error. Please try again.'}
      </p>
      {error && (
        <details className="mb-4 max-w-md text-left">
          <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-400">
            Technical details
          </summary>
          <pre className="mt-2 p-3 bg-slate-800 rounded text-xs text-red-400 overflow-x-auto">
            {error.message}
          </pre>
        </details>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  )
}

// ============================================================
// QUERY ERROR COMPONENT
// ============================================================

interface QueryErrorProps {
  error: Error | string | null
  onRetry?: () => void
}

export function QueryError({ error, onRetry }: QueryErrorProps) {
  const errorMessage =
    typeof error === 'string' ? error : error?.message || 'Unknown error'

  return (
    <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <span className="text-red-400 text-xl">
          <span role="img" aria-label="Warning">
            ⚠️
          </span>
        </span>
        <div className="flex-1">
          <h3 className="text-red-400 font-medium">Error loading data</h3>
          <p className="text-red-300/80 text-sm mt-1">{errorMessage}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 text-sm text-red-400 hover:text-red-300 underline"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// CONNECTION ERROR COMPONENT
// ============================================================

interface ConnectionErrorProps {
  onRetry?: () => void
}

export function ConnectionError({ onRetry }: ConnectionErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
      <div className="text-5xl mb-4">
        <span role="img" aria-label="Disconnected">
          🔌
        </span>
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Connection Lost</h2>
      <p className="text-slate-400 mb-4">
        Unable to connect to the server. Please check your internet connection.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
        >
          Reconnect
        </button>
      )}
    </div>
  )
}

// ============================================================
// NOT FOUND COMPONENT
// ============================================================

interface NotFoundProps {
  title?: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export function NotFound({
  title = 'Not Found',
  description = "The page or resource you're looking for doesn't exist.",
  actionLabel = 'Go Back',
  onAction,
}: NotFoundProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center">
      <div className="text-6xl mb-4">
        <span role="img" aria-label="Not found">
          🔍
        </span>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
      <p className="text-slate-400 mb-6 max-w-md">{description}</p>
      {onAction && (
        <button
          onClick={onAction}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
