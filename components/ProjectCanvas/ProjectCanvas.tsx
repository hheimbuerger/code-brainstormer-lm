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
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [editValue, setEditValue] = useState(projectName);
  const [newlyCreatedNodeIndex, setNewlyCreatedNodeIndex] = useState<number | null>(null);
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
  const handleSetAutoFocus = useCallback((nodeIndex: number, shouldAutoFocus: boolean = true) => {
    if (shouldAutoFocus) {
      setNewlyCreatedNodeIndex(nodeIndex);
      
      // Clear auto-focus after a delay
      setTimeout(() => {
        setNewlyCreatedNodeIndex(null);
      }, 1000);
    }
  }, []);

  // Create nodes directly from codeFunctions using stored positions
  const nodes: Node[] = useMemo(() => {
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

  const [, setNodes, onNodesChange] = useNodesState(nodes);

  // Handler for creating a new function when double-clicking on a non-existent reference
  const handleCreateNewFunction = useCallback((functionName: string) => {
    // Get current viewport center for placement
    const { getViewport } = useReactFlow();
    const viewport = getViewport();
    const viewportCenter = {
      x: -viewport.x + window.innerWidth / 2,
      y: -viewport.y + window.innerHeight / 2,
    };
    
    // Create existing nodes array for collision detection
    const existingNodes = codeFunctions.map((_, index) => ({
      id: `method-${index}`,
      position: nodePositions[index],
      width: 280,
      height: 200,
      data: { methodIndex: index },
      type: 'method' as const,
    }));
    
    // Find optimal placement near viewport center
    const optimalPosition = findOptimalNodePlacement(viewportCenter, existingNodes);
    
    // Create new function with the specified name
    const newFunction = new CodeFunction(
      new CodeAspect(functionName, AspectState.EDITED),
      new CodeAspect('', AspectState.UNSET),
      new CodeAspect('', AspectState.UNSET),
      new CodeAspect('', AspectState.UNSET),
      ''
    );

    // Add to store with calculated position
    addCodeFunction(optimalPosition);
    const newIndex = codeFunctions.length;
    updateCodeFunction(newIndex, newFunction);

    console.log(`Created new function: ${functionName} at position`, optimalPosition);
  }, [codeFunctions, nodePositions, addCodeFunction, updateCodeFunction]);

  // Handler for centering viewport on an existing function
  const handleCenterOnFunction = useCallback((targetFunctionIndex: number) => {
    if (targetFunctionIndex !== -1) {
      const targetNode = nodes.find((node: Node) => node.id === `method-${targetFunctionIndex}`);
      if (targetNode) {
        // Use React Flow's viewport centering
        centerViewportOnNode(
          targetNode.position,
          { width: 280, height: 200 }, // Default node size
          setViewport,
          1 // Current zoom level
        );
        console.log(`Centered viewport on function: ${targetFunctionIndex}`);
      }
    } else {
      console.log(`Function not found: ${targetFunctionIndex}`);
    }
  }, [codeFunctions, nodes]);

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
    
    // Create existing nodes array for collision detection
    const existingNodes = codeFunctions.map((_, index) => ({
      id: `method-${index}`,
      position: nodePositions[index],
      width: 280,
      height: 200,
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

  // Update React Flow nodes when codeFunctions change
  useEffect(() => {
    setNodes(nodes);
  }, [nodes, setNodes]);

    const [edges, setEdges] = useState<Edge[]>(() => buildEdges([], codeFunctions));

    useEffect(() => {
      setEdges(buildEdges(nodes, codeFunctions));
    }, [nodes, codeFunctions, setEdges]);

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
            nodesDraggable
            nodeDragThreshold={1}
            zoomOnDoubleClick={false}
            onNodeDragStop={(e, dragged) => {
              // Extract the method index from the node ID
              const methodIndex = parseInt(dragged.id.replace('method-', ''), 10);
              
              // Update the store's nodePositions
              setNodePosition(methodIndex, dragged.position);
              
              // Update React Flow nodes state
              setNodes((nds) => nds.map((n) => (n.id === dragged.id ? dragged : n)));
              
              // Rebuild edges with updated positions
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
            <Panel position="top-right" className="react-flow__panel">
              <div style={{ fontSize: '12px' }}>Drag nodes by their header</div>
            </Panel>
          </ReactFlow>
        </div>
      </div>
  );
}
