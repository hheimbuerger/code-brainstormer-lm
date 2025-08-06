'use client';

import { memo, useState, useRef, useEffect, JSX, useCallback } from 'react';

import { useMutation } from '@tanstack/react-query';
import { Handle, Position, useUpdateNodeInternals, useReactFlow } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { useCodebaseStore } from '@/store/useCodebaseStore';
import { CodeAspect, AspectState, CodeAspectType, CodeFunction } from '@/store/codebase.types';
import { applyCodegenCommands, invokeCodegenForFunction, calculateAspectsToGenerate } from '@/features/codegen/codegenFrontend';
import { findOptimalNodePlacement } from '@/utils/nodePlacement';
import { NODE_WIDTH, NODE_MIN_HEIGHT, calculateNodeHeight } from '@/constants/nodeConstants';

import './FunctionNode.css';

// Animated spinner donut component
const SpinnerDonut = () => <span className="spinner-donut" />;

// helper to map AspectState -> emoji icon
const getIconForState = (s?: AspectState) => {
  switch (s) {
    case AspectState.UNSET:
      return '⚪';
    case AspectState.AUTOGEN:
      return '🤖';
    case AspectState.EDITED:
      return '✏️';
    case AspectState.LOCKED:
      return '🔒';
    default:
      return '';
  }
};

type EditableFieldProps = {
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  className?: string;
  isItalic?: boolean;
  isBold?: boolean;
  isProcessing?: boolean;
  autoFocus?: boolean;
};

const EditableField = ({
  value,
  onSave,
  placeholder = '',
  className = '',
  isItalic = false,
  isBold = false,
  isProcessing = false,
  autoFocus = false,
  nodeId,
  fieldName,
  methodIndex,
}: EditableFieldProps & {
  nodeId?: string;
  fieldName?: string;
  methodIndex?: number;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sync inputValue with value prop when it changes (e.g., after backend updates)
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Auto-focus functionality - enter edit mode if autoFocus is true
  useEffect(() => {
    if (autoFocus && !isEditing) {
      setIsEditing(true);
    }
  }, [autoFocus, isEditing]);

  // Auto-resize textarea to fit content
  const autoResize = useCallback(() => {
    if (inputRef.current) {
      // Reset height to auto to get the correct scrollHeight
      inputRef.current.style.height = 'auto';
      // Set height to scrollHeight to fit all content
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      // Small delay to ensure the textarea is fully rendered and ready for focus
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // Move cursor to end of text
          const length = inputRef.current.value.length;
          inputRef.current.setSelectionRange(length, length);
          // Auto-resize when opening the field
          autoResize();
        }
      }, 100);
    }
  }, [isEditing, autoResize]);

  // Auto-resize when content changes
  useEffect(() => {
    if (isEditing) {
      autoResize();
    }
  }, [inputValue, isEditing, autoResize]);

  const handleSave = () => {
    if (inputValue.trim() !== '' || value === '') {
      onSave(inputValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setInputValue(value);
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    handleSave();
  };

  if (isEditing) {
    return (
      <div style={{ position: 'relative' }}>
        <textarea
          ref={inputRef}
          className={`editable-field ${className}`}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          style={{
            fontStyle: isItalic ? 'italic' : 'normal',
            fontWeight: isBold ? 'bold' : 'normal',
            resize: 'none', // Prevent manual resizing since we're auto-resizing
            overflow: 'hidden', // Hide scrollbars since we auto-resize
            minHeight: '1.2em', // Ensure minimum height for single line
            boxSizing: 'border-box', // Include padding in height calculations
          }}
        />
        {isProcessing && (
          <span className="editable-field__status" style={{ position: 'absolute', right: 4, top: 4, fontSize: 10, color: '#888' }}>Processing...</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`editable-field ${className}`}
      onClick={(e) => {
        if (isProcessing) return; // Don't allow editing during processing
        e.stopPropagation();
        setIsEditing(true);
      }}
      style={{
        fontStyle: isItalic ? 'italic' : 'normal',
        fontWeight: isBold ? 'bold' : 'normal',
        cursor: isProcessing ? 'not-allowed' : 'text',
        opacity: isProcessing ? 0.6 : 1,
        whiteSpace: 'pre-wrap', // Preserve line breaks and whitespace
        pointerEvents: isProcessing ? 'none' : 'auto',
      }}
    >
      {value || placeholder}
    </div>
  );
};

// Custom node data type that matches what we store in React Flow nodes
interface FunctionNodeData {
  methodIndex: number;
  autoFocusIdentifier?: boolean;
  onSetAutoFocus?: (nodeIndex: number, shouldAutoFocus?: boolean) => void;
};

type FunctionNodeProps = NodeProps<FunctionNodeData>;

function FunctionNode(props: FunctionNodeProps) {
  const { id: nodeId, data, selected } = props;
  const { methodIndex } = data;
  const updateNodeInternals = useUpdateNodeInternals();
  const { setViewport, getViewport, screenToFlowPosition } = useReactFlow();
  
  // Get store data first
  const { codeFunctions, updateCodeFunction, addCodeFunction, nodePositions } = useCodebaseStore();
  
  // Select only the required slice so the node re-renders whenever this function changes
  const method = methodIndex !== undefined ? codeFunctions[methodIndex] : undefined;

  // Force React Flow to recalculate handle positions whenever implementation text changes
  useEffect(() => {
    updateNodeInternals(nodeId);
  }, [nodeId, method?.implementation?.descriptor, updateNodeInternals]);

  // State to track which fields are currently being processed
  const [processingFields, setProcessingFields] = useState<string[]>([]);

  // React Query mutation for codegen (moved from EditableField)
  const codegenMutation = useMutation({
    mutationFn: async ({
      methodIndex,
      field,
      oldValue,
      newValue,
    }: {
      methodIndex: number;
      field: string;
      oldValue: string;
      newValue: string;
    }) => {
      // Calculate which aspects will be generated and mark them as processing
      const aspectsToGenerate = calculateAspectsToGenerate(field as CodeAspectType, method!);
      setProcessingFields(aspectsToGenerate);
      return invokeCodegenForFunction(methodIndex, field);
    },
    onSuccess: (commands) => {
      // apply the commands to the store
      applyCodegenCommands(commands);
      setProcessingFields([]);
    },
    onError: () => {
      setProcessingFields([]);
    },
  });

  // Helper function to check if a field is currently being processed
  const isFieldProcessing = (fieldName: string) => {
    return codegenMutation.isPending && processingFields.includes(fieldName);
  };

  // Helper function to check if any field is processing (for general UI state)
  const isAnyFieldProcessing = () => {
    return codegenMutation.isPending;
  };

  // toggle between LOCKED and AUTOGEN for a field
  const toggleAspectState = (aspectKey: 'identifier' | 'signature' | 'specification' | 'implementation') => {
    if (methodIndex === undefined || !method || isAnyFieldProcessing()) return;
    const currentAspect = method[aspectKey];
    const newAspectState = currentAspect.state === AspectState.LOCKED ? AspectState.AUTOGEN : AspectState.LOCKED;
    const newAspect = new CodeAspect(currentAspect.descriptor, newAspectState);
    updateCodeFunction(methodIndex, { [aspectKey]: newAspect } as Partial<CodeFunction>);
  };

  // Helper function to trigger codegen for this function's aspect
  const triggerCodegenForFunction = (field: string, oldValue: string, newValue: string) => {
    if (methodIndex === undefined || !method) {
      console.warn('Cannot trigger codegen: method or methodIndex is undefined');
      return;
    }

    // Calculate which aspects will be generated
    const aspectsToGenerate = calculateAspectsToGenerate(field as CodeAspectType, method);
    
    // Set processing fields for UI feedback
    console.log('Setting processing fields:', aspectsToGenerate, 'for method:', methodIndex);
    setProcessingFields(aspectsToGenerate);
    
    // Use the React Query mutation instead of calling invokeCodegenForFunction directly
    codegenMutation.mutate({
      methodIndex,
      field,
      oldValue,
      newValue,
    });
  };

  const handleAspectChange = (aspect: 'identifier' | 'signature' | 'specification' | 'implementation', value: string, oldValue: string) => {
    if (methodIndex === undefined || !method) return;

    // Map the old field names to the new GenFunction structure
    const updates: Partial<CodeFunction> = {};

    // Helper function to create a new CodeAspect with updated descriptor and set state to EDITED
    const createUpdatedAspect = (aspect: CodeAspect, descriptor: string, newState: AspectState = AspectState.EDITED): CodeAspect => {
      return new CodeAspect(descriptor, newState);
    };

    switch (aspect) {
      case 'identifier':
        updates.identifier = createUpdatedAspect(method.identifier, value, AspectState.EDITED);
        break;
      case 'signature':
        updates.signature = createUpdatedAspect(method.signature, value, AspectState.EDITED);
        break;
      case 'specification':
        updates.specification = createUpdatedAspect(method.specification, value, AspectState.EDITED);
        break;
      case 'implementation':
        updates.implementation = createUpdatedAspect(method.implementation, value, AspectState.EDITED);
        break;
    }

    updateCodeFunction(methodIndex, updates); // persist aspect edits

    // Trigger codegen if the value actually changed
    if (value !== oldValue) {
      triggerCodegenForFunction(aspect, oldValue, value);
    }
  };

  // Force React Flow to recalculate handle positions whenever implementation text changes
  useEffect(() => {
    updateNodeInternals(nodeId);
  }, [nodeId, method?.implementation?.descriptor, updateNodeInternals]);

  // Check if this is a newly created function that needs codegen (identifier state is AUTOGEN)
  const hasTriggeredCodegen = useRef(false);
  
  useEffect(() => {
    if (method && methodIndex !== undefined && 
        method.identifier.state === AspectState.AUTOGEN && 
        method.identifier.descriptor.trim() !== '' && // Only trigger for non-empty identifiers
        !hasTriggeredCodegen.current) {
      
      console.log('🚀 Auto-triggering codegen for newly created function:', method.identifier.descriptor);
      hasTriggeredCodegen.current = true;
      
      // Use the existing React Query mutation system instead of the helper
      // This should properly set up UI state and processing fields
      codegenMutation.mutate({
        methodIndex,
        field: 'identifier',
        oldValue: '',
        newValue: method.identifier.descriptor,
      });
    }
  }, [method, methodIndex, codegenMutation]);

  // Ref to track previously highlighted edge group
  const prevHighlightedRef = useRef<SVGGElement | null>(null);

  /**
   * Highlight the edge whose `className` matches the hovered inline handle.
   *
   * Steps:
   * 1. Locate the <g> group produced by React-Flow for this handle via the
   *    encoded selector `.edge-from-${handleId}`.
   * 2. Remove the highlight class from any previously-highlighted edge group.
   * 3. Add `.edge-highlight` to the newly-found group so CSS darkens the path.
   */
  const handleMouseEnter = useCallback((handleId: string) => {
    const edgeGroup = document.querySelector<SVGGElement>(`.edge-from-${handleId}`);
    if (prevHighlightedRef.current && prevHighlightedRef.current !== edgeGroup) {
      prevHighlightedRef.current.classList.remove('edge-highlight');
    }
    if (edgeGroup) {
      edgeGroup.classList.add('edge-highlight');
      prevHighlightedRef.current = edgeGroup;
    }
  }, []);

  /**
   * Remove highlighting when the pointer leaves an inline handle/span.
   * Clears the stored reference to avoid stale DOM nodes.
   */
  const handleMouseLeave = useCallback(() => {
    if (prevHighlightedRef.current) {
      prevHighlightedRef.current.classList.remove('edge-highlight');
      prevHighlightedRef.current = null;
    }
  }, []);

  /**
   * Parse a method implementation string and return an array of JSX elements
   * where each detected function call is wrapped in a <span>.
   * 
   * For existing functions: shows a handle for edge connection and allows double-click to center viewport
   * For non-existent functions: shows an asterisk indicator and allows double-click to create the function
   *
   * Example conversion:
   *   "return formatText(str) + newFunc(a,b);"  →
   *   ["return ", <span>formatText<Handle/></span>, " + ", <span>newFunc*</span>, ";"]
   */
  const renderImplementation = (impl: string) => {
    // maintain per-function counters so indices stay consistent with edge generation
    const fnCounts: Record<string, number> = {};
    const parts: JSX.Element[] = [];
    const regex = /[A-Za-z_]+\([^)]*\)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let idx = 0;
    
    while ((match = regex.exec(impl)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        parts.push(<span key={`text-${idx}`}>{impl.slice(lastIndex, matchIndex)}</span>);
      }
      
      const fnCall = match[0];
      const fnName = fnCall.split('(')[0];
      const localIndex = fnCounts[fnName] ?? 0;
      fnCounts[fnName] = localIndex + 1;
      
      // Check if this function exists in the codebase
      const targetFunctionExists = codeFunctions.some((f: any) => 
        f.identifier?.descriptor?.startsWith(fnName)
      );
      
      if (targetFunctionExists) {
        // Existing function: show handle for edge connection
        parts.push(
          <span
            key={`call-${idx}`}
            className="inline-fn-call existing-function"
            onMouseEnter={() => handleMouseEnter(`${fnName}-${methodIndex}-${localIndex}`)}
            onMouseLeave={handleMouseLeave}
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Find the target function index by name
              const targetFunctionIndex = codeFunctions.findIndex((f: any) => 
                f.identifier?.descriptor?.startsWith(fnName)
              );
              if (targetFunctionIndex !== -1) {
                // Center viewport on existing function using stored position
                console.log(`Centering on function: ${fnName} at index ${targetFunctionIndex}`);
                
                // Get the target node position from store (not DOM)
                const targetPosition = nodePositions[targetFunctionIndex];
                if (targetPosition) {
                  // Get current viewport to preserve zoom level
                  const currentViewport = getViewport();
                  
                  // Calculate center position (node position + half node size)
                  const nodeCenterX = targetPosition.x + 140; // half of 280px width
                  const nodeCenterY = targetPosition.y + 100; // half of 200px height
                  
                  // Get container dimensions
                  const container = document.querySelector('.react-flow');
                  if (container) {
                    const containerRect = container.getBoundingClientRect();
                    const containerCenterX = containerRect.width / 2;
                    const containerCenterY = containerRect.height / 2;
                    
                    // Calculate new viewport position to center the node
                    const newX = containerCenterX - nodeCenterX * currentViewport.zoom;
                    const newY = containerCenterY - nodeCenterY * currentViewport.zoom;
                    
                    // Center the viewport with smooth animation while preserving zoom
                    setViewport(
                      { x: newX, y: newY, zoom: currentViewport.zoom },
                      { duration: 800 } // Smooth animation
                    );
                  }
                }
              }
            }}
            title="Double-click to center on this function"
          >
            {fnCall}
            <Handle
              type="source"
              position={Position.Right}
              id={`${fnName}-${methodIndex}-${localIndex}`}
              data-fn-name={fnName}
              data-handle-id={`${fnName}-${methodIndex}-${localIndex}`}
              className="inline-fn-handle"
              style={{
                width: 8,
                height: 8,
                transition: 'transform 0.1s ease',
                zIndex: 10
              }}
              isConnectable={false}
              onMouseEnter={() => handleMouseEnter(`${fnName}-${methodIndex}-${localIndex}`)}
              onMouseLeave={handleMouseLeave}
            />
          </span>
        );
      } else {
        // Non-existent function: show asterisk indicator
        parts.push(
          <span
            key={`call-${idx}`}
            className="inline-fn-call new-function"
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              
              // Get click position in React Flow coordinates (accounting for zoom and pan)
              const clickPosition = screenToFlowPosition({
                x: e.clientX,
                y: e.clientY,
              });
              
              // Create existing nodes array for collision detection
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
              
              // Create new function
              const newFunction = new CodeFunction(
                new CodeAspect(fnName, AspectState.EDITED),
                new CodeAspect('', AspectState.UNSET),
                new CodeAspect('', AspectState.UNSET),
                new CodeAspect('', AspectState.UNSET),
                ''
              );
              
              // Add to store with calculated position
              addCodeFunction(optimalPosition);
              const newIndex = codeFunctions.length;
              updateCodeFunction(newIndex, newFunction);
              
              // Don't auto-focus for named nodes (identifier already filled)
              if (data.onSetAutoFocus) {
                data.onSetAutoFocus(newIndex, false);
              }
              
              // Update the function with the identifier set to AUTOGEN state
              // This signals to the new function node that it should trigger codegen on mount
              const updatedFunction = {
                ...newFunction,
                identifier: new CodeAspect(fnName, AspectState.AUTOGEN)
              };
              updateCodeFunction(newIndex, updatedFunction);
              
              // Navigate to the newly created node with smooth animation
              setTimeout(() => {
                const nodeCenterX = optimalPosition.x + 100; // half of 200px width
                const nodeCenterY = optimalPosition.y + 60; // half of 120px height
                
                const container = document.querySelector('.react-flow');
                if (container) {
                  const containerRect = container.getBoundingClientRect();
                  const containerCenterX = containerRect.width / 2;
                  const containerCenterY = containerRect.height / 2;
                  
                  // Get current viewport to preserve zoom
                  const currentViewport = getViewport();
                  
                  // Calculate new viewport position to center the node
                  const newX = containerCenterX - nodeCenterX * currentViewport.zoom;
                  const newY = containerCenterY - nodeCenterY * currentViewport.zoom;
                  
                  // Animate to the new node
                  setViewport(
                    { x: newX, y: newY, zoom: currentViewport.zoom },
                    { duration: 800 }
                  );
                }
              }, 100); // Small delay to ensure node is rendered
              
              console.log(`Created new function: ${fnName} at position`, optimalPosition);
            }}
            title="Double-click to create this function"
          >
            {fnCall}
            <span className="new-function-indicator">*</span>
          </span>
        );
      }
      
      lastIndex = matchIndex + fnCall.length;
      idx += 1;
    }
    
    if (lastIndex < impl.length) {
      parts.push(<span key={`text-${idx}`}>{impl.slice(lastIndex)}</span>);
    }
    
    return parts;
  };

  const handleNodeClick = (e: React.MouseEvent) => {
    // Don't interfere with double-click events on function references
    const target = e.target as HTMLElement;
    if (target.closest('.inline-fn-call')) {
      return; // Let function reference clicks through
    }
    
    // Prevent node selection when clicking on non-header areas
    if (!target.closest('.method-node__header')) {
      e.stopPropagation();
    }
  };

  return (
    <div
      className={`method-node ${selected ? 'selected' : ''}`}
      onClick={handleNodeClick}
    >
      {/* invisible target handles on all four sides for automatic routing */}
      <Handle type="target" position={Position.Top} id="t" style={{ opacity: 0 }} isConnectable={false} />
      <Handle type="target" position={Position.Right} id="r" style={{ opacity: 0 }} isConnectable={false} />
      <Handle type="target" position={Position.Bottom} id="b" style={{ opacity: 0 }} isConnectable={false} />
      <Handle type="target" position={Position.Left} id="l" style={{ opacity: 0 }} isConnectable={false} />

      <div className="method-node__header method-node-drag-handle" style={{position:'relative'}}>
        <EditableField
          value={method?.identifier?.descriptor || ''}
          onSave={(value) => handleAspectChange('identifier', value, method?.identifier?.descriptor || '')}
          placeholder="Enter method name"
          className="method-node__identifier"
          isBold
          nodeId={nodeId}
          fieldName="identifier"
          methodIndex={methodIndex}
          isProcessing={isFieldProcessing('identifier')}
          autoFocus={data.autoFocusIdentifier || false}
        />
        <span className="field-state-icon" onClick={(e)=>{e.stopPropagation(); toggleAspectState('identifier');}}>
          {isFieldProcessing('identifier') ? <SpinnerDonut /> : getIconForState(method?.identifier?.state)}
        </span>
      </div>

      <div className="method-node__signature" style={{position:'relative'}}>
        <EditableField
          value={method?.signature?.descriptor || ''}
          onSave={(value) => handleAspectChange('signature', value, method?.signature?.descriptor || '')}
          placeholder="return type"
          isItalic
          nodeId={nodeId}
          fieldName="signature"
          methodIndex={methodIndex}
          isProcessing={isFieldProcessing('signature')}
        />
        <span className="field-state-icon" onClick={(e)=>{e.stopPropagation(); toggleAspectState('signature');}}>
          {isFieldProcessing('signature') ? <SpinnerDonut /> : getIconForState(method?.signature?.state)}
        </span>
      </div>

      <div className="method-node__specification">
        <EditableField
          value={method?.specification?.descriptor || ''}
          onSave={(value) => handleAspectChange('specification', value, method?.specification?.descriptor || '')}
          placeholder="Enter specification"
          nodeId={nodeId}
          fieldName="specification"
          methodIndex={methodIndex}
          isProcessing={isFieldProcessing('specification')}
        />
        <span className="field-state-icon" onClick={(e)=>{e.stopPropagation(); toggleAspectState('specification');}}>
          {isFieldProcessing('specification') ? <SpinnerDonut /> : getIconForState(method?.specification?.state)}
        </span>
      </div>

      <div className="method-node__implementation">
        <div className="method-node__implementation-content">
          {renderImplementation(method?.implementation?.descriptor || '')}
        </div>
        <span className="field-state-icon" onClick={(e)=>{e.stopPropagation(); toggleAspectState('implementation');}}>
          {isFieldProcessing('implementation') ? <SpinnerDonut /> : getIconForState(method?.implementation?.state)}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} id="a" />
    </div>
  );
}

export default memo(FunctionNode);
