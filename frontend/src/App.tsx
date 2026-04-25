import { Typography } from 'antd'
import { ChatPanel } from './components/ChatPanel/ChatPanel'

const { Title, Text } = Typography

export function App() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#fafafa' }}>
      {/* Левая колонка: чат */}
      <div
        style={{
          width: '40%',
          minWidth: 360,
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
          boxShadow: '2px 0 8px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
          <Title level={4} style={{ margin: 0 }}>
            Goal Planner
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Опишите цель — получите план
          </Text>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <ChatPanel />
        </div>
      </div>

      {/* Правая колонка: заглушка для графа */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 8,
          color: '#bbb',
        }}
      >
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="32" r="8" stroke="#d9d9d9" strokeWidth="2" />
          <circle cx="32" cy="12" r="8" stroke="#d9d9d9" strokeWidth="2" />
          <circle cx="32" cy="52" r="8" stroke="#d9d9d9" strokeWidth="2" />
          <circle cx="52" cy="32" r="8" stroke="#d9d9d9" strokeWidth="2" />
          <line x1="20" y1="32" x2="24" y2="32" stroke="#d9d9d9" strokeWidth="2" />
          <line x1="32" y1="20" x2="32" y2="24" stroke="#d9d9d9" strokeWidth="2" />
          <line x1="32" y1="40" x2="32" y2="44" stroke="#d9d9d9" strokeWidth="2" />
          <line x1="40" y1="32" x2="44" y2="32" stroke="#d9d9d9" strokeWidth="2" />
        </svg>
        <Text type="secondary">Граф зависимостей появится здесь</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          (реализуется на следующем этапе)
        </Text>
      </div>
    </div>
  )
}
