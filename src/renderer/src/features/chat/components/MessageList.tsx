import { Fragment, useEffect, useRef, type ReactNode } from 'react'
import { ToolActivityCard, type ToolActivityItem } from './ToolActivityCard'
import type { ChatMessage } from '../../../../../shared/chat'
import mascotImg from '../../../assets/mascot.png'

/*
  MessageList.tsx — Alexandria.AI

  Decisão central: NÃO usar bolhas de chat (WhatsApp/Messenger). Mensagens
  do usuário e do agente são tratadas como entradas de um documento/log:
  - Usuário: rótulo "você" à esquerda, texto em peso normal, sem fundo de bolha.
  - Agente: rótulo do modelo, texto em peso normal, ações de ferramenta
    intercaladas no fluxo exatamente na ordem em que ocorreram.
  - Bloco de streaming e execução de ferramentas ativos exibidos de forma limpa.
*/

interface MessageListProps {
  messages: ChatMessage[]
  streamingContent?: string
  toolActivity?: ToolActivityItem[]
  isStreaming?: boolean
  onFillInput?: (text: string) => void
}

export function MessageList({
  messages,
  streamingContent = '',
  toolActivity = [],
  isStreaming = false,
  onFillInput
}: MessageListProps): ReactNode {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, streamingContent.length, toolActivity.length])

  const hasContent = messages.length > 0 || streamingContent.length > 0 || toolActivity.length > 0

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-220 flex-col gap-4 px-6 py-5">
        {!hasContent && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <img
              src={mascotImg}
              alt="Alexandria.AI Mascote"
              className="mb-4 size-24 object-contain drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
            />
            <div className="mb-2 font-mono text-(length:--text-xs) text-(--color-text-faint)">
              Alexandria.AI — Agente Autônomo & RAG Local
            </div>
            <p className="max-w-md text-(length:--text-sm) text-(--color-text-muted)">
              Converse com a base de código, execute planos de refatoração ou consulte a memória
              persistente.
            </p>
            {onFillInput && (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {[
                  'Explique a arquitetura e componentes principais',
                  'Faça uma busca semântica via RAG no projeto',
                  'Liste os servidores MCP e ferramentas disponíveis'
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => onFillInput(suggestion)}
                    className="rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) px-2.5 py-1.5 font-mono text-(length:--text-2xs) text-(--color-text-muted) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text)"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((message, idx) => (
          <Fragment key={idx}>
            <article className="group flex gap-3">
              <span
                className={`mt-0.5 shrink-0 font-mono text-(length:--text-2xs) ${
                  message.role === 'user'
                    ? 'text-(--color-text-faint)'
                    : 'text-(--color-accent-blue)'
                }`}
              >
                {message.role === 'user' ? 'você' : 'agente'}
              </span>

              <div className="min-w-0 flex-1">
                <div className="whitespace-pre-wrap text-(length:--text-base) leading-relaxed text-(--color-text)">
                  {message.content}
                </div>
              </div>
            </article>
          </Fragment>
        ))}

        {toolActivity.length > 0 && (
          <div className="flex flex-col gap-1.5 pl-9">
            {toolActivity.map((activity, idx) => (
              <ToolActivityCard key={activity.id || activity.callId || idx} activity={activity} />
            ))}
          </div>
        )}

        {streamingContent.length > 0 && (
          <article className="group flex gap-3">
            <span className="mt-0.5 shrink-0 font-mono text-(length:--text-2xs) text-(--color-accent-blue)">
              agente
            </span>
            <div className="min-w-0 flex-1">
              <div className="whitespace-pre-wrap text-(length:--text-base) leading-relaxed text-(--color-text)">
                {streamingContent}
              </div>
            </div>
          </article>
        )}

        {(isStreaming || (streamingContent.length === 0 && toolActivity.length > 0)) && (
          <div className="flex items-center gap-1.5 pl-9">
            <span className="size-1.5 animate-pulse rounded-full bg-(--color-accent-blue)" />
            <span className="font-mono text-(length:--text-2xs) text-(--color-text-faint)">
              processando
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}

export default MessageList
