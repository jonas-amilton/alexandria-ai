import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import ModelSelectorDropdown from './ModelSelectorDropdown'
import type { ProviderId } from '../../../../../shared/providers'

/*
  ChatComposer.tsx — Alexandria.AI

  Caixa de comando tipo terminal/Raycast:
  - Toggle entre Agente (execução completa) e Plano (planejamento técnico sem execução).
  - Seletor de modelos inline com 1-clique para troca rápida sem ir em configurações.
  - Enter envia; Shift+Enter quebra linha; Cmd/Ctrl+K foca o composer.
  - Streaming em andamento = botão de envio vira botão de cancelamento (AbortSignal).
*/

export type ComposerMode = 'agent' | 'plan'

interface ChatComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value?: string) => void
  onCancel: () => void
  mode?: ComposerMode
  agentMode?: boolean
  onModeChange?: (mode: ComposerMode) => void
  onToggleAgentMode?: () => void
  isStreaming?: boolean
  isLoading?: boolean
  disabled?: boolean
  isProjectOpen?: boolean
  modelLabel?: string
  contextWindowLabel?: string
  currentProvider?: ProviderId
  currentModel?: string
  onSelectModel?: (provider: ProviderId, modelId: string) => void
  onOpenSettings?: () => void
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void
}

const MODE_CONFIG: Record<ComposerMode, { label: string; placeholder: string }> = {
  agent: {
    label: 'Agente',
    placeholder: 'Descreva a tarefa — o agente vai planejar, usar ferramentas e executar'
  },
  plan: {
    label: 'Plano',
    placeholder:
      'Descreva a funcionalidade — o agente vai analisar a base de código e criar um plano técnico sem executar alterações'
  }
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onCancel,
  mode,
  agentMode,
  onModeChange,
  onToggleAgentMode,
  isStreaming = false,
  isLoading = false,
  disabled = false,
  isProjectOpen = true,
  modelLabel = 'OpenRouter',
  contextWindowLabel,
  currentProvider = 'openrouter',
  currentModel = 'nvidia/nemotron-3.5-lightning:free',
  onSelectModel,
  onOpenSettings,
  onKeyDown
}: ChatComposerProps): ReactNode {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)

  // Resolução do modo (suporta tanto mode='agent'|'plan' quanto agentMode boolean)
  const currentMode: ComposerMode =
    mode !== undefined ? mode : agentMode !== false ? 'agent' : 'plan'

  const activeStreaming = isStreaming || isLoading

  // Auto-resize do textarea até teto de 200px
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    onKeyDown?.(event)
    if (event.defaultPrevented) return

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (value.trim() && !activeStreaming && !disabled) {
        onSubmit(value)
      }
    }
  }

  const handleSelectMode = (newMode: ComposerMode): void => {
    if (onModeChange) {
      onModeChange(newMode)
    } else if (onToggleAgentMode) {
      const willBeAgent = newMode === 'agent'
      if (willBeAgent !== (currentMode === 'agent')) {
        onToggleAgentMode()
      }
    }
  }

  const canSubmit = isProjectOpen && value.trim().length > 0 && !activeStreaming && !disabled

  return (
    <div className="border-t border-(--color-border) bg-(--color-panel) px-3 py-3">
      <div
        className={`rounded-(--radius-md) border bg-(--color-surface) transition-colors ${
          isFocused ? 'border-(--color-accent-blue)' : 'border-(--color-border)'
        }`}
      >
        {/* Barra superior: modo agente vs plano + seletor de modelo */}
        <div className="flex items-center justify-between gap-2 border-b border-(--color-border) px-2.5 py-1.5">
          <div className="flex items-center gap-1 rounded-(--radius-xs) bg-(--color-bg) p-0.5">
            {(['agent', 'plan'] as const).map((candidate) => (
              <button
                key={candidate}
                type="button"
                onClick={() => handleSelectMode(candidate)}
                className={`rounded-(--radius-xs) px-2 py-0.5 font-mono text-(length:--text-2xs) transition-colors ${
                  currentMode === candidate
                    ? 'bg-(--color-surface-raised) text-(--color-text) font-medium'
                    : 'text-(--color-text-faint) hover:text-(--color-text-muted)'
                }`}
                aria-pressed={currentMode === candidate}
              >
                {MODE_CONFIG[candidate].label}
              </button>
            ))}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setModelDropdownOpen((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-(--radius-xs) border border-(--color-border) px-1.5 py-0.5 font-mono text-(length:--text-2xs) text-(--color-text-faint) transition-colors hover:border-(--color-accent-blue) hover:text-(--color-text)"
              title="Clique para alternar o modelo diretamente"
            >
              <span className="max-w-48 truncate">{modelLabel}</span>
              {contextWindowLabel && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{contextWindowLabel}</span>
                </>
              )}
              <span className="text-[9px] text-(--color-text-muted)">▾</span>
            </button>

            {onSelectModel && (
              <ModelSelectorDropdown
                open={modelDropdownOpen}
                currentProvider={currentProvider}
                currentModel={currentModel}
                onClose={() => setModelDropdownOpen(false)}
                onSelectModel={onSelectModel}
                onOpenSettings={onOpenSettings}
              />
            )}
          </div>
        </div>

        {/* Campo de texto */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={!isProjectOpen || disabled}
          rows={1}
          placeholder={
            isProjectOpen ? MODE_CONFIG[currentMode].placeholder : 'Abra um projeto para começar'
          }
          className="max-h-50 w-full resize-none bg-transparent px-3 py-2.5 text-(length:--text-base) text-(--color-text) placeholder:text-(--color-text-faint) focus:outline-none disabled:cursor-not-allowed"
        />

        {/* Rodapé: atalhos + ação */}
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
          <div className="flex items-center gap-2.5 font-mono text-(length:--text-2xs) text-(--color-text-faint)">
            <KeyHint keys={['Enter']} label="enviar" />
            <KeyHint keys={['Shift', 'Enter']} label="nova linha" />
            <KeyHint keys={['⌘', 'K']} label="focar" />
          </div>

          {activeStreaming ? (
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-1.5 rounded-(--radius-sm) border border-(--color-border-strong) px-2.5 py-1 text-(length:--text-xs) text-(--color-text) transition-colors hover:border-(--color-accent-red) hover:text-(--color-accent-red)"
            >
              <StopIcon className="size-3" />
              Cancelar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => canSubmit && onSubmit(value)}
              disabled={!canSubmit}
              className="flex items-center gap-1.5 rounded-(--radius-sm) bg-(--color-accent-blue) px-2.5 py-1 text-(length:--text-xs) font-medium text-(--color-bg) transition-colors disabled:cursor-not-allowed disabled:bg-(--color-surface-raised) disabled:text-(--color-text-faint)"
            >
              Enviar
              <ArrowUpIcon className="size-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function KeyHint({ keys, label }: { keys: string[]; label: string }): ReactNode {
  return (
    <span className="flex items-center gap-1">
      <span className="flex items-center gap-0.5">
        {keys.map((key) => (
          <kbd
            key={key}
            className="rounded-(--radius-xs) border border-(--color-border) bg-(--color-bg) px-1 py-0.5 leading-none"
          >
            {key}
          </kbd>
        ))}
      </span>
      {label}
    </span>
  )
}

function StopIcon(props: React.SVGProps<SVGSVGElement>): ReactNode {
  return (
    <svg viewBox="0 0 12 12" fill="currentColor" {...props}>
      <rect x="2" y="2" width="8" height="8" rx="1" />
    </svg>
  )
}

function ArrowUpIcon(props: React.SVGProps<SVGSVGElement>): ReactNode {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path d="M6 10V2M2.5 5.5L6 2l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default ChatComposer
