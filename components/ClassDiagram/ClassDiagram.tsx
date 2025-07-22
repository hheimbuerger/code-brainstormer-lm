'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Panel,
  useNodesState,
  type Edge,
  type Node,
  type NodeTypes,
  type EdgeTypes,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

import MethodNode from './MethodNode';
import { useCodebaseStore } from '../../store/useCodebaseStore';

// Define nodeTypes and edgeTypes outside the component for stability
const nodeTypes: NodeTypes = {
  method: MethodNode,
};

const edgeTypes: EdgeTypes = {};

/**
 * Re-build edges using current node positions.
 *
 * Steps per inline function call:
 * 1. Extract function name (regex before the first "(").
 * 2. Maintain a per-function counter so multiple calls in the same method
 *    get unique handle IDs: `${fnName}-${methodIdx}-${localIdx}`.
 * 3. Find the target node whose identifier starts with that function name;
 *    skip if it doesn’t exist (dangling call).
 * 4. Compute horizontal vs vertical distance between source & target to
 *    choose the *nearest side* of the target node (Left/Right/Top/Bottom).
 * 5. Create a Bézier edge object with:
 *       • sourceHandle  – matches the inline call handle
 *       • targetHandle  – one of 'l','r','t','b' invisible handles on node
 *       • targetPosition / sourcePosition to guide path tangents
 *       • className     – used for hover highlighting
 *
 * buildEdges is called once on initial render and again in `onNodeDragStop`,
 * so recalculation happens only after a node is released, keeping drag
 * performance smooth.
 */
function buildEdges(nodes: Node[], codeMethods: any[]): Edge[] {
  const result: Edge[] = [];
  const fnRegex = /[A-Za-z_]+(?=\()/g;

  nodes.forEach((srcNode) => {
    const srcIdx = parseInt(srcNode.id.replace('method-', ''), 10);
    const method = codeMethods[srcIdx];
    if (!method) return;
    const impl = method.implementation?.descriptor ?? '';
    let match: RegExpExecArray | null;
    const fnCounts: Record<string, number> = {};
    while ((match = fnRegex.exec(impl)) !== null) {
      const fnName = match[0];
      const localIndex = fnCounts[fnName] ?? 0;
      fnCounts[fnName] = localIndex + 1;
      const tgtIdx = codeMethods.findIndex((m: any) => m.identifier?.descriptor?.startsWith(fnName));
      if (tgtIdx === -1) continue;
      const tgtNode = nodes.find((n) => n.id === `method-${tgtIdx}`);
      if (!tgtNode) continue;
      const dx = tgtNode.position.x - srcNode.position.x;
      const dy = tgtNode.position.y - srcNode.position.y;
      const targetPosition: Position = Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? Position.Left : Position.Right)
        : (dy > 0 ? Position.Top : Position.Bottom);
      result.push({
        id: `edge-${srcIdx}-${tgtIdx}-${localIndex}`,
        source: srcNode.id,
        sourceHandle: `${fnName}-${srcIdx}-${localIndex}`,
        target: tgtNode.id,
        targetHandle: targetPosition === Position.Top ? 't' : targetPosition === Position.Right ? 'r' : targetPosition === Position.Bottom ? 'b' : 'l',
        className: `edge-from-${fnName}-${srcIdx}-${localIndex}`,
        targetPosition,
        sourcePosition: Position.Right,
      } as Edge);
    }
  });
  return result;
}

export default function ClassDiagram() {
  const codeMethods = useCodebaseStore((s) => s.codeMethods);
  const initialPositions = [{x: 250, y: 100}, {x: 500, y: 50}, {x: 500, y: 300}];

  // map codeMethods -> initial nodes
  const initialNodes = useMemo(() =>
    codeMethods.map((m, i) => ({
      id: `method-${i}`,
      type: 'method',
      position: i < initialPositions.length ? initialPositions[i] : {x: 250 * i, y: 100},
      data: {
        methodIndex: i,

      },
    })), [codeMethods]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);

  // Keep nodes array in sync with codeMethods length changes (e.g. after CREATE_METHOD)
  useEffect(() => {
    // Generate node definitions for all current methods
    const updatedNodes = codeMethods.map((m, i) => {
      const existing = nodes.find((n) => n.id === `method-${i}`);
      if (existing) return existing; // preserve position and data
      return {
        id: `method-${i}`,
        type: 'method',
        position: { x: 250 * i, y: 100 },
        data: { methodIndex: i },
      } as Node;
    });

    // Include only nodes that still have a matching method
    const trimmedNodes = nodes.filter((n) => n.id.startsWith('method-') && parseInt(n.id.split('-')[1]!) < codeMethods.length);

    const nextNodes = [...trimmedNodes, ...updatedNodes.filter((n) => !trimmedNodes.some((t) => t.id === n.id))];

    if (nextNodes.length !== nodes.length) {
      setNodes(nextNodes);
    }
  }, [codeMethods, setNodes]);

    const [edges, setEdges] = useState<Edge[]>(() => buildEdges(initialNodes, codeMethods));

    useEffect(() => {
      setEdges(buildEdges(nodes, codeMethods));
    }, [nodes, codeMethods, setEdges]);

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
        onNodeDragStop={(e, dragged) => {
          // React Flow has already updated the node's position in `dragged`
          setNodes((nds) => nds.map((n) => (n.id === dragged.id ? dragged : n)));
          setEdges(buildEdges(
            nodes.map((n) => (n.id === dragged.id ? dragged : n)),
            codeMethods,
          ));
        }}
        defaultEdgeOptions={{
          animated: false,
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
