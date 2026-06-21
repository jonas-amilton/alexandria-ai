import type { ReactNode } from 'react'

interface StreamingIndicatorProps {
  content: string
}

function StreamingIndicator({ content }: StreamingIndicatorProps): ReactNode {
  return (
    <span>
      {content}
      <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-[#7C5CFA] align-middle" />
    </span>
  )
}

export default StreamingIndicator
