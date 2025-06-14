import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import CustomNode from './CustomNode';

type CustomNodeData = {
  headline: string;
  returnValue?: string;
  content1?: string;
  content2?: string;
};

// Initial nodes
const initialNodes: Node<CustomNodeData>[] = [
  {
    id: '1',
    type: 'custom',
    position: { x: 100, y: 100 },
    dragHandle: '.custom-node-drag-handle',
    data: {
      headline: 'Process Data',
      returnValue: 'ProcessedData',
      content1: 'This node processes the input data and applies transformations.',
      content2: 'Handles data validation and normalization.'
    },
  },
  {
    id: '2',
    type: 'custom',
    position: { x: 400, y: 100 },
    dragHandle: '.custom-node-drag-handle',
    data: {
      headline: 'Analyze Results',
      returnValue: 'AnalysisReport',
      content1: 'Performs analysis on the processed data.',
      content2: 'Generates insights and statistics.'
    },
  },
];

// Initial edge
const initialEdges: Edge[] = [
  { 
    id: 'e1-2', 
    source: '1', 
    target: '2',
    type: 'smoothstep',
  },
];

export default function FlowDiagram() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onNodeDataChange = useCallback((nodeId: string, field: string, value: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              [field]: value,
            },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  const nodeTypes = useMemo<NodeTypes>(() => ({
    custom: (props) => (
      <CustomNode 
        {...props} 
        onNodeDataChange={onNodeDataChange}
      />
    ),
  }), [onNodeDataChange]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
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
