'use client';

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Panel,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeTypes,
  type EdgeTypes,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

import FunctionNode from './FunctionNode';
import { useCodebaseStore } from '../../store/useCodebaseStore';
import { findOptimalNodePlacement, centerViewportOnNode } from '../../utils/nodePlacement';
import { NODE_WIDTH, NODE_MIN_HEIGHT, calculateNodeHeight } from '../../constants/nodeConstants';
import { CodeFunction, CodeAspect, AspectState } from '../../store/codebase.types';
import './ProjectCanvas.css';

// Define nodeTypes and edgeTypes outside the component for stability
const nodeTypes: NodeTypes = {
  method: FunctionNode,
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
function buildEdges(nodes: Node[], codeFunctions: any[]): Edge[] {
  const result: Edge[] = [];
  const fnRegex = /[A-Za-z_]+(?=\()/g;

  nodes.forEach((srcNode) => {
    const srcIdx = parseInt(srcNode.id.replace('method-', ''), 10);
    const method = codeFunctions[srcIdx];
    if (!method) return;
    const impl = method.implementation?.descriptor ?? '';
    let match: RegExpExecArray | null;
    const fnCounts: Record<string, number> = {};
    while ((match = fnRegex.exec(impl)) !== null) {
      const fnName = match[0];
      const localIndex = fnCounts[fnName] ?? 0;
      fnCounts[fnName] = localIndex + 1;
      const tgtIdx = codeFunctions.findIndex((f: any) => f.identifier?.descriptor?.startsWith(fnName));
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

export default function ProjectCanvas() {
  const { projectName, updateProjectName, codeFunctions, nodePositions, addCodeFunction, updateCodeFunction, setNodePosition, loadProjectFromFile } = useCodebaseStore();
  const temporal = (useCodebaseStore as any).temporal as { getState: () => any; subscribe: (fn: (s: any) => void) => () => void; undo: () => void; redo: () => void };
  if (process.env.NODE_ENV !== 'production') {
    // Log once per render to verify temporal is present
    // eslint-disable-next-line no-console
    console.debug('[Undo/Redo] temporal attached?', !!temporal, temporal?.getState?.());
  }
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [editValue, setEditValue] = useState(projectName);
  const [newlyCreatedNodeIndex, setNewlyCreatedNodeIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setViewport, getViewport, screenToFlowPosition } = useReactFlow();

  // Load project data from external JSON on mount
  useEffect(() => {
    loadProjectFromFile();
  }, [loadProjectFromFile]);

  // Track canUndo/canRedo from zundo temporal store
  const [canUndo, setCanUndo] = useState<boolean>(() => {
    const s = temporal?.getState?.();
    const v = (s?.pastStates?.length ?? 0) > 0;
    if (process.env.NODE_ENV !== 'production') console.debug('[Undo/Redo] init canUndo', v, s?.pastStates?.length);
    return v;
  });
  const [canRedo, setCanRedo] = useState<boolean>(() => {
    const s = temporal?.getState?.();
    const v = (s?.futureStates?.length ?? 0) > 0;
    if (process.env.NODE_ENV !== 'production') console.debug('[Undo/Redo] init canRedo', v, s?.futureStates?.length);
    return v;
  });

  useEffect(() => {
    let unsubs: Array<() => void> = [];
    if (temporal && typeof temporal.subscribe === 'function') {
      const unsubTemporal = temporal.subscribe((s: any) => {
        const cu = (s?.pastStates?.length ?? 0) > 0;
        const cr = (s?.futureStates?.length ?? 0) > 0;
        if (process.env.NODE_ENV !== 'production') console.debug('[Undo/Redo] temporal update', { past: s?.pastStates?.length, future: s?.futureStates?.length, canUndo: cu, canRedo: cr });
        setCanUndo(cu);
        setCanRedo(cr);
      });
      unsubs.push(unsubTemporal);
    }
    // Fallback: subscribe to main store changes and recompute from temporal.getState()
    const unsubStore = (useCodebaseStore as any).subscribe?.(() => {
      const ts = temporal?.getState?.();
      const cu = (ts?.pastStates?.length ?? 0) > 0;
      const cr = (ts?.futureStates?.length ?? 0) > 0;
      if (process.env.NODE_ENV !== 'production') console.debug('[Undo/Redo] store update', { past: ts?.pastStates?.length, future: ts?.futureStates?.length, canUndo: cu, canRedo: cr });
      setCanUndo(cu);
      setCanRedo(cr);
    });
    if (unsubStore) unsubs.push(unsubStore);
    return () => {
      unsubs.forEach((u) => {
        try { u && u(); } catch {}
      });
    };
  }, [temporal]);

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Y for undo/redo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Avoid interfering while typing in inputs/textareas
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || target?.isContentEditable;
      if (isTyping) return;

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (canUndo) {
          if (process.env.NODE_ENV !== 'production') console.debug('[Undo/Redo] KB: undo');
          temporal?.getState?.().undo?.();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        if (canRedo) {
          if (process.env.NODE_ENV !== 'production') console.debug('[Undo/Redo] KB: redo');
          temporal?.getState?.().redo?.();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [temporal, canUndo, canRedo]);

  // Sync editValue when projectName changes from store
  useEffect(() => {
    setEditValue(projectName);
  }, [projectName]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingProjectName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingProjectName]);

  const handleStartEdit = () => {
    setIsEditingProjectName(true);
  };

  const handleSaveEdit = () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== projectName) {
      updateProjectName(trimmedValue);
    } else {
      setEditValue(projectName); // Reset to original if empty or unchanged
    }
    setIsEditingProjectName(false);
  };

  const handleCancelEdit = () => {
    setEditValue(projectName);
    setIsEditingProjectName(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // Callback to set auto-focus for newly created nodes
  const handleSetAutoFocus = useCallback((nodeIndex: number, shouldAutoFocus: boolean = true) => {
    if (shouldAutoFocus) {
      setNewlyCreatedNodeIndex(nodeIndex);
      
      // Clear auto-focus after a delay
      setTimeout(() => {
        setNewlyCreatedNodeIndex(null);
      }, 1000);
    }
  }, []);

  // Create initial nodes from codeFunctions using stored positions
  const initialNodes: Node[] = useMemo(() => {
    return codeFunctions.map((func, index) => ({
      id: `method-${index}`,
      type: 'method',
      position: nodePositions[index], // Use stored position
      data: {
        methodIndex: index,
        autoFocusIdentifier: newlyCreatedNodeIndex === index,
        onSetAutoFocus: handleSetAutoFocus,
      },
    }));
  }, [codeFunctions, nodePositions, newlyCreatedNodeIndex]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges] = useState<Edge[]>([]);

  // Handler for double-clicking on empty canvas to create new node
  const handleCanvasDoubleClick = useCallback((event: React.MouseEvent) => {
    // Only handle double-clicks on the canvas background, not on nodes or other elements
    const target = event.target as HTMLElement;
    if (target.closest('.react-flow__node') || target.closest('.react-flow__edge') || target.closest('.project-header')) {
      return; // Don't create node if clicking on existing elements
    }

    // Get click position in React Flow coordinates (accounting for zoom and pan)
    const clickPosition = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    
    // Create existing nodes array for collision detection with actual heights
    const existingNodes = codeFunctions.map((func, index) => ({
      id: `method-${index}`,
      position: nodePositions[index],
      width: NODE_WIDTH,
      height: calculateNodeHeight(func), // Use actual calculated height based on content
      data: { methodIndex: index },
      type: 'method' as const,
    }));
    
    // Find optimal placement near click position
    const optimalPosition = findOptimalNodePlacement(clickPosition, existingNodes);

    // Create new empty function
    const newFunction = new CodeFunction(
      new CodeAspect('', AspectState.UNSET), // Empty identifier to trigger edit mode
      new CodeAspect('', AspectState.UNSET),
      new CodeAspect('', AspectState.UNSET),
      new CodeAspect('', AspectState.UNSET),
      ''
    );

    // Add to store with calculated position
    addCodeFunction(optimalPosition);
    const newIndex = codeFunctions.length;
    updateCodeFunction(newIndex, newFunction);
    
    // Set the newly created node for auto-focus (empty nodes need typing)
    handleSetAutoFocus(newIndex, true);

    // Navigate to the newly created node with smooth animation
    setTimeout(() => {
      const nodeCenterX = optimalPosition.x + 100; // half of 200px width
      const nodeCenterY = optimalPosition.y + 60; // half of 120px height
      
      const container = document.querySelector('.react-flow');
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const containerCenterX = containerRect.width / 2;
        const containerCenterY = containerRect.height / 2;
        
        // Get current viewport to preserve zoom level
        const currentViewport = getViewport();
        
        // Calculate new viewport position to center the node
        const newX = containerCenterX - nodeCenterX * currentViewport.zoom;
        const newY = containerCenterY - nodeCenterY * currentViewport.zoom;
        
        // Animate to the new node while preserving zoom
        setViewport(
          { x: newX, y: newY, zoom: currentViewport.zoom },
          { duration: 800 }
        );
      }
    }, 100); // Small delay to ensure node is rendered

    console.log(`Created new empty function at position`, optimalPosition);
  }, [codeFunctions, nodePositions, addCodeFunction, updateCodeFunction]);

  // Update React Flow nodes when codeFunctions or nodePositions change (but not during dragging)
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  // Rebuild edges whenever codeFunctions or nodes change (e.g., after code generation)
  useEffect(() => {
    setEdges(buildEdges(nodes, codeFunctions));
  }, [codeFunctions, nodes]);

  return (
      <div className="project-canvas">
        {/* Project Banner */}
        <div className="project-canvas__banner">
          <div className="project-canvas__banner-content">
            {isEditingProjectName ? (
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSaveEdit}
                onKeyDown={handleKeyDown}
                className="project-canvas__title-input"
                placeholder="Enter project name"
              />
            ) : (
              <h1 
                className="project-canvas__title" 
                onClick={handleStartEdit}
                title="Click to edit project name"
              >
                {projectName}
              </h1>
            )}
            <div className="project-canvas__subtitle">Code Brainstormer</div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="project-canvas__diagram">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            fitView
            fitViewOptions={{
              padding: 0.2,
              minZoom: 1.5,
              maxZoom: 1.5
            }}
            nodesDraggable
            nodeDragThreshold={1}
            noDragClassName="noDrag"
            zoomOnDoubleClick={false}
            onNodeDrag={(e, dragged) => {
              // Real-time update during dragging for smooth UI feedback
              setNodes((nds) => nds.map((n) => (n.id === dragged.id ? dragged : n)));
              
              // Optionally rebuild edges in real-time (may impact performance)
              // Uncomment the next 3 lines if you want edges to update during drag
              // setEdges(buildEdges(
              //   nodes.map((n) => (n.id === dragged.id ? dragged : n)),
              //   codeFunctions,
              // ));
            }}
            onNodeDragStop={(e, dragged) => {
              // Extract the method index from the node ID
              const methodIndex = parseInt(dragged.id.replace('method-', ''), 10);
              
              // Update the store's nodePositions (final persistence)
              setNodePosition(methodIndex, dragged.position);
              
              // Ensure React Flow nodes state is updated
              setNodes((nds) => nds.map((n) => (n.id === dragged.id ? dragged : n)));
              
              // Rebuild edges with final positions
              setEdges(buildEdges(
                nodes.map((n) => (n.id === dragged.id ? dragged : n)),
                codeFunctions,
              ));
            }}
            onDoubleClick={handleCanvasDoubleClick}
            defaultEdgeOptions={{
              animated: false,
            }}
          >
            <Background />
            <Controls position="bottom-left">
              <button
                className="react-flow__controls-button"
                title={canUndo ? 'Undo (Ctrl+Z)' : 'Undo'}
                onClick={() => {
                  if (process.env.NODE_ENV !== 'production') console.debug('[Undo/Redo] BTN: undo');
                  temporal?.getState?.().undo?.();
                }}
                disabled={!canUndo}
                aria-label="Undo"
              >
                ⤺
              </button>
              <button
                className="react-flow__controls-button"
                title={canRedo ? 'Redo (Ctrl+Y)' : 'Redo'}
                onClick={() => {
                  if (process.env.NODE_ENV !== 'production') console.debug('[Undo/Redo] BTN: redo');
                  temporal?.getState?.().redo?.();
                }}
                disabled={!canRedo}
                aria-label="Redo"
              >
                ⤻
              </button>
            </Controls>
            {/* <Panel position="top-right" className="react-flow__panel">
              <div style={{ fontSize: '12px' }}>Drag nodes by their header</div>
            </Panel> */}
          </ReactFlow>
        </div>
      </div>
  );
}
