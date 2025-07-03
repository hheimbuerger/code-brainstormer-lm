'use client';

import React, { useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Panel,
  useNodesState,
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

    /**
   * Compute edges dynamically by scanning each method implementation for inline
   * function-call strings (e.g. `formatText(...)`).
   *
   * For every call we:
   *   1. Extract the function name (before `(`).
   *   2. Keep a per-function counter (`fnCounts`) so each repeated call in the
   *      same implementation gets a stable handle index (formatText-0, -1, …).
   *   3. Find the target node whose identifier starts with that function name.
   *      If none exists we skip – dangling calls have no edge.
   *   4. Push a React-Flow edge with a `className` that encodes the handle ID
   *      (edge-from-{fnName}-{idx}). This is later used for hover highlighting.
   */
  // Compute edges dynamically from function calls in implementations
    const edges = useMemo<Edge[]>(() => {
      const result: Edge[] = [];

      const fnRegex = /[A-Za-z_]+(?=\()/g; // capture function name before '('

      codeMethods.forEach((method, srcIdx) => {
        const impl = method.implementation?.descriptor ?? '';
        let match: RegExpExecArray | null;
        const fnCounts: Record<string, number> = {};
        while ((match = fnRegex.exec(impl)) !== null) {
          const fnName = match[0];
          const localIndex = fnCounts[fnName] ?? 0;
          fnCounts[fnName] = localIndex + 1;
          // find target node index by identifier match
          const tgtIdx = codeMethods.findIndex((m) =>
            m.identifier?.descriptor?.startsWith(fnName)
          );
          if (tgtIdx === -1) {
            continue; // no matching target method
          }
          result.push({
            id: `edge-${srcIdx}-${tgtIdx}-${localIndex}`,
            source: `method-${srcIdx}`,
            sourceHandle: `${fnName}-${localIndex}`,
            target: `method-${tgtIdx}`,
            type: 'smoothstep',
            className: `edge-from-${fnName}-${localIndex}`,
          } as Edge);
        }
      });
      return result;
    }, [codeMethods]);


  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
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
