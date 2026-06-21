import type { ReactNode } from 'react'

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
  children: ReactNode
}

function MobileDrawer({ open, onClose, children }: MobileDrawerProps): ReactNode | null {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onClose()
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Fechar menu"
      />

      {/* Drawer */}
      <div className="absolute left-0 top-0 h-full w-[176px] shadow-xl">
        {/* Close button */}
        <button
          type="button"
          aria-label="Fechar menu"
          className="absolute top-3 right-3 z-10 flex h-6 w-6 items-center justify-center rounded-[7px] border border-[var(--app-border-soft)] bg-[var(--app-panel-2)] text-[#cbd5e1]"
          onClick={onClose}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  )
}

export default MobileDrawer
