'use client';

import ReactFlow, {
  Background,
  Controls,
  Panel,
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
  // Use the codebase store for all flow-related state
  const { nodes, edges, onNodesChange, onEdgesChange } = useCodebaseStore();

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
        nodesDraggable={true}
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
