import { useState, useEffect, useRef } from 'react'
import { Modal, Form, InputNumber, Select, Tag, Button, Checkbox, Popconfirm, Input, Progress, DatePicker, type InputRef } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { GraphNode, Subtask } from '../../types'

interface Props {
  node: GraphNode | null
  allNodes: GraphNode[]
  onClose: () => void
  onSaveDuration: (nodeId: string, durationDays: number) => Promise<void>
  onSaveStatus: (nodeId: string, status: string) => Promise<void>
  onSaveDescription: (nodeId: string, description: string) => Promise<void>
  onSaveDates: (nodeId: string, startDate: string | null, endDate: string | null) => Promise<void>
  onToggleSubtask: (nodeId: string, subtaskId: string, done: boolean) => Promise<void>
  onAddSubtask: (nodeId: string, title: string) => Promise<void>
  onDeleteTask: (nodeId: string) => Promise<void>
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

export function TaskEditModal({
  node, allNodes, onClose, onSaveDuration, onSaveStatus, onSaveDescription, onSaveDates,
  onToggleSubtask, onAddSubtask, onDeleteTask, saving
}: Props) {
  const [durationForm] = Form.useForm()
  const [selectedStatus, setSelectedStatus] = useState<string>('todo')
  const [editingDesc, setEditingDesc] = useState(false)
  const [descValue, setDescValue] = useState('')
  const [newSubtask, setNewSubtask] = useState('')
  const [addingSubtask, setAddingSubtask] = useState(false)
  const subtaskInputRef = useRef<InputRef>(null)
  const [startDate, setStartDate] = useState<dayjs.Dayjs | null>(null)
  const [endDate, setEndDate] = useState<dayjs.Dayjs | null>(null)

  useEffect(() => {
    if (node) {
      durationForm.setFieldsValue({ duration_days: node.duration_days })
      setSelectedStatus(node.status || 'todo')
      setDescValue(node.description)
      setEditingDesc(false)
      setNewSubtask('')
      setStartDate(node.forced_start ? dayjs(node.forced_start) : null)
      setEndDate(dayjs(node.end_date))
    }
  }, [node, durationForm])

  const handleSaveDuration = async () => {
    const values = await durationForm.validateFields()
    if (node) await onSaveDuration(node.id, values.duration_days)
  }

  const handleSaveStatus = async () => {
    if (node) await onSaveStatus(node.id, selectedStatus)
  }

  const handleSaveDesc = async () => {
    if (node) {
      await onSaveDescription(node.id, descValue)
      setEditingDesc(false)
    }
  }

  const handleAddSubtask = async () => {
    if (!node || !newSubtask.trim()) return
    setAddingSubtask(true)
    try {
      await onAddSubtask(node.id, newSubtask.trim())
      setNewSubtask('')
      subtaskInputRef.current?.focus()
    } finally {
      setAddingSubtask(false)
    }
  }

  const handleSubtaskKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddSubtask()
    }
  }

  if (!node) return null

  const subtasks = node.subtasks ?? []
  const doneCount = subtasks.filter((s) => s.done).length
  const subtaskProgress = subtasks.length > 0 ? Math.round((doneCount / subtasks.length) * 100) : 0

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
      width={560}
    >
      {/* Description */}
      <div style={{ marginBottom: 16 }}>
        {editingDesc ? (
          <div>
            <Input.TextArea
              value={descValue}
              onChange={(e) => setDescValue(e.target.value)}
              rows={5}
              style={{ marginBottom: 8, fontSize: 13 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="primary" size="small" onClick={handleSaveDesc} loading={saving}>Сохранить</Button>
              <Button size="small" onClick={() => { setEditingDesc(false); setDescValue(node.description) }}>Отмена</Button>
            </div>
          </div>
        ) : (
          <div
            style={{
              fontSize: 13, color: '#4b5563', lineHeight: 1.65,
              padding: '10px 12px', background: '#f9f9fb',
              borderRadius: 8, border: '1px solid #e5e7eb',
              cursor: 'text', position: 'relative',
            }}
            onClick={() => setEditingDesc(true)}
            title="Нажмите для редактирования"
          >
            <RichText text={node.description || '(нет описания)'} />
            <span style={{ position: 'absolute', top: 6, right: 8, fontSize: 10, color: '#9ca3af' }}>✎</span>
          </div>
        )}
      </div>

      {/* Dates and dependencies */}
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
        📅 {node.start_date} → {node.end_date} · {node.duration_days} дней
        {node.dependencies.length > 0 && (
          <div style={{ marginTop: 4 }}>
            Зависит от: {node.dependencies.map((d) => {
              const dep = allNodes.find((n) => n.id === d)
              return <Tag key={d} style={{ margin: '0 2px', fontSize: 11 }}>{dep?.title ?? d}</Tag>
            })}
          </div>
        )}
      </div>

      {/* Subtasks checklist */}
      <div style={{ padding: '12px 14px', background: '#f9f9fb', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
            Подзадачи {subtasks.length > 0 ? `${doneCount}/${subtasks.length}` : ''}
          </div>
          {subtasks.length > 0 && (
            <Progress
              percent={subtaskProgress}
              size="small"
              style={{ width: 80, margin: 0 }}
              showInfo={false}
              strokeColor={subtaskProgress === 100 ? '#16a34a' : '#6366f1'}
            />
          )}
        </div>

        {/* Existing subtasks */}
        {subtasks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {subtasks.map((s: Subtask) => (
              <div
                key={s.id}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}
                onClick={() => !saving && !addingSubtask && onToggleSubtask(node.id, s.id, !s.done)}
              >
                <Checkbox
                  checked={s.done}
                  disabled={saving || addingSubtask}
                  style={{ marginTop: 2 }}
                />
                <span style={{
                  fontSize: 13, color: s.done ? '#9ca3af' : '#374151',
                  textDecoration: s.done ? 'line-through' : 'none',
                  lineHeight: 1.4,
                }}>
                  {s.title}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Add new subtask */}
        <div style={{ display: 'flex', gap: 6 }}>
          <Input
            ref={subtaskInputRef}
            value={newSubtask}
            onChange={(e) => setNewSubtask(e.target.value)}
            onKeyDown={handleSubtaskKeyDown}
            placeholder="Новая подзадача (Enter для добавления)"
            size="small"
            disabled={saving || addingSubtask}
            style={{ fontSize: 12 }}
          />
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={handleAddSubtask}
            loading={addingSubtask}
            disabled={!newSubtask.trim() || saving}
          >
            Добавить
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Date shift */}
        <div style={{ padding: '12px 14px', background: '#f9f9fb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
            Сдвинуть даты <span style={{ fontWeight: 400, color: '#9ca3af' }}>(пересчитывает граф)</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 140 }}>
              <span style={{ fontSize: 11, color: '#6b7280' }}>Начало (не раньше)</span>
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                format="YYYY-MM-DD"
                size="small"
                placeholder="Без ограничений"
                allowClear
                style={{ width: '100%' }}
                disabled={saving}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 140 }}>
              <span style={{ fontSize: 11, color: '#6b7280' }}>Окончание</span>
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                format="YYYY-MM-DD"
                size="small"
                placeholder={node?.end_date}
                style={{ width: '100%' }}
                disabled={saving}
              />
            </div>
            <Button
              type="primary"
              size="small"
              style={{ alignSelf: 'flex-end' }}
              loading={saving}
              onClick={() => node && onSaveDates(
                node.id,
                startDate ? startDate.format('YYYY-MM-DD') : '',
                endDate ? endDate.format('YYYY-MM-DD') : null
              )}
            >
              Применить
            </Button>
          </div>
        </div>

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

        {/* Delete task */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Popconfirm
            title="Удалить задачу?"
            description="Зависимости других задач будут автоматически исправлены."
            onConfirm={() => onDeleteTask(node.id)}
            okText="Удалить"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<DeleteOutlined />} size="small" disabled={saving}>
              Удалить задачу
            </Button>
          </Popconfirm>
        </div>
      </div>
    </Modal>
  )
}
