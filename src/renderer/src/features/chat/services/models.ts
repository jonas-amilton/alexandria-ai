import { PROVIDERS, type ProviderModelOption } from '../../../../../shared/providers'

let cachedOpenRouterModels: ProviderModelOption[] | null = null
let openRouterModelsPromise: Promise<ProviderModelOption[]> | null = null

export function getCachedOpenRouterModels(): ProviderModelOption[] | null {
  return cachedOpenRouterModels
}

export async function prefetchOpenRouterModels(): Promise<ProviderModelOption[]> {
  if (cachedOpenRouterModels) return cachedOpenRouterModels
  if (!openRouterModelsPromise) {
    openRouterModelsPromise = window.deepdesk.providers
      .fetchOpenRouterModels()
      .then((models) => {
        cachedOpenRouterModels = models
        return models
      })
      .catch(() => {
        cachedOpenRouterModels = [...PROVIDERS.openrouter.models]
        return cachedOpenRouterModels
      })
  }
  return openRouterModelsPromise
}
