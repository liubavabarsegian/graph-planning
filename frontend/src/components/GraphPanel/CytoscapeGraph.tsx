import { useEffect, useRef } from 'react'
import cytoscape from 'cytoscape'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import dagre from 'cytoscape-dagre'
import type { GraphNode, GraphEdge } from '../../types'

cytoscape.use(dagre)

interface Props {
  nodes: GraphNode[]
  edges: GraphEdge[]
  onNodeClick: (node: GraphNode) => void
}

// Классы узла по статусу × критичность (для CSS-стилей Cytoscape).
function nodeClass(n: GraphNode): string {
  const parts: string[] = [`st-${n.status || 'todo'}`]
  if (n.is_critical && n.status !== 'done') parts.push('critical')
  return parts.join(' ')
}

// Цвет текста по статусу × критичность.
function textColor(n: GraphNode): string {
  if (n.status === 'done') return '#166534'
  if (n.status === 'in_progress') return n.is_critical ? '#7c2d12' : '#78350f'
  return n.is_critical ? '#7f1d1d' : '#1e293b'
}

export function CytoscapeGraph({ nodes, edges, onNodeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const durationById: Record<string, number> = {}
    for (const n of nodes) durationById[n.id] = n.duration_days

    const elements: cytoscape.ElementDefinition[] = [
      ...nodes.map((n) => {
        const subtasks = n.subtasks ?? []
        const doneCount = subtasks.filter(s => s.done).length
        const progress = subtasks.length > 0 ? `${doneCount}/${subtasks.length}` : ''
        return {
          data: {
            id: n.id,
            label: buildLabel(n, progress),
            textColor: textColor(n),
            raw: n,
          },
          classes: nodeClass(n),
        }
      }),
      ...edges.map((e) => ({
        data: {
          source: e.from,
          target: e.to,
          label: durationById[e.from] != null ? `${durationById[e.from]}д` : '',
        },
      })),
    ]

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      layout: {
        name: 'dagre',
        rankDir: 'LR',
        nodeSep: 24,
        rankSep: 100,
        padding: 48,
        animate: false,
      } as cytoscape.LayoutOptions,
      style: [
        // ── базовый стиль узла ───────────────────────────────────────────
        {
          selector: 'node',
          style: {
            shape: 'roundrectangle',
            width: 180,
            height: 64,
            'background-color': '#ffffff',
            'border-width': 1,
            'border-color': '#e2e8f0',
            label: 'data(label)',
            color: 'data(textColor)',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '11px',
            'font-family': '"Inter", "SF Pro Display", system-ui, sans-serif',
            'font-weight': 500,
            'text-wrap': 'wrap',
            'text-max-width': '155px',
            'line-height': 1.5,
          },
        },
        // ── К выполнению (не крит.) ──────────────────────────────────────
        {
          selector: 'node.st-todo',
          style: {
            'background-color': '#f8fafc',
            'border-color': '#cbd5e1',
          },
        },
        // ── К выполнению КРИТИЧЕСКОЕ ─────────────────────────────────────
        {
          selector: 'node.st-todo.critical',
          style: {
            'background-color': '#fef2f2',
            'border-color': '#fca5a5',
            'border-width': 2,
          },
        },
        // ── В процессе ───────────────────────────────────────────────────
        {
          selector: 'node.st-in_progress',
          style: {
            'background-color': '#fffbeb',
            'border-color': '#fde68a',
            'border-width': 2,
          },
        },
        // ── В процессе КРИТИЧЕСКОЕ ───────────────────────────────────────
        {
          selector: 'node.st-in_progress.critical',
          style: {
            'background-color': '#fff7ed',
            'border-color': '#fdba74',
            'border-width': 2,
          },
        },
        // ── Готово ───────────────────────────────────────────────────────
        {
          selector: 'node.st-done',
          style: {
            'background-color': '#f0fdf4',
            'border-color': '#bbf7d0',
            opacity: 0.78,
          },
        },
        // ── Выбранный ────────────────────────────────────────────────────
        {
          selector: 'node:selected',
          style: {
            'border-width': 2.5,
            'border-color': '#6366f1',
          },
        },
        {
          selector: 'node:active',
          style: { 'overlay-opacity': 0.04 },
        },
        // ── Рёбра ────────────────────────────────────────────────────────
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': '#cbd5e1',
            'target-arrow-color': '#94a3b8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.9,
            label: 'data(label)',
            'font-size': '10px',
            'font-family': '"Inter", system-ui, sans-serif',
            color: '#94a3b8',
            'text-background-color': '#f8fafc',
            'text-background-opacity': 1,
            'text-background-padding': '2px',
            'text-background-shape': 'roundrectangle',
          },
        },
        {
          selector: 'edge.critical',
          style: {
            width: 2,
            'line-color': '#fca5a5',
            'target-arrow-color': '#ef4444',
            color: '#ef4444',
            'text-background-color': '#fef2f2',
          },
        },
        {
          selector: 'edge.done-edge',
          style: {
            width: 1.5,
            'line-color': '#86efac',
            'target-arrow-color': '#16a34a',
            color: '#16a34a',
            'text-background-color': '#f0fdf4',
          },
        },
      ],
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
      minZoom: 0.2,
      maxZoom: 3,
    })

    // Раскрашиваем рёбра
    cy.edges().forEach((edge) => {
      const src = cy.getElementById(edge.data('source'))
      const tgt = cy.getElementById(edge.data('target'))
      const srcDone  = src.hasClass('st-done')
      const tgtDone  = tgt.hasClass('st-done')
      const srcCrit  = src.hasClass('critical')
      const tgtCrit  = tgt.hasClass('critical')

      if (srcDone && tgtDone) {
        edge.addClass('done-edge')
      } else if (srcCrit && tgtCrit) {
        edge.addClass('critical')
      }
    })

    cy.on('tap', 'node', (evt) => {
      onNodeClick(evt.target.data('raw') as GraphNode)
    })

    cyRef.current = cy
    return () => { cy.destroy(); cyRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <Legend nodes={nodes} />
    </div>
  )
}

function Legend({ nodes }: { nodes: GraphNode[] }) {
  const total      = nodes.length
  const done       = nodes.filter(n => n.status === 'done').length
  const inProgress = nodes.filter(n => n.status === 'in_progress').length
  const critical   = nodes.filter(n => n.is_critical && n.status !== 'done').length

  return (
    <div style={{
      position: 'absolute', bottom: 16, right: 16,
      background: 'rgba(255,255,255,0.97)',
      border: '1px solid #e2e8f0', borderRadius: 12,
      padding: '12px 14px', fontSize: 11,
      display: 'flex', flexDirection: 'column', gap: 7,
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)', minWidth: 175,
    }}>
      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 11, letterSpacing: '0.03em' }}>
        ЛЕГЕНДА
      </div>
      <LegendItem bg="#f8fafc" border="#cbd5e1" label="К выполнению" />
      <LegendItem bg="#fffbeb" border="#fde68a" label="В процессе" bold />
      <LegendItem bg="#f0fdf4" border="#bbf7d0" label="Готово" />
      <LegendItem bg="#fef2f2" border="#fca5a5" label="Критический путь" thick />
      <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 2, paddingTop: 7, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <StatRow label="Выполнено"   value={`${done} / ${total}`} color="#16a34a" />
        {inProgress > 0 && <StatRow label="В работе"    value={String(inProgress)} color="#d97706" />}
        {critical   > 0 && <StatRow label="На крит. пути" value={String(critical)} color="#ef4444" />}
        <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 1 }}>
          Цифра на стрелке — длит. предка (дней)
        </div>
      </div>
    </div>
  )
}

function LegendItem({ bg, border, label, bold, thick }: {
  bg: string; border: string; label: string; bold?: boolean; thick?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 22, height: 14, borderRadius: 4, flexShrink: 0,
        background: bg, border: `${thick ? 2 : 1}px solid ${border}`,
        boxSizing: 'border-box',
      }} />
      <span style={{ color: '#374151', fontWeight: bold ? 600 : 400 }}>{label}</span>
    </div>
  )
}

function StatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ color, fontWeight: 600 }}>{value}</span>
    </div>
  )
}

function buildLabel(n: GraphNode, progress: string): string {
  const maxLen = 24
  const title = n.title.length > maxLen ? n.title.slice(0, maxLen - 1) + '…' : n.title
  const icon = n.status === 'done' ? '✓ ' : n.status === 'in_progress' ? '◑ ' : ''
  const prog = progress ? ` [${progress}]` : ''
  return `${icon}${title}${prog}\n${n.start_date} → ${n.end_date}`
}
