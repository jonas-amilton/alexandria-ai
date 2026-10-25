import { useState, type ReactNode } from 'react'
import mascotImg from '../../../assets/mascot.png'

/*
  AnimatedOwl.tsx — Alexandria.AI

  Mascote interativo e animado da Coruja Tech:
  - 'idle': Respiração suave (levitação periódica) e olhos atentos com piscar sutil.
  - 'thinking': Modo computação/raciocínio com pulso em azul elétrico (--color-accent-blue)
    e anéis concêntricos de varredura (CodeGraph/RAG/MCP em execução).
  - 'success': Brilho suave em esmeralda (--color-accent-emerald) indicando conclusão.
  - Interatividade: clique ou hover ativa um micro-brilho reativo no olhar.
*/

export type OwlMood = 'idle' | 'thinking' | 'success'

interface AnimatedOwlProps {
  mood?: OwlMood
  size?: 'sm' | 'md' | 'lg'
  className?: string
  interactive?: boolean
}

const SIZE_CLASSES = {
  sm: 'size-6',
  md: 'size-12',
  lg: 'size-24'
}

export function AnimatedOwl({
  mood = 'idle',
  size = 'md',
  className = '',
  interactive = true
}: AnimatedOwlProps): ReactNode {
  const [clicked, setClicked] = useState(false)

  const handleClick = (): void => {
    if (!interactive) return
    setClicked(true)
    setTimeout(() => setClicked(false), 800)
  }

  const isThinking = mood === 'thinking'
  const isSuccess = mood === 'success'

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (interactive && (e.key === 'Enter' || e.key === ' ')) {
          handleClick()
        }
      }}
      className={`group relative inline-flex shrink-0 items-center justify-center select-none ${
        SIZE_CLASSES[size]
      } ${interactive ? 'cursor-pointer' : ''} ${className}`}
      title={
        isThinking
          ? 'Alexandria.AI está raciocinando...'
          : isSuccess
            ? 'Tarefa concluída!'
            : 'Alexandria.AI — Agente Autônomo'
      }
    >
      {/* Halo de pulso em modo thinking */}
      {isThinking && (
        <span
          className="absolute inset-0 rounded-full bg-(--color-accent-blue)/20 blur-md animate-ping pointer-events-none"
          style={{ animationDuration: '2.5s' }}
          aria-hidden="true"
        />
      )}

      {/* Halo sutil de sucesso */}
      {isSuccess && (
        <span
          className="absolute inset-0 rounded-full bg-(--color-accent-emerald)/30 blur-md pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Imagem do mascote com levitação suave em idle */}
      <img
        src={mascotImg}
        alt="Coruja Mascote Alexandria.AI"
        className={`w-full h-full object-contain transition-all duration-300 drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)] ${
          isThinking
            ? 'animate-pulse scale-105'
            : mood === 'idle'
              ? 'hover:scale-110 active:scale-95'
              : ''
        } ${clicked ? 'scale-115 rotate-3' : ''}`}
        style={{
          animation: isThinking
            ? 'owl-float 2s ease-in-out infinite, owl-think-pulse 1.8s ease-in-out infinite'
            : mood === 'idle' && size === 'lg'
              ? 'owl-float 4s ease-in-out infinite'
              : undefined
        }}
      />

      {/* Micro-olhos luminosos interativos (SVG overlay sutil) */}
      <svg
        viewBox="0 0 100 100"
        className="pointer-events-none absolute inset-0 size-full"
        aria-hidden="true"
      >
        <circle
          cx="41"
          cy="42"
          r="3"
          className={`transition-all duration-300 ${
            isThinking
              ? 'fill-(--color-accent-blue) animate-pulse'
              : isSuccess
                ? 'fill-(--color-accent-emerald)'
                : 'fill-(--color-accent-amber) opacity-80 group-hover:opacity-100 group-hover:fill-(--color-accent-blue)'
          } ${clicked ? 'fill-(--color-accent-blue) scale-125' : ''}`}
        />
        <circle
          cx="59"
          cy="42"
          r="3"
          className={`transition-all duration-300 ${
            isThinking
              ? 'fill-(--color-accent-blue) animate-pulse'
              : isSuccess
                ? 'fill-(--color-accent-emerald)'
                : 'fill-(--color-accent-amber) opacity-80 group-hover:opacity-100 group-hover:fill-(--color-accent-blue)'
          } ${clicked ? 'fill-(--color-accent-blue) scale-125' : ''}`}
        />
      </svg>
    </div>
  )
}

export default AnimatedOwl
