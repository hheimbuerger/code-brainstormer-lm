'use client';

import { memo, useState, useRef, useEffect, JSX, useCallback } from 'react';

import { useMutation } from '@tanstack/react-query';
import { Handle, Position, useUpdateNodeInternals } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { useCodebaseStore } from '@/store/useCodebaseStore';
import { CodeAspect, AspectState, CodeAspectType, CodeFunction } from '@/store/codebase.types';
import { applyCodegenCommands, invokeCodegenForFunction, calculateAspectsToGenerate } from '@/features/codegen/codegenFrontend';
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
};

const EditableField = ({
  value,
  onSave,
  placeholder = '',
  className = '',
  isItalic = false,
  isBold = false,
  isProcessing = false,
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
      inputRef.current.focus();
      // Move cursor to end of text
      const length = inputRef.current.value.length;
      inputRef.current.setSelectionRange(length, length);
      // Auto-resize when opening the field
      autoResize();
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

// CustomNodeData is now imported from useNodesStore.ts

// Custom node data type that matches what we store in React Flow nodes
type FunctionNodeData = {
  methodIndex: number;
};

type FunctionNodeProps = NodeProps<FunctionNodeData>;

function FunctionNode(props: FunctionNodeProps) {
  const { id: nodeId, data, selected } = props;
  const { methodIndex } = data;
  const updateNodeInternals = useUpdateNodeInternals();

  // Get store data first
  const { codeFunctions, updateCodeFunction } = useCodebaseStore();
  
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
      codegenMutation.mutate({
        methodIndex,
        field: aspect,
        oldValue,
        newValue: value,
      });
    }
  };

  // Force React Flow to recalculate handle positions whenever implementation text changes
  useEffect(() => {
    updateNodeInternals(nodeId);
  }, [nodeId, method?.implementation?.descriptor, updateNodeInternals]);

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
   * where each detected function call is wrapped in a <span> that contains a
   * React-Flow <Handle>.
   *
   * The function also guarantees stable handle IDs and matching edge classes
   * by maintaining a local `fnCounts` map so repeated calls to the same
   * function are indexed deterministically.
   *
   * Example conversion:
   *   "return formatText(str) + sum(a,b);"  →
   *   ["return ", <span key=…>formatText<Handle id="formatText-0" …/></span>,
   *    " + ", <span key=…>sum<Handle id="sum-0" …/></span>, ";"]
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
      parts.push(
        <span
          key={`call-${idx}`}
          className="inline-fn-call"
          onMouseEnter={() => handleMouseEnter(`${fnName}-${methodIndex}-${localIndex}`)}
          onMouseLeave={handleMouseLeave}
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
      lastIndex = matchIndex + fnCall.length;
      idx += 1;
    }
    if (lastIndex < impl.length) {
      parts.push(<span key={`text-${idx}`}>{impl.slice(lastIndex)}</span>);
    }
    return parts;
  };

  const handleNodeClick = (e: React.MouseEvent) => {
    // Prevent node selection when clicking on non-header areas
    if (!(e.target as HTMLElement).closest('.method-node__header')) {
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
