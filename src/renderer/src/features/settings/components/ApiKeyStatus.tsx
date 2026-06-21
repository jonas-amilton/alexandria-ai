import type { ApiKeyStatus as ApiKeyStatusType } from '../../../../../shared/chat'

interface ApiKeyStatusProps {
  status: ApiKeyStatusType | null
}

function ApiKeyStatus({ status }: ApiKeyStatusProps): React.JSX.Element {
  if (status === null) {
    return <span className="text-xs text-gray-500">Checando API key…</span>
  }

  if (status.set) {
    return <span className="text-xs text-green-400"> API key está configurada</span>
  }

  return (
    <span className="text-xs text-yellow-400">
      Nenhuma API key cadastrada
      {status.canPersist ? '' : ' (encryption unavailable)'}
    </span>
  )
}

export default ApiKeyStatus
