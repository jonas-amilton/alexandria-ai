// Provider catalog shared by the main and renderer processes.

export const PROVIDER_IDS = ['deepseek', 'openrouter'] as const

export type ProviderId = (typeof PROVIDER_IDS)[number]

export interface ProviderModelOption {
  id: string
  label: string
  isFree?: boolean
  contextLength?: number
  description?: string
}

export interface ProviderDefinition {
  id: ProviderId
  label: string
  baseUrl: string
  keyPlaceholder: string
  /**
   * Prefixes accepted when saving a key. Empty means "accept any non-empty
   * value" so custom OpenAI-compatible deployments are not locked out.
   */
  keyPrefixes: readonly string[]
  defaultModel: string
  models: readonly ProviderModelOption[]
  extraHeaders?: Readonly<Record<string, string>>
}

export const PROVIDERS: Record<ProviderId, ProviderDefinition> = {
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    keyPlaceholder: 'sk-…',
    keyPrefixes: ['sk-'],
    defaultModel: 'deepseek-flash',
    models: [
      {
        id: 'deepseek-flash',
        label: 'DeepSeek Flash',
        contextLength: 65536,
        description:
          'Modelo rápido e eficiente da DeepSeek (V4.1-Flash), ideal para código e uso geral.'
      },
      {
        id: 'deepseek-v4-pro',
        label: 'DeepSeek V4 Pro',
        contextLength: 131072,
        description:
          'Modelo DeepSeek Pro de alta capacidade para engenharia de software complexa e raciocínio avançado.'
      }
    ]
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyPlaceholder: 'sk-or-v1-…',
    keyPrefixes: ['sk-or-'],
    defaultModel: 'nvidia/nemotron-3.5-lightning:free',
    models: [
      {
        id: 'nvidia/nemotron-3.5-lightning:free',
        label: 'NVIDIA Nemotron 3.5 Lightning (Grátis)',
        isFree: true,
        contextLength: 1000000,
        description: 'Ultrarrápido, 1M tokens de contexto e suporte completo a ferramentas.'
      },
      {
        id: 'google/gemma-4-26b-a4b-it:free',
        label: 'Google Gemma 4 26B (Grátis)',
        isFree: true,
        contextLength: 262144,
        description: 'Modelo aberto eficiente do Google com 262k de contexto.'
      },
      {
        id: 'liquid/lfm-2.5-2.6b:free',
        label: 'LiquidAI LFM 2.5 2.6B (Grátis)',
        isFree: true,
        contextLength: 65536,
        description: 'Modelo compacto e rápido para tarefas gerais.'
      },
      {
        id: 'nvidia/nemotron-3.5-super-vl:free',
        label: 'NVIDIA Nemotron 3.5 Super VL (Grátis)',
        isFree: true,
        contextLength: 1000000,
        description: 'Modelo multimodal de alta capacidade.'
      },
      {
        id: 'dots-studio/dots-3-note-preview:free',
        label: 'Dots Studio Dots3 Note (Grátis)',
        isFree: true,
        contextLength: 512000,
        description: 'MoE com 512k de contexto para notas e síntese.'
      },
      {
        id: 'deepseek/deepseek-chat',
        label: 'DeepSeek Chat (V3)',
        contextLength: 65536,
        description: 'Modelo líder custo-benefício para raciocínio e código.'
      },
      {
        id: 'deepseek/deepseek-r1',
        label: 'DeepSeek R1',
        contextLength: 65536,
        description: 'Modelo de raciocínio profundo passo-a-passo.'
      },
      {
        id: 'anthropic/claude-3.5-sonnet',
        label: 'Anthropic Claude 3.5 Sonnet',
        contextLength: 200000,
        description: 'O melhor modelo para programação e raciocínio complexo.'
      },
      {
        id: 'openai/gpt-4o',
        label: 'OpenAI GPT-4o',
        contextLength: 128000,
        description: 'Modelo principal versátil e inteligente da OpenAI.'
      },
      {
        id: 'openrouter/auto',
        label: 'Auto (Roteamento automático pago)',
        contextLength: 128000,
        description: 'Roteia dinamicamente para o melhor provedor.'
      }
    ],
    // Recommended by OpenRouter for attribution/ranking.
    extraHeaders: {
      'HTTP-Referer': 'https://alexandria.ai',
      'X-Title': 'Alexandria.AI',
      'X-OpenRouter-Categories': 'productivity,desktop-agent'
    }
  }
}

export const DEFAULT_PROVIDER: ProviderId = 'deepseek'

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && (PROVIDER_IDS as readonly string[]).includes(value)
}

export function providerDefinition(provider: ProviderId): ProviderDefinition {
  return PROVIDERS[provider]
}
