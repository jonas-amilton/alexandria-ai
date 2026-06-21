interface ResetApiKeyButtonProps {
  onClear: () => void
}

function ResetApiKeyButton({ onClear }: ResetApiKeyButtonProps): React.JSX.Element {
  return (
    <div className="border-b border-gray-700 px-4 py-2">
      <button
        type="button"
        className="text-xs text-gray-400 hover:text-gray-200"
        onClick={() => {
          void onClear()
        }}
      >
        Resetar API key
      </button>
    </div>
  )
}

export default ResetApiKeyButton
