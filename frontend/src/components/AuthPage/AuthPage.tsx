import { useState } from 'react'
import { Form, Input, Button, Typography, Alert, Card, Tabs } from 'antd'
import { login, register, setToken } from '../../api/auth'

const { Title, Text } = Typography

interface Props {
  onAuth: () => void
}

type Mode = 'login' | 'register'

export function AuthPage({ onAuth }: Props) {
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form] = Form.useForm()

  const handleSubmit = async (values: { email: string; password: string }) => {
    setLoading(true)
    setError(null)
    try {
      const token = mode === 'login'
        ? await login(values.email, values.password)
        : await register(values.email, values.password)
      setToken(token)
      onAuth()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = (key: string) => {
    setMode(key as Mode)
    setError(null)
    form.resetFields()
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#f0f2f5',
    }}>
      <Card style={{ width: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0 }}>Goal Planner</Title>
          <Text type="secondary">Интерактивное планирование на основе графа</Text>
        </div>

        <Tabs
          activeKey={mode}
          onChange={handleTabChange}
          centered
          items={[
            { key: 'login', label: 'Вход' },
            { key: 'register', label: 'Регистрация' },
          ]}
        />

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            closable
            onClose={() => setError(null)}
            style={{ marginBottom: 16 }}
          />
        )}

        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Введите email' },
              { type: 'email', message: 'Некорректный email' },
            ]}
          >
            <Input placeholder="you@example.com" autoComplete="email" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Пароль"
            rules={[
              { required: true, message: 'Введите пароль' },
              ...(mode === 'register'
                ? [{ min: 6, message: 'Минимум 6 символов' }]
                : []),
            ]}
          >
            <Input.Password
              placeholder={mode === 'register' ? 'Минимум 6 символов' : 'Ваш пароль'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
            >
              {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
