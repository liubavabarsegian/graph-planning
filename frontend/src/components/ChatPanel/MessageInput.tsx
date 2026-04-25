import { Button, Input } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import { useState, type KeyboardEvent } from 'react'

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
    <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid #f0f0f0' }}>
      <Input.TextArea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Опишите вашу цель... (Enter — отправить, Shift+Enter — новая строка)"
        autoSize={{ minRows: 1, maxRows: 4 }}
        disabled={loading}
        style={{ flex: 1, resize: 'none' }}
      />
      <Button
        type="primary"
        icon={<SendOutlined />}
        onClick={handleSend}
        loading={loading}
        disabled={!value.trim()}
      />
    </div>
  )
}
