interface EmptyStateProps {
  onFillInput: (text: string) => void
}

const SUGGESTIONS = [
  { label: 'Criar um plano', prompt: 'Criar um plano de estudos semanal.' },
  { label: 'Organizar tarefas', prompt: 'Organizar minhas tarefas por prioridade.' }
]

function EmptyState({ onFillInput }: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex min-h-full flex-col justify-start px-1 pt-16 pb-8 md:pt-24 lg:justify-center lg:px-4">
      <div>
        <h1 className="text-center text-[18px] font-semibold leading-tight text-[var(--app-text)] md:text-[22px] lg:text-[26px]">
          Como posso ajudar?
        </h1>
        <p className="text-center mt-1.5 text-[11px] leading-relaxed text-[var(--app-text-soft)] md:text-xs">
          Posso organizar estudos, tarefas e ideias em um só lugar.
        </p>
      </div>
      <div className="justify-center py-2 mt-5 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            type="button"
            className="rounded-full border border-[var(--app-border-soft)] bg-[var(--app-panel-2)] px-3 py-1.5 text-[10px] text-[var(--app-text)] transition-colors hover:bg-[var(--app-panel-3)]"
            onClick={() => {
              onFillInput(s.prompt)
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default EmptyState
