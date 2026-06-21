interface ApiKeyInputProps {
  value: string
  onChange: (value: string) => void
  onSave: () => void
  canPersist: boolean | undefined
}

function ApiKeyInput({ value, onChange, onSave, canPersist }: ApiKeyInputProps): React.JSX.Element {
  return (
    <div className="border-b border-[var(--app-border)] bg-[var(--app-bg)] px-3.5 py-3 sm:px-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-[900px] gap-2 xl:max-w-[960px]">
        <input
          type="password"
          className="flex-1 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-1.5 text-xs text-[var(--app-text)] placeholder-[var(--app-text-muted)] outline-none focus:border-[var(--app-accent)] focus:ring-1 focus:ring-[var(--app-accent)]"
          placeholder="sk-…"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void onSave()
            }
          }}
        />
        <button
          type="button"
          className="rounded-[10px] bg-[var(--app-accent)] px-4 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-[var(--app-accent-hover)] disabled:opacity-50"
          disabled={!value.trim()}
          onClick={() => {
            void onSave()
          }}
        >
          Salvar
        </button>
        {canPersist === false && (
          <span className="self-center text-[9px] text-red-400">
            Linux: encryption not available
          </span>
        )}
      </div>
    </div>
  )
}

export default ApiKeyInput
