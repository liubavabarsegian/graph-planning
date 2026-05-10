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

// status (non-critical): { bg, border, text }
const STATUS_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  todo:        { bg: '#eef2ff', border: '#6366f1', text: '#312e81' },
  in_progress: { bg: '#fffbeb', border: '#f59e0b', text: '#78350f' },
  done:        { bg: '#ecfdf5', border: '#10b981', text: '#064e3b' },
}
const CRITICAL_STYLE = { bg: '#fef2f2', border: '#dc2626', text: '#7f1d1d' }
const DEFAULT_STYLE = STATUS_STYLE.todo

export function CytoscapeGraph({ nodes, edges, onNodeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Build a lookup: node id → duration_days (for edge labels)
    const durationById: Record<string, number> = {}
    for (const n of nodes) durationById[n.id] = n.duration_days

    const elements: cytoscape.ElementDefinition[] = [
      ...nodes.map((n) => {
        const st = n.is_critical ? CRITICAL_STYLE : (STATUS_STYLE[n.status] ?? DEFAULT_STYLE)
        return {
          data: {
            id: n.id,
            label: buildLabel(n),
            isCritical: n.is_critical,
            status: n.status || 'todo',
            bg: st.bg,
            border: st.border,
            textColor: st.text,
            raw: n,
          },
        }
      }),
      ...edges.map((e) => ({
        data: {
          source: e.from,
          target: e.to,
          isCritical: false, // filled below
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
        nodeSep: 28,
        rankSep: 110,
        padding: 36,
        animate: false,
      } as cytoscape.LayoutOptions,
      style: [
        {
          selector: 'node',
          style: {
            shape: 'roundrectangle',
            width: 168,
            height: 58,
            'background-color': 'data(bg)',
            'border-width': 2,
            'border-color': 'data(border)',
            label: 'data(label)',
            color: 'data(textColor)',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '11px',
            'font-family': 'Inter, system-ui, sans-serif',
            'text-wrap': 'wrap',
            'text-max-width': '152px',
            'line-height': 1.45,
          },
        },
        {
          selector: 'node[?isCritical]',
          style: {
            'border-width': 2.5,
          },
        },
        {
          selector: 'node[status = "done"]',
          style: {
            opacity: 0.8,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#facc15',
            'background-color': 'data(bg)',
          },
        },
        {
          selector: 'node:active',
          style: { 'overlay-opacity': 0.06 },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': '#cbd5e1',
            'target-arrow-color': '#94a3b8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1.0,
            label: 'data(label)',
            'font-size': '10px',
            'font-family': 'Inter, system-ui, sans-serif',
            color: '#94a3b8',
            'text-background-color': '#f8f9fc',
            'text-background-opacity': 1,
            'text-background-padding': '2px',
            'text-background-shape': 'roundrectangle',
            'text-border-opacity': 0,
          },
        },
        {
          selector: 'edge.critical',
          style: {
            width: 2,
            'line-color': '#fca5a5',
            'target-arrow-color': '#f87171',
            color: '#dc2626',
            'text-background-color': '#fef2f2',
          },
        },
      ],
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
      minZoom: 0.25,
      maxZoom: 3,
    })

    // Mark critical edges
    cy.edges().forEach((edge) => {
      const src = cy.getElementById(edge.data('source'))
      const tgt = cy.getElementById(edge.data('target'))
      if (src.data('isCritical') && tgt.data('isCritical')) {
        edge.addClass('critical')
      }
    })

    cy.on('tap', 'node', (evt) => {
      onNodeClick(evt.target.data('raw') as GraphNode)
    })

    cyRef.current = cy

    return () => {
      cy.destroy()
      cyRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <Legend />
    </div>
  )
}

function Legend() {
  const items = [
    { color: '#6366f1', bg: '#eef2ff', label: 'К выполнению' },
    { color: '#f59e0b', bg: '#fffbeb', label: 'В процессе' },
    { color: '#10b981', bg: '#ecfdf5', label: 'Готово' },
    { color: '#dc2626', bg: '#fef2f2', label: 'Критический путь' },
  ]
  return (
    <div style={{
      position: 'absolute', bottom: 14, right: 14,
      background: 'rgba(255,255,255,0.95)',
      border: '1px solid #e5e7eb',
      borderRadius: 10, padding: '8px 12px',
      fontSize: 11, display: 'flex', flexDirection: 'column', gap: 5,
      boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
    }}>
      {items.map(({ color, bg, label }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{
            width: 14, height: 10, borderRadius: 3, flexShrink: 0,
            background: bg, border: `2px solid ${color}`,
          }} />
          <span style={{ color: '#4b5563' }}>{label}</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 3, paddingTop: 5, color: '#9ca3af', fontSize: 10 }}>
        Число на стрелке — длительность предшественника
      </div>
    </div>
  )
}

function buildLabel(n: GraphNode): string {
  const title = n.title.length > 26 ? n.title.slice(0, 24) + '…' : n.title
  return `${title}\n${n.start_date} → ${n.end_date}`
}
