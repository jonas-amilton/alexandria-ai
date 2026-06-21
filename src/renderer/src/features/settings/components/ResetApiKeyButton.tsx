import type { ReactNode } from 'react'

interface ResetApiKeyButtonProps {
  onClear: () => void
}

function ResetApiKeyButton({ onClear }: ResetApiKeyButtonProps): ReactNode {
  return (
    <div className="border-b border-[var(--app-border)] bg-[var(--app-bg)] px-3.5 py-2 sm:px-4 lg:px-6">
      <button
        type="button"
        className="mx-auto block w-full max-w-[900px] text-left text-xs text-[var(--app-text-soft)] transition-colors hover:text-[var(--app-text)] xl:max-w-[960px]"
        onClick={() => {
          onClear()
        }}
      >
        Resetar API key
      </button>
    </div>
  )
}

export default ResetApiKeyButton
