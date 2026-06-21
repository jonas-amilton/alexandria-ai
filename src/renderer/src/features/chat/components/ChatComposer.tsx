interface ChatComposerProps {
  value: string
  disabled: boolean
  isLoading: boolean
  onChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
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
  return (
    <div className="border-t border-gray-700 px-4 py-3">
      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 rounded bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 outline-none focus:ring-1 focus:ring-blue-500"
          placeholder={isLoading ? 'Waiting for response…' : 'Type a message…'}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
          }}
          onKeyDown={onKeyDown}
          disabled={disabled}
        />

        {isLoading ? (
          <button
            type="button"
            className="rounded bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
            onClick={() => {
              onCancel()
            }}
          >
            Cancelar
          </button>
        ) : (
          <button
            type="button"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            disabled={!value.trim()}
            onClick={() => {
              onSubmit()
            }}
          >
            Enviar
          </button>
        )}
      </div>
    </div>
  )
}

export default ChatComposer
