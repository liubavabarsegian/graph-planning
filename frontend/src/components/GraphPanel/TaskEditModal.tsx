import { useState, useEffect } from 'react'
import { Modal, Form, InputNumber, Descriptions, Tag, Typography } from 'antd'
import type { GraphNode } from '../../types'

const { Text } = Typography

interface Props {
  node: GraphNode | null
  onClose: () => void
  onSave: (nodeId: string, durationDays: number) => Promise<void>
  saving: boolean
}

export function TaskEditModal({ node, onClose, onSave, saving }: Props) {
  const [form] = Form.useForm()

  useEffect(() => {
    if (node) {
      form.setFieldsValue({ duration_days: node.duration_days })
    }
  }, [node, form])

  const handleOk = async () => {
    const values = await form.validateFields()
    if (node) {
      await onSave(node.id, values.duration_days)
    }
  }

  if (!node) return null

  return (
    <Modal
      open={!!node}
      title={node.title}
      onCancel={onClose}
      onOk={handleOk}
      okText="Пересчитать"
      cancelText="Закрыть"
      confirmLoading={saving}
    >
      <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Описание">
          <Text type="secondary">{node.description || '—'}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Начало">{node.start_date}</Descriptions.Item>
        <Descriptions.Item label="Конец">{node.end_date}</Descriptions.Item>
        <Descriptions.Item label="Критический путь">
          {node.is_critical ? <Tag color="red">да</Tag> : <Tag color="default">нет</Tag>}
        </Descriptions.Item>
        {node.dependencies.length > 0 && (
          <Descriptions.Item label="Зависит от">
            {node.dependencies.map((d) => (
              <Tag key={d}>{d}</Tag>
            ))}
          </Descriptions.Item>
        )}
      </Descriptions>

      <Form form={form} layout="vertical">
        <Form.Item
          name="duration_days"
          label="Длительность (дней)"
          rules={[
            { required: true, message: 'Укажите длительность' },
            { type: 'number', min: 1, message: 'Минимум 1 день' },
          ]}
        >
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
