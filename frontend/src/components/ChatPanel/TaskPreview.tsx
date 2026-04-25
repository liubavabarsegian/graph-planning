import { Tag, Typography, Card } from 'antd'
import type { Task } from '../../types'

const { Text } = Typography

interface Props {
  tasks: Task[]
}

export function TaskPreview({ tasks }: Props) {
  return (
    <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0', maxHeight: 240, overflowY: 'auto' }}>
      <Text strong style={{ display: 'block', marginBottom: 8 }}>
        Задачи ({tasks.length})
      </Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tasks.map((task) => (
          <Card key={task.id} size="small" bodyStyle={{ padding: '6px 10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div>
                <Text strong>{task.title}</Text>
                {task.description && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>{task.description}</Text>
                  </div>
                )}
                {task.dependencies.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    {task.dependencies.map((dep) => (
                      <Tag key={dep} color="blue" style={{ fontSize: 11 }}>
                        зависит от {dep}
                      </Tag>
                    ))}
                  </div>
                )}
              </div>
              <Tag color="green" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                {task.duration_days} д.
              </Tag>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
