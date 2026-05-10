import { useEffect, useRef } from 'react'
import type { HistoryMessage } from '../../types'

interface Props {
  messages: HistoryMessage[]
}

export function MessageList({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="messages-empty">
        <span className="messages-empty-icon">✦</span>
        <span className="messages-empty-text">Опишите свою цель,<br />и я помогу составить план</span>
      </div>
    )
  }

  return (
    <div className="messages-container">
      {messages.map((msg, i) => (
        <div key={i} className={`message-row ${msg.role}`}>
          <div className={`message-bubble ${msg.role}`}>
            {msg.content}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
