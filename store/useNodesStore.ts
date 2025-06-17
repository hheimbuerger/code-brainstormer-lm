import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
} from 'reactflow';

import { initialNodes, initialEdges } from '../data/initial-flow-data';

// Define the data type for our custom node
export type CustomNodeData = {
  id: string;
  headline: string;
  returnValue?: string;
  content1?: string;
  content2?: string;
};

// The state model for our store
interface FlowState {
  nodes: Node<CustomNodeData>[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  updateNodeField: (nodeId: string, field: keyof Omit<CustomNodeData, 'id'>, value: string) => void;
}

export const useNodesStore = create<FlowState>()(
  devtools(
    (set, get) => ({
      nodes: initialNodes, // Initialize with default nodes
      edges: initialEdges, // Initialize with default edges

      onNodesChange: (changes: NodeChange[]) => {
        set({
          nodes: applyNodeChanges(changes, get().nodes),
        });
      },

      onEdgesChange: (changes: EdgeChange[]) => {
        set({
          edges: applyEdgeChanges(changes, get().edges),
        });
      },

      updateNodeField: (nodeId, field, value) => {
        set({
          nodes: get().nodes.map((node) => {
            if (node.id === nodeId) {
              // it's important to create a new object here, to trigger a re-render
              return { ...node, data: { ...node.data, [field]: value } };
            }
            return node;
          }),
        });
      },
    }),
    { name: 'FlowStore' } // Updated name for Redux DevTools
  )
);
