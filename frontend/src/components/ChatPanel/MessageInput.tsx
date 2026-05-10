import { useState, type KeyboardEvent } from 'react'
import { SendOutlined, LoadingOutlined } from '@ant-design/icons'

interface Props {
  onSend: (text: string) => void
  loading: boolean
}

export function MessageInput({ onSend, loading }: Props) {
  const [value, setValue] = useState('')

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || loading) return
    onSend(trimmed)
    setValue('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="message-input-wrap">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Опишите вашу цель…"
        disabled={loading}
        rows={1}
        style={{
          flex: 1,
          resize: 'none',
          border: '1px solid #e5e7eb',
          borderRadius: 9,
          padding: '8px 10px',
          fontSize: 13.5,
          fontFamily: 'inherit',
          lineHeight: 1.5,
          outline: 'none',
          transition: 'border-color 0.15s',
          background: '#f9f9fb',
          minHeight: 36,
          maxHeight: 120,
          overflowY: 'auto',
        }}
        onFocus={(e) => { e.target.style.borderColor = '#6366f1' }}
        onBlur={(e) => { e.target.style.borderColor = '#e5e7eb' }}
      />
      <button
        className="send-btn"
        onClick={handleSend}
        disabled={!value.trim() || loading}
      >
        {loading ? <LoadingOutlined /> : <SendOutlined />}
      </button>
    </div>
  )
}
