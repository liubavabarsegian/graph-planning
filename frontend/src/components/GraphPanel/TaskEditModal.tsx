import { useState, useEffect } from 'react'
import { Modal, Form, InputNumber, Select, Tag, Button } from 'antd'
import type { GraphNode } from '../../types'

interface Props {
  node: GraphNode | null
  onClose: () => void
  onSaveDuration: (nodeId: string, durationDays: number) => Promise<void>
  onSaveStatus: (nodeId: string, status: string) => Promise<void>
  saving: boolean
}

const URL_PATTERN = /https?:\/\/[^\s)]+/

function RichText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/)
  return (
    <span className="description-text">
      {parts.map((part, i) =>
        URL_PATTERN.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  )
}

const STATUS_OPTIONS = [
  { value: 'todo',        label: '○ К выполнению' },
  { value: 'in_progress', label: '◑ В процессе' },
  { value: 'done',        label: '● Готово' },
]

export function TaskEditModal({ node, onClose, onSaveDuration, onSaveStatus, saving }: Props) {
  const [durationForm] = Form.useForm()
  const [selectedStatus, setSelectedStatus] = useState<string>('todo')

  useEffect(() => {
    if (node) {
      durationForm.setFieldsValue({ duration_days: node.duration_days })
      setSelectedStatus(node.status || 'todo')
    }
  }, [node, durationForm])

  const handleSaveDuration = async () => {
    const values = await durationForm.validateFields()
    if (node) await onSaveDuration(node.id, values.duration_days)
  }

  const handleSaveStatus = async () => {
    if (node) await onSaveStatus(node.id, selectedStatus)
  }

  if (!node) return null

  return (
    <Modal
      open={!!node}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{node.title}</span>
          {node.is_critical && <Tag color="red" style={{ margin: 0, fontSize: 11 }}>Критический путь</Tag>}
        </div>
      }
      onCancel={onClose}
      footer={null}
      width={520}
    >
      {/* Description */}
      {node.description && (
        <div style={{
          fontSize: 13, color: '#4b5563', lineHeight: 1.65,
          padding: '10px 12px', background: '#f9f9fb',
          borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 16,
        }}>
          <RichText text={node.description} />
        </div>
      )}

      {/* Dates */}
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
        📅 {node.start_date} → {node.end_date} · {node.duration_days} дней
        {node.dependencies.length > 0 && (
          <span style={{ marginLeft: 10 }}>
            Зависит от: {node.dependencies.map((d) => <Tag key={d} style={{ margin: '0 2px', fontSize: 11 }}>{d}</Tag>)}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Status */}
        <div style={{ padding: '12px 14px', background: '#f9f9fb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Статус задачи</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Select
              value={selectedStatus}
              onChange={setSelectedStatus}
              options={STATUS_OPTIONS}
              style={{ flex: 1 }}
              disabled={saving}
            />
            <Button
              type="primary"
              onClick={handleSaveStatus}
              loading={saving}
              disabled={selectedStatus === (node.status || 'todo')}
              style={{ flexShrink: 0 }}
            >
              Сохранить
            </Button>
          </div>
        </div>

        {/* Duration */}
        <div style={{ padding: '12px 14px', background: '#f9f9fb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
            Длительность <span style={{ fontWeight: 400, color: '#9ca3af' }}>(пересчитывает весь граф)</span>
          </div>
          <Form form={durationForm} layout="inline">
            <Form.Item
              name="duration_days"
              style={{ marginBottom: 0, flex: 1 }}
              rules={[
                { required: true, message: 'Укажите длительность' },
                { type: 'number', min: 1, message: 'Минимум 1 день' },
              ]}
            >
              <InputNumber min={1} style={{ width: '100%' }} disabled={saving} addonAfter="дней" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" onClick={handleSaveDuration} loading={saving}>
                Пересчитать
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </Modal>
  )
}
