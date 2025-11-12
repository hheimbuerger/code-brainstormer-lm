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
    const method = codeFunctions.find((f: any) => f.id === srcNode.id);
    if (!method) return;
    const impl = method.implementation?.descriptor ?? '';
    let match: RegExpExecArray | null;
    const fnCounts: Record<string, number> = {};
    while ((match = fnRegex.exec(impl)) !== null) {
      const fnName = match[0];
      const localIndex = fnCounts[fnName] ?? 0;
      fnCounts[fnName] = localIndex + 1;
      const targetFunc = codeFunctions.find((f: any) => f.identifier?.descriptor?.startsWith(fnName));
      if (!targetFunc) continue;
      const tgtNode = nodes.find((n) => n.id === targetFunc.id);
      if (!tgtNode) continue;
      const dx = tgtNode.position.x - srcNode.position.x;
      const dy = tgtNode.position.y - srcNode.position.y;
      const targetPosition: Position = Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? Position.Left : Position.Right)
        : (dy > 0 ? Position.Top : Position.Bottom);
      result.push({
        id: `edge-${srcNode.id}-${tgtNode.id}-${localIndex}`,
        source: srcNode.id,
        sourceHandle: `${fnName}-${srcNode.id}-${localIndex}`,
        target: tgtNode.id,
        targetHandle: targetPosition === Position.Top ? 't' : targetPosition === Position.Right ? 'r' : targetPosition === Position.Bottom ? 'b' : 'l',
        className: `edge-from-${fnName}-${srcNode.id}-${localIndex}`,
        targetPosition,
        sourcePosition: Position.Right,
      } as Edge);
    }
  });
  return result;
}

export default function ProjectCanvas() {
  const { projectName, updateProjectName, codeFunctions, addCodeFunction, updateCodeFunction, setNodePosition, loadProjectFromFile } = useCodebaseStore();
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [editValue, setEditValue] = useState(projectName);
  const [newlyCreatedNodeIndex, setNewlyCreatedNodeIndex] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setViewport, getViewport, screenToFlowPosition } = useReactFlow();

  // Load project data from external JSON on mount
  useEffect(() => {
    loadProjectFromFile();
  }, [loadProjectFromFile]);

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
  const handleSetAutoFocus = useCallback((functionId: string, shouldAutoFocus: boolean = true) => {
    if (shouldAutoFocus) {
      setNewlyCreatedNodeIndex(functionId);
      
      // Clear auto-focus after a delay
      setTimeout(() => {
        setNewlyCreatedNodeIndex(null);
      }, 1000);
    }
  }, []);

  // Create initial nodes from codeFunctions using stored positions
  const initialNodes: Node[] = useMemo(() => {
    return codeFunctions.map((func) => ({
      id: func.id,
      type: 'method',
      position: func.position,
      data: {
        functionId: func.id,
        autoFocusIdentifier: newlyCreatedNodeIndex === func.id,
        onSetAutoFocus: handleSetAutoFocus,
      },
    }));
  }, [codeFunctions, newlyCreatedNodeIndex, handleSetAutoFocus]);

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
    const existingNodes = codeFunctions.map((func) => ({
      id: func.id,
      position: func.position,
      width: NODE_WIDTH,
      height: calculateNodeHeight(func), // Use actual calculated height based on content
      data: { functionId: func.id },
      type: 'method' as const,
    }));
    
    // Find optimal placement near click position
    const optimalPosition = findOptimalNodePlacement(clickPosition, existingNodes);

    // Add to store with calculated position - this returns the new function's ID
    const newFunctionId = addCodeFunction(optimalPosition);
    
    // Set the newly created node for auto-focus (empty nodes need typing)
    handleSetAutoFocus(newFunctionId, true);

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
  }, [codeFunctions, addCodeFunction, handleSetAutoFocus, screenToFlowPosition, getViewport, setViewport]);

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
              // Update the store's position using the function ID
              setNodePosition(dragged.id, dragged.position);
              
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
            <Controls />
            {/* <Panel position="top-right" className="react-flow__panel">
              <div style={{ fontSize: '12px' }}>Drag nodes by their header</div>
            </Panel> */}
          </ReactFlow>
        </div>
      </div>
  );
}
