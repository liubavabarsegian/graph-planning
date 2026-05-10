import { useEffect, useState } from 'react'
import { Spin } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { listPlans } from '../../api/graph'
import type { PlanListItem } from '../../types'

interface Props {
  activePlanId: string | null
  onSelectPlan: (planId: string) => void
  onNewPlan: () => void
  refreshTrigger: number
}

export function PlansList({ activePlanId, onSelectPlan, onNewPlan, refreshTrigger }: Props) {
  const [plans, setPlans] = useState<PlanListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    listPlans()
      .then(setPlans)
      .catch(() => setPlans([]))
      .finally(() => setLoading(false))
  }, [refreshTrigger])

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
            <button
              key={p.id}
              className={`plan-item${activePlanId === p.id ? ' active' : ''}`}
              onClick={() => onSelectPlan(p.id)}
              title={p.title}
            >
              <span className="plan-item-title">{p.title || 'Без названия'}</span>
              <span className="plan-item-date">{formatDate(p.created_at)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
