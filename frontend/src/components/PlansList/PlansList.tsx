import { useEffect, useState } from 'react'
import { Spin, Popconfirm } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { listPlans } from '../../api/graph'
import type { PlanListItem } from '../../types'

interface Props {
  activePlanId: string | null
  onSelectPlan: (planId: string) => void
  onNewPlan: () => void
  onDeletePlan: (planId: string) => Promise<void>
  refreshTrigger: number
}

export function PlansList({ activePlanId, onSelectPlan, onNewPlan, onDeletePlan, refreshTrigger }: Props) {
  const [plans, setPlans] = useState<PlanListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    listPlans()
      .then(setPlans)
      .catch(() => setPlans([]))
      .finally(() => setLoading(false))
  }, [refreshTrigger])

  const handleDelete = async (e: React.MouseEvent, planId: string) => {
    e.stopPropagation()
    setDeletingId(planId)
    try {
      await onDeletePlan(planId)
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-logo">⬡ Goal Planner</span>
      </div>

      <button className="new-plan-btn" onClick={onNewPlan}>
        <PlusOutlined style={{ fontSize: 12 }} />
        Новый план
      </button>

      <div className="sidebar-section-title">История планов</div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
          <Spin size="small" />
        </div>
      ) : plans.length === 0 ? (
        <div className="sidebar-empty">Планов пока нет</div>
      ) : (
        <div className="plan-list">
          {plans.map((p) => (
            <div
              key={p.id}
              className={`plan-item${activePlanId === p.id ? ' active' : ''}`}
              onClick={() => onSelectPlan(p.id)}
              title={p.title}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="plan-item-title">{p.title || 'Без названия'}</span>
                <span className="plan-item-date">{formatDate(p.created_at)}</span>
              </div>
              <Popconfirm
                title="Удалить план?"
                description="Это действие нельзя отменить."
                onConfirm={(e) => handleDelete(e as React.MouseEvent, p.id)}
                onCancel={(e) => e?.stopPropagation()}
                okText="Удалить"
                cancelText="Отмена"
                okButtonProps={{ danger: true }}
                placement="right"
              >
                <button
                  className="plan-delete-btn"
                  onClick={(e) => e.stopPropagation()}
                  disabled={deletingId === p.id}
                  title="Удалить план"
                >
                  <DeleteOutlined style={{ fontSize: 11 }} />
                </button>
              </Popconfirm>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
