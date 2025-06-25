'use client';

import React, { useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';

import CustomNode from './CustomNode';
import { useCodebaseStore } from '../../store/useCodebaseStore';

// Define nodeTypes and edgeTypes outside the component for stability
const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

const edgeTypes: EdgeTypes = {};

export default function FlowDiagram() {
  const codeMethods = useCodebaseStore((s) => s.codeMethods);


  // map codeMethods -> initial nodes
  const initialNodes = useMemo(() =>
    codeMethods.map((m, i) => ({
      id: `method-${i}`,
      type: 'custom',
      position: { x: 250 * i, y: 100 },
      data: {
        methodIndex: i,
        
      },
    })), [codeMethods]);

    const [nodes, , onNodesChange] = useNodesState(initialNodes);
    // create a simple demo edge between first two nodes if they exist
  const initialEdges = useMemo<Edge[]>(() => {
    return codeMethods.length > 1
      ? [
          {
            id: 'edge-0-1',
            source: 'method-0',
            target: 'method-1',
            type: 'smoothstep',
            animated: false,
          } as Edge,
        ]
      : [];
  }, [codeMethods.length]);

  const [edges, , onEdgesChange] = useEdgesState<Edge[]>(initialEdges);


  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        nodesDraggable
        nodeDragThreshold={1}
        defaultEdgeOptions={{
          animated: false,
          type: 'smoothstep',
        }}
      >
        <Background />
        <Controls />
        <Panel position="top-right" className="react-flow__panel">
          <div style={{ fontSize: '12px' }}>Drag nodes by their header</div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
