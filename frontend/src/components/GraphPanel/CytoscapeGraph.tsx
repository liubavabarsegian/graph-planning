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

export function CytoscapeGraph({ nodes, edges, onNodeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const elements: cytoscape.ElementDefinition[] = [
      ...nodes.map((n) => ({
        data: {
          id: n.id,
          label: buildLabel(n),
          isCritical: n.is_critical,
          raw: n,
        },
      })),
      ...edges.map((e) => ({
        data: { source: e.from, target: e.to },
      })),
    ]

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      layout: {
        name: 'dagre',
        rankDir: 'LR',
        nodeSep: 40,
        rankSep: 80,
        padding: 20,
      } as cytoscape.LayoutOptions,
      style: [
        {
          selector: 'node',
          style: {
            shape: 'roundrectangle',
            width: 160,
            height: 60,
            'background-color': '#1677ff',
            'border-width': 0,
            label: 'data(label)',
            color: '#fff',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '11px',
            'text-wrap': 'wrap',
            'text-max-width': '140px',
          },
        },
        {
          selector: 'node[?isCritical]',
          style: {
            'background-color': '#cf1322',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#faad14',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#bfbfbf',
            'target-arrow-color': '#bfbfbf',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
          },
        },
        {
          selector: 'edge.critical',
          style: {
            'line-color': '#cf1322',
            'target-arrow-color': '#cf1322',
          },
        },
      ],
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    })

    // Подсвечиваем критические рёбра
    cy.edges().forEach((edge) => {
      const srcNode = cy.getElementById(edge.data('source'))
      const tgtNode = cy.getElementById(edge.data('target'))
      if (srcNode.data('isCritical') && tgtNode.data('isCritical')) {
        edge.addClass('critical')
      }
    })

    cy.on('tap', 'node', (evt) => {
      const raw = evt.target.data('raw') as GraphNode
      onNodeClick(raw)
    })

    cyRef.current = cy

    return () => {
      cy.destroy()
      cyRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}

function buildLabel(n: GraphNode): string {
  return `${n.title}\n${n.duration_days}д · ${n.start_date} → ${n.end_date}`
}
