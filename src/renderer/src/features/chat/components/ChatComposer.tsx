import { useEffect, useRef } from 'react'

interface ChatComposerProps {
  value: string
  disabled: boolean
  isLoading: boolean
  onChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
}

function ChatComposer({
  value,
  disabled,
  isLoading,
  onChange,
  onSubmit,
  onCancel,
  onKeyDown
}: ChatComposerProps): React.JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const textarea = textareaRef.current

    if (!textarea) {
      return
    }

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
  }, [value])

  return (
    <div className="flex-shrink-0 bg-[var(--app-bg)] px-4 pb-2.5 pt-3.5 sm:px-6 md:px-8 lg:px-10">
      <div className="mx-auto w-full">
        <div className="w-full rounded-[13px] border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
          <textarea
            ref={textareaRef}
            className="w-full resize-none border-none bg-transparent text-[11px] leading-relaxed text-[var(--app-text)] placeholder-[var(--app-text-muted)] outline-none"
            style={{ minHeight: '36px', maxHeight: '120px' }}
            placeholder="Pergunte qualquer coisa..."
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
            }}
            onKeyDown={onKeyDown}
            disabled={disabled}
            rows={1}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`
            }}
          />

          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {/* + button — visual only */}
              <button
                type="button"
                aria-label="Anexar"
                className="flex h-5.5 w-5.5 items-center justify-center rounded-[7px] border border-[var(--app-border-soft)] bg-[var(--app-panel)] text-[var(--app-text-soft)]"
                disabled
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>

              {/* Web chip — visual only */}
              <span className="inline-flex h-5.5 items-center rounded-full border border-[var(--app-border-soft)] bg-[var(--app-panel)] px-2 text-[9px] text-[var(--app-text-soft)]">
                Web
              </span>
            </div>

            {/* Send / Cancel button */}
            {isLoading ? (
              <button
                type="button"
                aria-label="Parar geração"
                className="flex h-[20px] w-[20px] items-center justify-center rounded-[7px] bg-[var(--app-accent)] text-white transition-colors hover:bg-[var(--app-accent-hover)]"
                onClick={() => {
                  onCancel()
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                aria-label="Enviar mensagem"
                className="flex h-[20px] w-[20px] items-center justify-center rounded-[7px] bg-[var(--app-accent)] text-white transition-colors hover:bg-[var(--app-accent-hover)] disabled:opacity-40"
                disabled={!value.trim()}
                onClick={() => {
                  onSubmit()
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <p className="mt-2 text-center text-[8px] text-[#536174]">
          Alexandria.AI pode cometer erros. Verifique informações importantes.
        </p>
      </div>
    </div>
  )
}

export default ChatComposer
