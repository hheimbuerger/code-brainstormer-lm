'use client';

import { memo, useState, useRef, useEffect, JSX, useCallback } from 'react';
import axios from 'axios';
import { useMutation } from '@tanstack/react-query';
import { Handle, Position, useUpdateNodeInternals } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { useCodebaseStore } from '../../store/useCodebaseStore';
import { CodeAspect, AspectState } from '../../store/codebase.types';
import type { CodeMethod } from '../../store/codebase.types';
import './CustomNode.css';

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
};

const EditableField = ({
  value,
  onSave,
  placeholder = '',
  className = '',
  isItalic = false,
  isBold = false,
  nodeId,
  fieldName,
}: EditableFieldProps & { nodeId?: string; fieldName?: string }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Move cursor to end of text
      const length = inputRef.current.value.length;
      inputRef.current.setSelectionRange(length, length);
    }
  }, [isEditing]);

  // React Query mutation for log-edit
  const logEditMutation = useMutation({
    mutationFn: async ({ nodeId, field, oldValue, newValue }: { nodeId: string; field: string; oldValue: string; newValue: string }) => {
      return axios.post('/api/log-edit', {
        nodeId,
        field,
        oldValue,
        newValue,
      });
    },
  });

  const handleSave = () => {
    if (inputValue.trim() !== '' || value === '') {
      if (inputValue !== value && nodeId && fieldName) {
        logEditMutation.mutate({
          nodeId,
          field: fieldName,
          oldValue: value,
          newValue: inputValue,
        });
      }
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
          }}
        />
        {logEditMutation.isPending && (
          <span className="editable-field__status" style={{ position: 'absolute', right: 4, top: 4, fontSize: 10, color: '#888' }}>Saving...</span>
        )}
        {logEditMutation.isError && (
          <span className="editable-field__status" style={{ position: 'absolute', right: 4, top: 4, fontSize: 10, color: 'red' }}>Error</span>
        )}
        {logEditMutation.isSuccess && (
          <span className="editable-field__status" style={{ position: 'absolute', right: 4, top: 4, fontSize: 10, color: 'green' }}>Saved</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`editable-field ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      style={{
        fontStyle: isItalic ? 'italic' : 'normal',
        fontWeight: isBold ? 'bold' : 'normal',
        cursor: 'text',
      }}
    >
      {value || placeholder}
    </div>
  );
};

// CustomNodeData is now imported from useNodesStore.ts

// Custom node data type that matches what we store in React Flow nodes
type CustomNodeData = {
  id: string;
  methodIndex: number;
};

type CustomNodeProps = NodeProps<CustomNodeData>;

function CustomNode(props: CustomNodeProps) {
  const { data, selected, id: nodeId } = props;
  const updateNodeInternals = useUpdateNodeInternals();
  const methodIndex = data.methodIndex;

  // Select only the required slice so the node re-renders whenever this method changes
  const method = useCodebaseStore(state => state.codeMethods[methodIndex]);
  const updateCodeMethod = useCodebaseStore(state => state.updateCodeMethod);

  // toggle between LOCKED and AUTOGEN for a field
  const toggleFieldState = (fieldKey: 'identifier' | 'signature' | 'specification' | 'implementation') => {
    if (methodIndex === undefined || !method) return;
    const field = method[fieldKey];
    const newState = field.state === AspectState.LOCKED ? AspectState.AUTOGEN : AspectState.LOCKED;
    const updatedField = new CodeAspect(field.descriptor, newState, field.code);
    updateCodeMethod(methodIndex, { [fieldKey]: updatedField } as Partial<CodeMethod>);
  };

  const handleFieldChange = (field: 'identifier' | 'signature' | 'specification' | 'implementation', value: string) => {
    if (methodIndex === undefined || !method) return;

    // Map the old field names to the new GenMethod structure
    const updates: Partial<CodeMethod> = {};

    // Helper function to create a new CodeField with updated descriptor and set state to EDITED
    const createUpdatedField = (field: CodeAspect, descriptor: string, newState: AspectState = AspectState.EDITED): CodeAspect => {
      return new CodeAspect(descriptor, newState, field.code);
    };

    switch (field) {
      case 'identifier':
        updates.identifier = createUpdatedField(method.identifier, value, AspectState.EDITED);
        break;
      case 'signature':
        updates.signature = createUpdatedField(method.signature, value, AspectState.EDITED);
        break;
      case 'specification':
        updates.specification = createUpdatedField(method.specification, value, AspectState.EDITED);
        break;
      case 'implementation':
        updates.implementation = createUpdatedField(method.implementation, value, AspectState.EDITED);
        break;
    }

    updateCodeMethod(methodIndex, updates);
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
          onMouseEnter={() => handleMouseEnter(`${fnName}-${localIndex}`)}
          onMouseLeave={handleMouseLeave}
        >
          {fnCall}
          <Handle
            type="source"
            position={Position.Right}
            id={`${fnName}-${localIndex}`}
            data-fn-name={fnName}
            data-handle-id={`${fnName}-${localIndex}`}
            className="inline-fn-handle"
            style={{
              width: 8,
              height: 8,
              transition: 'transform 0.1s ease',
              zIndex: 10
            }}
            isConnectable={false}
            onMouseEnter={() => handleMouseEnter(`${fnName}-${localIndex}`)}
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
    if (!(e.target as HTMLElement).closest('.custom-node__header')) {
      e.stopPropagation();
    }
  };

  return (
    <div
      className={`custom-node ${selected ? 'selected' : ''}`}
      onClick={handleNodeClick}
    >
      <Handle type="target" position={Position.Top} />

      <div className="custom-node__header custom-node-drag-handle" style={{position:'relative'}}>
        <EditableField
          value={method?.identifier?.descriptor || ''}
          onSave={(value) => handleFieldChange('identifier', value)}
          placeholder="Enter method name"
          className="custom-node__headline"
          isBold
          nodeId={nodeId}
          fieldName="identifier"
        />
        <span className="field-state-icon" style={{position:'absolute',top:2,right:4,cursor:'pointer'}} onClick={(e)=>{e.stopPropagation(); toggleFieldState('identifier');}}>{getIconForState(method?.identifier?.state)}</span>
      </div>

      <div className="custom-node__return-value" style={{position:'relative'}}>
        <EditableField
          value={method?.signature?.descriptor || ''}
          onSave={(value) => handleFieldChange('signature', value)}
          placeholder="return type"
          isItalic
          nodeId={nodeId}
          fieldName="signature"
        />
        <span className="field-state-icon" style={{position:'absolute',top:2,right:4,cursor:'pointer'}} onClick={(e)=>{e.stopPropagation(); toggleFieldState('signature');}}>{getIconForState(method?.signature?.state)}</span>
      </div>

      <div className="custom-node__content" style={{position:'relative'}}>
        <EditableField
          value={method?.specification?.descriptor || ''}
          onSave={(value) => handleFieldChange('specification', value)}
          placeholder="Enter specification"
          nodeId={nodeId}
          fieldName="specification"
        />
        <span className="field-state-icon" style={{position:'absolute',top:2,right:4,cursor:'pointer'}} onClick={(e)=>{e.stopPropagation(); toggleFieldState('specification');}}>{getIconForState(method?.specification?.state)}</span>
      </div>

      <div className="custom-node__content implementation-field" style={{position:'relative', whiteSpace:'pre-wrap'}}>
        {renderImplementation(method?.implementation?.descriptor || '')}
        <span className="field-state-icon" style={{position:'absolute',top:2,right:4,cursor:'pointer'}} onClick={(e)=>{e.stopPropagation(); toggleFieldState('implementation');}}>{getIconForState(method?.implementation?.state)}</span>
      </div>

      <Handle type="source" position={Position.Bottom} id="a" />
    </div>
  );
}

export default memo(CustomNode);
