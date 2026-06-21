interface ChatHeaderProps {
  children?: React.ReactNode
}

function ChatHeader({ children }: ChatHeaderProps): React.JSX.Element {
  return (
    <header className="border-b border-gray-700 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Alexandria.AI</span>
        <hr />
        <span className="flex-1" />
        {children}
      </div>
    </header>
  )
}

export default ChatHeader
