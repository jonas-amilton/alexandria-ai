import './assets/main.css'

import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Alexandria Render Error]:', error, info)
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-[var(--app-bg)] p-6 text-[var(--app-text)]">
          <div className="max-w-md rounded-[12px] border border-red-500/30 bg-red-500/10 p-6 text-center space-y-4">
            <div className="text-3xl">⚠️</div>
            <h2 className="text-base font-semibold text-red-400">
              Erro na Interface do Alexandria
            </h2>
            <p className="text-xs text-[var(--app-text-muted)] font-mono text-left bg-black/40 p-3 rounded overflow-x-auto">
              {this.state.error?.message || 'Erro desconhecido ao carregar componente.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-[8px] bg-[var(--app-accent)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--app-accent-hover)] transition-colors"
            >
              Recarregar Aplicação
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
