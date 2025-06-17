import type { Node, Edge } from 'reactflow';
import type { CustomNodeData } from '../store/useNodesStore';

// Initial nodes
export const initialNodes: Node<CustomNodeData>[] = [
  {
    id: '1',
    type: 'custom',
    position: { x: 100, y: 100 },
    dragHandle: '.custom-node-drag-handle',
    data: {
      id: '1',
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
      id: '2',
      headline: 'Analyze Results',
      returnValue: 'AnalysisReport',
      content1: 'Performs analysis on the processed data.',
      content2: 'Generates insights and statistics.'
    },
  },
];

// Initial edge
export const initialEdges: Edge[] = [
  { 
    id: 'e1-2', 
    source: '1', 
    target: '2',
    type: 'smoothstep',
  },
];
